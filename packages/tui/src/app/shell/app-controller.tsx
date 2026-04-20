import { copySelection } from "../../selection-copy.ts";
import { useCallback, useEffect, useMemo } from "react";
import { logDiffdiffError, syncGitRemotes } from "@madisonbullard/diffdiff-core";
import { buildAppCommands, getPaletteCommands, type AppCommand } from "../commands/registry.ts";
import { getPrefixMenuCommands, getPrefixMenuConfig } from "../commands/prefix-menus.ts";
import { filterCommands } from "../../commands.ts";
import { formatActionBindings, formatCommandBindings } from "../keymap/display.ts";
import { useSessionDiagnostics } from "../diagnostics/use-session-diagnostics.ts";
import { getFooterEventPresentation } from "./footer-event.ts";
import { getPrefixModeBadge, getKeymapModeBadge, resolveActiveKeymapMode } from "./keymap-mode.ts";
import { openDialog as openAppDialog } from "../dialogs/stack.ts";
import { DiffdiffAppView } from "./app-frame.tsx";
import { createCommandActions } from "../commands/command-actions.ts";
import { useDiffdiffAppDerived } from "./use-app-models.ts";
import { createGitHubReviewActions } from "../review/github-actions.ts";
import { useDiffdiffAppLayoutEffects } from "../layout/use-app-layout-effects.ts";
import { createLaunchActions } from "../comparison/launch-actions.ts";
import { useDiffdiffAppLifecycle } from "../session/use-app-lifecycle.ts";
import { openBranchListModal } from "../dialogs/list-dialog-handlers.ts";
import { useMainKeyboard } from "./use-main-keyboard.ts";
import { useDiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import { useDiffdiffAppRefresh } from "../comparison/use-comparison-refresh.ts";
import { createReviewActions } from "../review/review-actions.ts";
import { createReviewInputControllers } from "../review/review-input-controllers.ts";
import { useSessionActions } from "../session/use-session-actions.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import { useDiffdiffAppState } from "../state/use-app-state.ts";
import { createFileFocusController } from "../shared/file-focus.ts";
import { truncateInlineMessage } from "../shared/text.ts";
import { createAppTextInputControllers } from "../text-input/input-controllers.ts";
import { createTreeActions } from "../tree/tree-actions.ts";
import { openHelpDialog, openMergeConfirmDialog } from "./controller-helpers.ts";
import { createViewActions } from "./view-actions.ts";
import { buildControllerActionDispatchMap } from "./controller-action-dispatch.ts";

export function DiffdiffAppController(props: DiffdiffAppProps) {
  const state = useDiffdiffAppState(props);
  const textInputControllers = createAppTextInputControllers(state);
  const fileFocus = createFileFocusController({
    getCurrentFiles: () => state.session.files,
    getCurrentIndex: () => state.selectedFileIndex,
    pendingFileFocusRequestRef: state.pendingFileFocusRequestRef,
    setActivePane: state.setActivePane,
    setSelectedFileIndex: state.setSelectedFileIndex,
  });
  const derived = useDiffdiffAppDerived(state, props.theme);
  const layout = useDiffdiffAppLayoutEffects(state, derived);
  const sessionActions = useSessionActions({
    fileFocus,
    getFileTopOffsets: layout.getFileTopOffsets,
    state,
    syncRemotes: props.syncRemotes ?? syncGitRemotes,
  });
  const persistence = useDiffdiffAppPersistence(state, props);
  const refresh = useDiffdiffAppRefresh({
    actions: sessionActions,
    persistence,
    props: { loadSession: props.loadSession, probeFreshness: props.probeFreshness },
    state,
  });
  const diagnostics = useSessionDiagnostics({
    loadSessionDiagnostics: props.loadSessionDiagnostics,
    logFilePath: persistence.resolvedLogFilePath,
    state,
  });
  const launchActions = createLaunchActions({ actions: sessionActions, persistence, props, state });
  const reviewActions = createReviewActions({
    derived,
    fileFocus,
    persistence,
    props,
    startInteraction: sessionActions.startInteraction,
    state,
  });
  const treeActions = createTreeActions({
    derived,
    fileFocus,
    startInteraction: sessionActions.startInteraction,
    state,
  });
  const reviewInputControllers = createReviewInputControllers({
    getSelectedFilePath: () => derived.selectedFilePath,
    persistence,
    props,
    state,
  });
  const githubActions = createGitHubReviewActions({
    actions: sessionActions,
    controllers: reviewInputControllers,
    derived,
    persistence,
    props,
    state,
    textInputControllers,
  });
  const viewActions = createViewActions({ derived, persistence, props, state });
  const reviewComposerModels = reviewInputControllers.reviewComposer.getModels();
  const prefetchComparisonBrowserData = useCallback(async () => {
    if (props.loadComparisonBrowserData == null) {
      return;
    }

    const loadId = sessionActions.beginSessionLoad();

    try {
      await sessionActions.syncRemoteState();
      const nextData = await props.loadComparisonBrowserData(state.startupOptions);
      if (!sessionActions.isLatestSessionLoad(loadId)) {
        return;
      }

      sessionActions.applyComparisonBrowserData(nextData);
    } catch (error) {
      if (sessionActions.isLatestSessionLoad(loadId)) {
        logDiffdiffError("app", "startup_branch_list_prefetch_failed", error, {
          action: "startup-prefetch-comparison-browser-data",
          startupOptions: state.startupOptions,
        });
      }
    }
  }, [props.loadComparisonBrowserData, sessionActions, state.startupOptions]);

  const commandActions = createCommandActions({
    getCommands: () => commands,
    inputController: textInputControllers.commandPalette,
    state,
  });

  const openHelp = () => openHelpDialog(state);
  const openBranchModal = useCallback(
    () => openBranchListModal(state, derived.branchItems, textInputControllers.commitSearch),
    [derived.branchItems, state, textInputControllers.commitSearch],
  );

  function openClearReviewedConfirmModal(): void {
    if (state.session.github != null) {
      state.setStatusMessage("GitHub PR reviewed state can only be updated one file at a time.");
      return;
    }

    if (state.reviewedPaths.size === 0) {
      state.setStatusMessage("No files are marked reviewed.");
      return;
    }

    state.setDialogStack((currentStack) => openAppDialog(currentStack, "clear-reviewed"));
    state.setStatusMessage(`Confirm clearing review marks from ${state.reviewedPaths.size} files.`);
  }

  function openMergeConfirmModal(): void {
    openMergeConfirmDialog(derived, state);
  }

  const commands = useMemo<AppCommand[]>(
    () =>
      buildAppCommands({
        activePane: state.activePane,
        hasFocusedReviewComment:
          derived.selectedReviewThread != null && derived.selectedReviewComment != null,
        hasFocusedReviewThread: derived.selectedReviewThread != null,
        hasReviewThreads: derived.selectedFileReviewThreads.length > 0,
        bulkReviewedActionsDisabledReason:
          state.session.github == null
            ? undefined
            : "GitHub PR reviewed state can only be updated one file at a time.",
        canClearReviewed: state.reviewedPaths.size > 0,
        canOpenFocusedFileInEditor:
          state.activePane === "tree"
            ? derived.selectedTreeNode?.kind === "file"
            : derived.selectedFilePath != null,
        canMoveToNextUnreviewed: derived.hasNextUnreviewedFile,
        canOpenSelectedTreeFile: derived.selectedTreeNode?.kind === "file",
        clearReviewed: openClearReviewedConfirmModal,
        copyCurrentSessionReopenCommand: viewActions.copyCurrentSessionReopenCommand,
        copyFocusedReviewCommentUrl: reviewActions.copyFocusedReviewCommentUrl,
        copyPullRequestUrl: viewActions.copyPullRequestUrl,
        hasFiles: state.session.files.length > 0,
        hasSelectedReviewThread: derived.selectedReviewThread != null,
        isGitHubAuthenticated: props.isGitHubAuthenticated ?? false,
        markAllReviewed: reviewActions.markAllReviewed,
        moveFocusedReviewComment: reviewActions.moveSelectedReviewComment,
        moveFocusedReviewThread: reviewActions.moveSelectedReviewThread,
        moveToNextUnreviewed: reviewActions.jumpToNextUnreviewedFile,
        onExit: persistence.persistenceApi.exitApp,
        openBranchModal,
        openCommandModal: commandActions.openCommandModal,
        openCommentComposer: githubActions.openCommentComposer,
        openDiagnostics: diagnostics.openDiagnostics,
        openFocusedReviewThreadReplyComposer: githubActions.openFocusedReviewThreadReplyComposer,
        openGitHubPullRequestList: githubActions.openGitHubPullRequestList,
        openHelp,
        openFocusedFileInEditor: viewActions.openFocusedFileInEditor,
        openMergeModal: githubActions.openMergeModal,
        openPullRequestCommentsModal: githubActions.openPullRequestCommentsModal,
        openSelectedTreeFile: treeActions.openSelectedTreeFile,
        openSubmitReviewModal: githubActions.openSubmitReviewModal,
        refreshComparison: refresh.refreshComparison,
        selectedTreeNode: derived.selectedTreeNode,
        sessionGitHub: derived.displaySession.github,
        toggleActivePane: treeActions.toggleActivePane,
        toggleCollapsedSelectedFile: () => reviewActions.toggleCollapsed(state.selectedFileIndex),
        toggleDiffView: reviewActions.toggleDiffView,
        toggleFocusedReviewThreadCollapsed: reviewActions.toggleFocusedReviewThreadCollapsed,
        toggleReviewedSelectedFile: () => reviewActions.toggleReviewed(state.selectedFileIndex),
      }),
    [
      commandActions,
      diagnostics.openDiagnostics,
      derived,
      githubActions,
      openClearReviewedConfirmModal,
      openBranchModal,
      openHelp,
      persistence.persistenceApi,
      props.isGitHubAuthenticated,
      refresh.refreshComparison,
      reviewActions,
      state.activePane,
      state.reviewedPaths.size,
      state.selectedFileIndex,
      state.session.files.length,
      treeActions,
      viewActions,
    ],
  );
  const activePrefixMenu = useMemo(
    () => (state.activePrefix == null ? undefined : getPrefixMenuConfig(state.activePrefix)),
    [state.activePrefix],
  );
  const commandBindingLabels = useMemo(
    () =>
      new Map(
        commands.map((command) => [
          command.value,
          formatCommandBindings(state.reverseKeymaps, command),
        ]),
      ),
    [commands, state.reverseKeymaps],
  );
  const filteredCommands = useMemo(
    () => filterCommands(getPaletteCommands(commands), state.commandInput.value),
    [commands, state.commandInput.value],
  );

  useEffect(() => {
    state.gitHubPreferencesRef.current = state.gitHubPreferences;
  }, [state.gitHubPreferences, state.gitHubPreferencesRef]);

  useEffect(() => {
    state.setCommandIndex((currentIndex) =>
      currentIndex >= filteredCommands.length
        ? Math.max(filteredCommands.length - 1, 0)
        : currentIndex,
    );
  }, [filteredCommands.length, state.setCommandIndex]);

  const activeKeymapMode = useMemo(
    () =>
      resolveActiveKeymapMode({
        activeDialog: state.activeOverlay,
        activeListView: state.activeListView,
        activePane: state.activePane,
        commitSearchActive: state.commitSearchActive,
        hasSelectedReviewThread: derived.hasThreadKeymap,
        mergeConfirmOpen: state.mergeConfirmOpen,
        mergeModalField: state.mergeModalField,
        pullRequestSearchActive: state.pullRequestSearchActive,
      }),
    [
      derived.hasThreadKeymap,
      state.activeListView,
      state.activeOverlay,
      state.activePane,
      state.commitSearchActive,
      state.mergeConfirmOpen,
      state.mergeModalField,
      state.pullRequestSearchActive,
    ],
  );
  const activePrefixMenuCommands = useMemo(
    () =>
      state.activePrefix == null
        ? []
        : getPrefixMenuCommands(
            commands,
            state.activePrefix,
            state.resolvedKeymaps,
            activeKeymapMode,
          ),
    [activeKeymapMode, commands, state.activePrefix, state.resolvedKeymaps],
  );
  const footerModeBadge = useMemo(
    () =>
      activePrefixMenu == null
        ? getKeymapModeBadge(activeKeymapMode, props.theme)
        : getPrefixModeBadge(activePrefixMenu, props.theme),
    [activeKeymapMode, activePrefixMenu, props.theme],
  );
  const helpLabel =
    formatActionBindings(state.reverseKeymaps, "system.help", ["diff", "thread", "tree"])?.split(
      " / ",
    )[0] ?? "?";
  const footerEvent = useMemo(
    () =>
      getFooterEventPresentation({
        activePrefix: state.activePrefix,
        baseBranchLoadingMessage: state.baseBranchLoadingMessage,
        isReloading: state.isReloading,
        loadingIndicatorFrame: state.loadingIndicatorFrame,
        statusMessage: state.statusMessage,
        theme: props.theme,
        toastMessage: state.toastMessage,
      }),
    [
      props.theme,
      state.activePrefix,
      state.baseBranchLoadingMessage,
      state.isReloading,
      state.loadingIndicatorFrame,
      state.statusMessage,
      state.toastMessage,
    ],
  );
  const footerEventMessage = useMemo(
    () =>
      truncateInlineMessage(
        footerEvent.message,
        Math.max(
          state.terminalDimensions.width - (footerModeBadge.label.length + helpLabel.length + 20),
          0,
        ),
      ),
    [footerEvent.message, footerModeBadge.label.length, helpLabel, state.terminalDimensions.width],
  );
  const showFooterLoadingIndicator = state.isSubmittingReviewAction && state.activeOverlay == null;

  const actionDispatchMap = buildControllerActionDispatchMap({
    activeKeymapMode,
    commandActions,
    diagnostics,
    derived,
    fileFocus,
    filteredCommands,
    githubActions,
    launchActions,
    openBranchModal,
    openClearReviewedConfirmModal,
    openHelp,
    openMergeConfirmModal,
    persistence,
    refresh,
    textInputControllers,
    reviewInputControllers,
    reviewActions,
    state,
    treeActions,
    viewActions,
  });
  useMainKeyboard({
    actionDispatchMap,
    activeKeymapMode,
    commandActions,
    dismissErrorToast: persistence.persistenceApi.dismissErrorToast,
    textInputControllers,
    reviewInputControllers,
    state,
  });

  useDiffdiffAppLifecycle({
    derived,
    persistence,
    prefetchComparisonBrowserData,
    refreshGitHubPullRequestList: githubActions.refreshGitHubPullRequestList,
    state,
    startupInstrumentation: props.startupInstrumentation,
  });

  const canApplyCleanup =
    (state.cleanupCandidates.some((candidate) => candidate.kind === "local-branch") &&
      state.cleanupSelection.removeLocal) ||
    (state.cleanupCandidates.some((candidate) => candidate.kind === "remote-tracking") &&
      state.cleanupSelection.removeRemote);

  return (
    <DiffdiffAppView
      activeFileIndex={state.activeFileIndex}
      activeListView={state.activeListView}
      activeOverlay={state.activeOverlay}
      activePane={state.activePane}
      baseBranchLoadingMessage={state.baseBranchLoadingMessage}
      branchItems={derived.branchItems}
      branchListFilters={state.branchListFilters}
      branchListIndex={state.branchListIndex}
      canApplyCleanup={canApplyCleanup}
      cleanupCandidateIndex={state.cleanupCandidateIndex}
      cleanupCandidates={state.cleanupCandidates}
      cleanupSelection={state.cleanupSelection}
      collapsedCommentStates={state.commentCollapseStates}
      collapsedDirectories={state.collapsedDirectories}
      collapsedPaths={state.collapsedPaths}
      commandIndex={state.commandIndex}
      commandQuery={state.commandInput.value}
      commandQueryCursorOffset={state.commandInput.cursorOffset}
      commitListIndex={state.commitListIndex}
      commitSearchActive={state.commitSearchActive}
      commitSearchQuery={state.commitSearchInput.value}
      commitSearchCursorOffset={state.commitSearchInput.cursorOffset}
      currentBranchLabel={state.session.repository.currentBranch ?? "detached"}
      diagnosticErrorMessage={diagnostics.diagnosticErrorMessage}
      diagnosticEventIndex={diagnostics.diagnosticEventIndex}
      diagnosticEvents={diagnostics.diagnosticEvents}
      diagnosticLogFilePath={persistence.resolvedLogFilePath}
      diffPaneWidth={derived.diffPaneWidth}
      diffView={derived.diffView}
      draftPrCount={derived.draftPrCount}
      errorToastMessage={state.errorToastMessage}
      estimatedFileCardBodyHeights={derived.estimatedFileCardBodyHeights}
      fileCardBodyVisibility={derived.fileCardBodyVisibility}
      fileCardPreviewViewports={derived.fileCardPreviewViewports}
      fileCardRootRefs={derived.fileCardRootRefs}
      filteredCommands={filteredCommands}
      commandBindingLabels={commandBindingLabels}
      filteredCommitItems={derived.filteredCommitItems}
      filteredPullRequests={derived.filteredPullRequests}
      filterIndex={state.filterIndex}
      footerEvent={footerEvent}
      footerEventMessage={footerEventMessage}
      footerModeBadge={footerModeBadge}
      handleFileTreeMouseUp={treeActions.handleFileTreeMouseUp}
      helpCommands={commands}
      helpLabel={helpLabel}
      isDiagnosticsLoading={diagnostics.isDiagnosticsLoading}
      isPullRequestListLoading={state.isPullRequestListLoading}
      isSubmittingReviewAction={state.isSubmittingReviewAction}
      localBranchCount={derived.localBranchCount}
      mergeBodyScrollRef={state.mergeBodyScrollRef}
      mergeCommitMessage={state.mergeCommitMessageInput.value}
      mergeCommitMessageCursorOffset={state.mergeCommitMessageInput.cursorOffset}
      mergeCommitTitle={state.mergeCommitTitleInput.value}
      mergeCommitTitleCursorOffset={state.mergeCommitTitleInput.cursorOffset}
      mergeMethod={state.mergeMethod}
      mergeModalField={state.mergeModalField}
      activePrefixMenu={activePrefixMenu}
      activePrefixMenuCommands={activePrefixMenuCommands}
      onMouseUp={() =>
        copySelection(state.renderer, {
          onSuccess: () => persistence.persistenceApi.showToast("Copied to clipboard"),
          onError: () =>
            persistence.persistenceApi.handleAppFailure("Unable to copy selection.", {
              action: "copy-selection",
              selectedFilePath: derived.selectedFilePath,
            }),
        })
      }
      openPrCount={derived.openPrCount}
      pullRequestConversationItemId={
        derived.selectedPullRequestConversationItem?.id == null
          ? undefined
          : String(derived.selectedPullRequestConversationItem.id)
      }
      pullRequestListIndex={state.pullRequestListIndex}
      pullRequestSearchActive={state.pullRequestSearchActive}
      pullRequestSearchQuery={state.pullRequestSearchInput.value}
      pullRequestSearchCursorOffset={state.pullRequestSearchInput.cursorOffset}
      refreshIndicatorLabel={state.refreshIndicatorLabel}
      remoteBranchCount={derived.remoteBranchCount}
      reviewComposerBody={state.reviewComposer.input.value}
      reviewComposerCursorOffset={state.reviewComposer.input.cursorOffset}
      reviewComposerAutocomplete={reviewComposerModels.autocomplete}
      reviewComposerAutocompleteIndex={state.reviewComposer.autocompleteIndex}
      reviewComposerContext={reviewComposerModels.context}
      reviewComposerHistoryEntries={reviewComposerModels.historyEntries}
      reviewedPaths={state.reviewedPaths}
      reviewedCount={state.reviewedPaths.size}
      reviewRequestedPrCount={derived.reviewRequestedPrCount}
      reviewSubmissionBody={state.reviewSubmissionInput.value}
      reviewSubmissionCursorOffset={state.reviewSubmissionInput.cursorOffset}
      reviewSubmissionEventIndex={state.reviewSubmissionEventIndex}
      reviewThreadsByPath={derived.reviewThreadsByPath}
      scrollRef={state.scrollRef}
      selectedFileIndex={state.selectedFileIndex}
      selectedDiffRowRef={state.selectedDiffRowRef}
      showSelectedReviewAnchor={state.showSelectedReviewAnchor}
      selectedReviewAnchor={derived.selectedReviewAnchor}
      selectedReviewComment={derived.selectedReviewComment}
      selectedReviewThread={derived.selectedReviewThread}
      selectedTreePath={state.selectedTreePath}
      session={derived.displaySession}
      showFooterLoadingIndicator={showFooterLoadingIndicator}
      showMergeConfirmModal={derived.showMergeConfirmModal}
      sidebarWidth={derived.sidebarWidth}
      stickyFile={derived.stickyFile}
      syntaxStyle={props.syntaxStyle}
      terminalWidth={state.terminalDimensions.width}
      theme={props.theme}
      toggleReviewThreadCollapsed={reviewActions.toggleReviewThreadCollapsed}
      treeRowRefCallbacks={derived.treeRowRefCallbacks}
      treeScrollRef={state.treeScrollRef}
      treeSummaryLabels={derived.treeSummaryLabels}
      visibleTreeNodes={derived.visibleTreeNodes}
    />
  );
}
