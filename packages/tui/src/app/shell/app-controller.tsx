import { copySelection } from "../../selection-copy.ts";
import { useCallback, useEffect, useMemo } from "react";
import { logDiffdiffError, syncGitRemotes } from "@diffdiff/core";
import { buildAppCommands, getPaletteCommands, type AppCommand } from "../commands/registry.ts";
import { getPrefixMenuCommands, getPrefixMenuConfig } from "../commands/prefix-menus.ts";
import { filterCommands, formatCommandKeybind } from "../../commands.ts";
import { useSessionDiagnostics } from "../diagnostics/use-session-diagnostics.ts";
import { getPrefixModeBadge, getKeymapModeBadge, resolveActiveKeymapMode } from "./keymap-mode.ts";
import { LEADER_KEYBIND, LOADING_INDICATOR_FRAMES } from "../shared/constants.ts";
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
import { useSessionActions } from "../session/use-session-actions.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import { useDiffdiffAppState } from "../state/use-app-state.ts";
import { createFileFocusController } from "../shared/file-focus.ts";
import { truncateInlineMessage } from "../shared/text.ts";
import { createTreeActions } from "../tree/tree-actions.ts";
import { createViewActions } from "./view-actions.ts";
import { buildActionDispatchMap } from "./action-dispatch-map.ts";

export function DiffdiffAppController(props: DiffdiffAppProps) {
  const state = useDiffdiffAppState(props);
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
  const githubActions = createGitHubReviewActions({
    actions: sessionActions,
    derived,
    persistence,
    props,
    state,
  });
  const viewActions = createViewActions({ derived, persistence, props, state });
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
    leaderTriggerLabel: formatCommandKeybind(LEADER_KEYBIND, LEADER_KEYBIND) ?? "ctrl+x",
    state,
  });

  const openHelp = () => state.setDialogStack((s) => openAppDialog(s, "help"));
  const openBranchModal = useCallback(
    () => openBranchListModal(state, derived.branchItems),
    [derived.branchItems, state],
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
    if (
      state.session.github == null ||
      state.mergeMethod == null ||
      !state.session.github.pullRequest.merge.canMerge
    )
      return;
    state.setMergeConfirmOpen(true);
    state.setStatusMessage(`Press enter again to confirm the ${state.mergeMethod} merge.`);
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
        sessionGitHub: state.session.github,
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
      state.session.github,
      treeActions,
      viewActions,
    ],
  );
  const activePrefixMenu = useMemo(
    () => (state.activePrefix == null ? undefined : getPrefixMenuConfig(state.activePrefix)),
    [state.activePrefix],
  );
  const activePrefixMenuCommands = useMemo(
    () => (state.activePrefix == null ? [] : getPrefixMenuCommands(commands, state.activePrefix)),
    [commands, state.activePrefix],
  );
  const filteredCommands = useMemo(
    () => filterCommands(getPaletteCommands(commands), state.commandQuery),
    [commands, state.commandQuery],
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
  const footerModeBadge = useMemo(
    () =>
      activePrefixMenu == null
        ? getKeymapModeBadge(activeKeymapMode, props.theme)
        : getPrefixModeBadge(activePrefixMenu, props.theme),
    [activeKeymapMode, activePrefixMenu, props.theme],
  );
  const helpLabel =
    formatCommandKeybind(
      commands.find((command) => command.value === "system.help")?.keybind,
      LEADER_KEYBIND,
    ) ?? "?";
  const footerEvent = useMemo(
    () => ({
      color:
        state.errorToastMessage != null
          ? props.theme.danger
          : state.toastMessage != null
            ? props.theme.success
            : state.baseBranchLoadingMessage != null ||
                state.isReloading ||
                state.activePrefix != null
              ? props.theme.accent
              : props.theme.textMuted,
      message:
        state.errorToastMessage ??
        (state.toastMessage != null
          ? `✓ ${state.toastMessage}`
          : state.baseBranchLoadingMessage != null
            ? `${LOADING_INDICATOR_FRAMES[state.loadingIndicatorFrame]} ${state.baseBranchLoadingMessage}`
            : state.statusMessage),
    }),
    [
      props.theme,
      state.activePrefix,
      state.baseBranchLoadingMessage,
      state.errorToastMessage,
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

  const actionDispatchMap = buildActionDispatchMap({
    activeKeymapMode,
    applyBranchSelection: launchActions.applyBranchSelection,
    applyCleanupSelection: githubActions.applyCleanupSelection,
    applyCommitSelection: launchActions.applyCommitSelection,
    applyDashboardPullRequestSelection: launchActions.applyDashboardPullRequestSelection,
    applyPullRequestSelection: launchActions.applyPullRequestSelection,
    applyWorkingTreeSelection: launchActions.applyWorkingTreeSelection,
    clearReviewed: reviewActions.clearReviewed,
    closeCommandModal: commandActions.closeCommandModal,
    closeDiagnostics: diagnostics.closeDiagnostics,
    copyPullRequestUrl: viewActions.copyPullRequestUrl,
    copySelectedPullRequestConversationItemUrl:
      reviewActions.copySelectedPullRequestConversationItemUrl,
    derived,
    filteredCommands,
    fileFocus,
    jumpToFirstDiagnostic: diagnostics.jumpToFirstDiagnostic,
    jumpToLastDiagnostic: diagnostics.jumpToLastDiagnostic,
    moveDiagnosticSelection: diagnostics.moveDiagnosticSelection,
    openBranchModal,
    openCommandModal: commandActions.openCommandModal,
    openCommentComposer: githubActions.openCommentComposer,
    openClearReviewedConfirmModal,
    openDiagnostics: diagnostics.openDiagnostics,
    openFocusedFileInEditor: viewActions.openFocusedFileInEditor,
    openFocusedReviewThreadReplyComposer: githubActions.openFocusedReviewThreadReplyComposer,
    openGitHubPullRequestList: githubActions.openGitHubPullRequestList,
    openHelp,
    openMergeConfirmModal,
    openMergeModal: githubActions.openMergeModal,
    openPullRequestCommentsModal: githubActions.openPullRequestCommentsModal,
    openPullRequestConversationReplyComposer:
      githubActions.openPullRequestConversationReplyComposer,
    openSubmitReviewModal: githubActions.openSubmitReviewModal,
    persistenceApi: persistence.persistenceApi,
    refreshComparison: refresh.refreshComparison,
    refreshGitHubPullRequestList: githubActions.refreshGitHubPullRequestList,
    reviewActions,
    runCommand: commandActions.runCommand,
    state,
    submitCommentComposer: githubActions.submitCommentComposer,
    submitMergeFromModal: githubActions.submitMergeFromModal,
    submitReviewFromModal: githubActions.submitReviewFromModal,
    toggleBranchFilter: launchActions.toggleBranchFilter,
    treeActions,
  });
  useMainKeyboard({
    actionDispatchMap,
    activeKeymapMode,
    commandActions,
    dismissErrorToast: persistence.persistenceApi.dismissErrorToast,
    filteredCommandsLength: filteredCommands.length,
    filteredCommitItemsLength: derived.filteredCommitItems.length,
    filteredPullRequestsLength: derived.filteredPullRequests.length,
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
      commandQuery={state.commandQuery}
      commitListIndex={state.commitListIndex}
      commitSearchActive={state.commitSearchActive}
      commitSearchQuery={state.commitSearchQuery}
      currentBranchLabel={state.session.repository.currentBranch ?? "detached"}
      diagnosticErrorMessage={diagnostics.diagnosticErrorMessage}
      diagnosticEventIndex={diagnostics.diagnosticEventIndex}
      diagnosticEvents={diagnostics.diagnosticEvents}
      diagnosticLogFilePath={persistence.resolvedLogFilePath}
      diffPaneWidth={derived.diffPaneWidth}
      diffView={derived.diffView}
      draftPrCount={derived.draftPrCount}
      estimatedFileCardBodyHeights={derived.estimatedFileCardBodyHeights}
      fileCardBodyVisibility={derived.fileCardBodyVisibility}
      fileCardPreviewViewports={derived.fileCardPreviewViewports}
      fileCardRootRefs={derived.fileCardRootRefs}
      filteredCommands={filteredCommands}
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
      leaderKeybind={LEADER_KEYBIND}
      localBranchCount={derived.localBranchCount}
      mergeBodyScrollRef={state.mergeBodyScrollRef}
      mergeCommitMessage={state.mergeCommitMessage}
      mergeCommitTitle={state.mergeCommitTitle}
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
      pullRequestSearchQuery={state.pullRequestSearchQuery}
      refreshIndicatorLabel={state.refreshIndicatorLabel}
      remoteBranchCount={derived.remoteBranchCount}
      reviewComposerBody={state.reviewComposerBody}
      reviewComposerContext={derived.reviewComposerContext}
      reviewedPaths={state.reviewedPaths}
      reviewedCount={state.reviewedPaths.size}
      reviewRequestedPrCount={derived.reviewRequestedPrCount}
      reviewSubmissionBody={state.reviewSubmissionBody}
      reviewSubmissionEventIndex={state.reviewSubmissionEventIndex}
      reviewThreadsByPath={derived.reviewThreadsByPath}
      scrollRef={state.scrollRef}
      selectedFileIndex={state.selectedFileIndex}
      selectedReviewAnchor={derived.selectedReviewAnchor}
      selectedReviewComment={derived.selectedReviewComment}
      selectedReviewThread={derived.selectedReviewThread}
      selectedTreePath={state.selectedTreePath}
      session={state.session}
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
