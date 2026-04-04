import { copyTextToClipboard } from "../../clipboard.ts";
import { copySelection } from "../../selection-copy.ts";
import { useEffect, useMemo } from "react";
import { syncGitRemotes } from "@diffdiff/core";
import {
  buildAppCommands,
  findAppCommandByValue,
  getPaletteCommands,
  type AppCommand,
} from "../commands/registry.ts";
import { filterCommands, formatCommandKeybind } from "../../commands.ts";
import {
  getKeymapModeBadge,
  keymapModeSuspendsGlobalKeybinds,
  resolveActiveKeymapMode,
} from "./keymap-mode.ts";
import {
  COMMAND_LIST_KEYBIND,
  LEADER_KEYBIND,
  LOADING_INDICATOR_FRAMES,
} from "../shared/constants.ts";
import { openDialog as openAppDialog } from "../dialogs/stack.ts";
import { DiffdiffAppView } from "./app-frame.tsx";
import { createCommandActions } from "../commands/command-actions.ts";
import { useDiffdiffAppDerived } from "./use-app-models.ts";
import { createGitHubReviewActions } from "../review/github-actions.ts";
import { useDiffdiffAppLayoutEffects } from "../layout/use-app-layout-effects.ts";
import { createLaunchActions } from "../comparison/launch-actions.ts";
import { useDiffdiffAppLifecycle } from "../session/use-app-lifecycle.ts";
import { createListModalHandlers } from "../dialogs/list-dialog-handlers.ts";
import { useMainKeyboard } from "./use-main-keyboard.ts";
import { useDiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import { useDiffdiffAppRefresh } from "../comparison/use-comparison-refresh.ts";
import { createReviewModalHandlers } from "../dialogs/review-dialog-handlers.ts";
import { createReviewActions } from "../review/review-actions.ts";
import { useSessionActions } from "../session/use-session-actions.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import { useDiffdiffAppState } from "../state/use-app-state.ts";
import { truncateInlineMessage } from "../shared/text.ts";
import { createTreeActions } from "../tree/tree-actions.ts";
import { findInitialBranchListSelection } from "../../view-model.ts";

export function DiffdiffAppController(props: DiffdiffAppProps) {
  const launchInPullRequestList = props.initialOptions.initialListMode === "pull-requests";
  const state = useDiffdiffAppState(props);
  const derived = useDiffdiffAppDerived(state, props.theme);
  const layout = useDiffdiffAppLayoutEffects(state, derived);
  const sessionActions = useSessionActions({
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
  const launchActions = createLaunchActions({ actions: sessionActions, persistence, props, state });
  const reviewActions = createReviewActions({
    derived,
    startInteraction: sessionActions.startInteraction,
    state,
  });
  const treeActions = createTreeActions({
    derived,
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

  const commandActions = createCommandActions({
    getCommands: () => commands,
    leaderKeyLabel: formatCommandKeybind(LEADER_KEYBIND, LEADER_KEYBIND) ?? "ctrl+x",
    persistence,
    state,
  });

  function openHelp(): void {
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "help"));
  }

  function openBranchModal(): void {
    state.setBranchListIndex(
      findInitialBranchListSelection({
        comparison: state.session.comparison,
        currentBranch: state.session.repository.currentBranch,
        items: derived.branchItems,
      }),
    );
    state.setCommitListIndex(0);
    state.setCommitSearchQuery("");
    state.setCommitSearchActive(false);
    state.setActiveListView("branch");
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "branch", { clear: true }));
    state.setStatusMessage("Opened list modal.");
  }

  async function copyPullRequestUrl(): Promise<void> {
    if (state.session.github == null) {
      state.setStatusMessage("Open a GitHub pull request first.");
      return;
    }

    const copied = await copyTextToClipboard(state.session.github.pullRequest.url);
    if (copied) {
      persistence.persistenceApi.showToast("Copied PR URL to clipboard");
      return;
    }

    persistence.persistenceApi.handleAppFailure("Unable to copy the PR URL.", {
      action: "copy-pr-url",
    });
  }

  function openMergeConfirmModal(): void {
    if (
      state.session.github == null ||
      state.mergeMethod == null ||
      !state.session.github.pullRequest.merge.canMerge
    ) {
      return;
    }

    state.setMergeConfirmOpen(true);
    state.setStatusMessage(`Press enter again to confirm the ${state.mergeMethod} merge.`);
  }

  const commands = useMemo<AppCommand[]>(
    () =>
      buildAppCommands({
        canClearReviewed: state.reviewedPaths.size > 0,
        canMoveToNextUnreviewed: derived.hasNextUnreviewedFile,
        canOpenSelectedTreeFile: derived.selectedTreeNode?.kind === "file",
        clearReviewed: reviewActions.clearReviewed,
        copyFocusedReviewCommentUrl: reviewActions.copyFocusedReviewCommentUrl,
        copyPullRequestUrl,
        hasFiles: state.session.files.length > 0,
        hasFocusedReviewComment: derived.hasSelectedReviewThread,
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
        openFocusedReviewThreadReplyComposer: githubActions.openFocusedReviewThreadReplyComposer,
        openGitHubPullRequestList: githubActions.openGitHubPullRequestList,
        openHelp,
        openMergeModal: githubActions.openMergeModal,
        openPullRequestCommentsModal: githubActions.openPullRequestCommentsModal,
        openSelectedTreeFile: treeActions.openSelectedTreeFile,
        openSubmitReviewModal: githubActions.openSubmitReviewModal,
        refreshComparison: refresh.refreshComparison,
        selectedTreeNode: derived.selectedTreeNode,
        sessionGitHub: state.session.github,
        showKeyLegend: state.showKeyLegend,
        toggleActivePane: treeActions.toggleActivePane,
        toggleCollapsedSelectedFile: () => reviewActions.toggleCollapsed(state.selectedFileIndex),
        toggleDiffView: reviewActions.toggleDiffView,
        toggleFocusedReviewThreadCollapsed: reviewActions.toggleFocusedReviewThreadCollapsed,
        toggleKeyLegend: commandActions.toggleKeyLegend,
        toggleReviewedSelectedFile: () => reviewActions.toggleReviewed(state.selectedFileIndex),
      }),
    [
      commandActions,
      derived,
      githubActions,
      openBranchModal,
      openHelp,
      persistence.persistenceApi,
      props.isGitHubAuthenticated,
      refresh.refreshComparison,
      reviewActions,
      state.reviewedPaths.size,
      state.selectedFileIndex,
      state.session.files.length,
      state.session.github,
      state.showKeyLegend,
      treeActions,
    ],
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

  const listHandlers = createListModalHandlers({
    applyBranchSelection: launchActions.applyBranchSelection,
    applyCommitSelection: launchActions.applyCommitSelection,
    applyDashboardPullRequestSelection: launchActions.applyDashboardPullRequestSelection,
    applyPullRequestSelection: launchActions.applyPullRequestSelection,
    applyWorkingTreeSelection: launchActions.applyWorkingTreeSelection,
    commands,
    derived: { ...derived, filteredCommands } as typeof derived & {
      filteredCommands: readonly AppCommand[];
    },
    filteredCommands,
    handleTextInputLeaderKey: commandActions.handleTextInputLeaderKey,
    openHelp,
    refreshGitHubPullRequestList: githubActions.refreshGitHubPullRequestList,
    runCommand: commandActions.runCommand,
    state,
    toggleBranchFilter: launchActions.toggleBranchFilter,
  });
  const reviewModalHandlers = createReviewModalHandlers({
    applyCleanupSelection: githubActions.applyCleanupSelection,
    copySelectedPullRequestConversationItemUrl:
      reviewActions.copySelectedPullRequestConversationItemUrl,
    handleTextInputLeaderKey: commandActions.handleTextInputLeaderKey,
    openMergeConfirmModal,
    openPullRequestConversationReplyComposer:
      githubActions.openPullRequestConversationReplyComposer,
    persistence,
    state,
    submitCommentComposer: githubActions.submitCommentComposer,
    submitMergeFromModal: githubActions.submitMergeFromModal,
    submitReviewFromModal: githubActions.submitReviewFromModal,
  });

  const activeKeymapMode = useMemo(
    () =>
      resolveActiveKeymapMode({
        activeDialog: state.activeOverlay,
        activeListView: state.activeListView,
        activePane: state.activePane,
        commitSearchActive: state.commitSearchActive,
        hasSelectedReviewThread: derived.hasThreadKeymap,
        leaderActive: false,
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
  const displayKeymapMode = state.leaderActive ? "leader" : activeKeymapMode;
  const footerModeBadge = useMemo(
    () => getKeymapModeBadge(displayKeymapMode, props.theme),
    [displayKeymapMode, props.theme],
  );
  const activeKeymapModeSuspendsGlobalKeybinds = useMemo(
    () => keymapModeSuspendsGlobalKeybinds(activeKeymapMode),
    [activeKeymapMode],
  );
  const commandListLabel =
    formatCommandKeybind(
      findAppCommandByValue(commands, "system.command-palette")?.keybind,
      LEADER_KEYBIND,
    ) ??
    formatCommandKeybind(COMMAND_LIST_KEYBIND, LEADER_KEYBIND) ??
    "ctrl+p";
  const keyLegendToggleLabel = state.showKeyLegend ? "hide keys" : "show keys";
  const footerEvent = useMemo(
    () => ({
      color:
        state.errorToastMessage != null
          ? props.theme.danger
          : state.toastMessage != null
            ? props.theme.success
            : state.baseBranchLoadingMessage != null || state.isReloading || state.leaderActive
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
      state.baseBranchLoadingMessage,
      state.errorToastMessage,
      state.isReloading,
      state.leaderActive,
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
          state.terminalDimensions.width -
            (footerModeBadge.label.length +
              commandListLabel.length +
              keyLegendToggleLabel.length +
              34),
          0,
        ),
      ),
    [
      commandListLabel,
      footerEvent.message,
      footerModeBadge.label.length,
      keyLegendToggleLabel,
      state.terminalDimensions.width,
    ],
  );

  useMainKeyboard({
    activeKeymapMode,
    commandActions,
    derived,
    dismissErrorToast: persistence.persistenceApi.dismissErrorToast,
    findCommandByKey: listHandlers.findCommandByKey,
    handleBranchModalKey: listHandlers.handleBranchModalKey,
    handleCleanupModalKey: reviewModalHandlers.handleCleanupModalKey,
    handleCommandModalKey: listHandlers.handleCommandModalKey,
    handleCommentComposerKey: reviewModalHandlers.handleCommentComposerKey,
    handleListFilterModalKey: listHandlers.handleListFilterModalKey,
    handlePullRequestCommentsModalKey: reviewModalHandlers.handlePullRequestCommentsModalKey,
    handlePullRequestListModalKey: listHandlers.handlePullRequestListModalKey,
    handleSubmitReviewModalKey: reviewModalHandlers.handleSubmitReviewModalKey,
    handleTreePaneKey: treeActions.handleTreePaneKey,
    handleMergeModalKey: reviewModalHandlers.handleMergeModalKey,
    moveSelectedFile: reviewActions.moveSelectedFile,
    moveSelectedReviewAnchor: reviewActions.moveSelectedReviewAnchor,
    state,
  });

  useDiffdiffAppLifecycle({
    activeKeymapModeSuspendsGlobalKeybinds,
    derived,
    launchInPullRequestList,
    persistence,
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
      commandListLabel={commandListLabel}
      commandQuery={state.commandQuery}
      commitListIndex={state.commitListIndex}
      commitSearchActive={state.commitSearchActive}
      commitSearchQuery={state.commitSearchQuery}
      currentBranchLabel={state.session.repository.currentBranch ?? "detached"}
      diffPaneWidth={derived.diffPaneWidth}
      diffView={derived.diffView}
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
      isPullRequestListLoading={state.isPullRequestListLoading}
      isSubmittingReviewAction={state.isSubmittingReviewAction}
      keyLegendToggleLabel={keyLegendToggleLabel}
      leaderKeybind={LEADER_KEYBIND}
      mergeBodyScrollRef={state.mergeBodyScrollRef}
      mergeCommitMessage={state.mergeCommitMessage}
      mergeCommitTitle={state.mergeCommitTitle}
      mergeMethod={state.mergeMethod}
      mergeModalField={state.mergeModalField}
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
      showKeyLegend={state.showKeyLegend}
      showMergeConfirmModal={derived.showMergeConfirmModal}
      sidebarWidth={derived.sidebarWidth}
      stickyFile={derived.stickyFile}
      syntaxStyle={props.syntaxStyle}
      theme={props.theme}
      toggleReviewThreadCollapsed={reviewActions.toggleReviewThreadCollapsed}
      treeRowRefCallbacks={derived.treeRowRefCallbacks}
      treeScrollRef={state.treeScrollRef}
      treeSummaryLabels={derived.treeSummaryLabels}
      visibleTreeNodes={derived.visibleTreeNodes}
    />
  );
}
