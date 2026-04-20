import { buildActionDispatchMap } from "./action-dispatch-map.ts";
import type { createCommandActions } from "../commands/command-actions.ts";
import type { createLaunchActions } from "../comparison/launch-actions.ts";
import type { createReviewActions } from "../review/review-actions.ts";
import type { createTreeActions } from "../tree/tree-actions.ts";
import type { createViewActions } from "./view-actions.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import type { useDiffdiffAppRefresh } from "../comparison/use-comparison-refresh.ts";
import type { FileFocusController } from "../shared/file-focus.ts";
import type { DiffdiffAppDerived } from "./use-app-models.ts";
import type { AppCommand } from "../commands/registry.ts";
import type { useSessionDiagnostics } from "../diagnostics/use-session-diagnostics.ts";
import type { createGitHubReviewActions } from "../review/github-actions.ts";
import type { ReviewInputControllers } from "../review/review-input-controllers.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { AppTextInputControllers } from "../text-input/input-controllers.ts";
import type { KeymapMode } from "./keymap-mode.ts";

interface BuildControllerActionDispatchMapOptions {
  activeKeymapMode: KeymapMode;
  commandActions: ReturnType<typeof createCommandActions>;
  diagnostics: ReturnType<typeof useSessionDiagnostics>;
  derived: DiffdiffAppDerived;
  fileFocus: FileFocusController;
  filteredCommands: readonly AppCommand[];
  githubActions: ReturnType<typeof createGitHubReviewActions>;
  launchActions: ReturnType<typeof createLaunchActions>;
  openBranchModal: () => void;
  openClearReviewedConfirmModal: () => void;
  openHelp: () => void;
  openMergeConfirmModal: () => void;
  persistence: DiffdiffAppPersistence;
  refresh: ReturnType<typeof useDiffdiffAppRefresh>;
  textInputControllers: AppTextInputControllers;
  reviewInputControllers: ReviewInputControllers;
  reviewActions: ReturnType<typeof createReviewActions>;
  state: DiffdiffAppState;
  treeActions: ReturnType<typeof createTreeActions>;
  viewActions: ReturnType<typeof createViewActions>;
}

export function buildControllerActionDispatchMap({
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
}: BuildControllerActionDispatchMapOptions) {
  return buildActionDispatchMap({
    activeKeymapMode,
    applyBranchSelection: launchActions.applyBranchSelection,
    applyCleanupSelection: githubActions.applyCleanupSelection,
    applyCommitSelection: launchActions.applyCommitSelection,
    applyDashboardPullRequestSelection: launchActions.applyDashboardPullRequestSelection,
    applyPullRequestSelection: launchActions.applyPullRequestSelection,
    applyWorkingTreeSelection: launchActions.applyWorkingTreeSelection,
    clearReviewed: reviewActions.clearReviewed,
    closeCommentComposer: githubActions.closeCommentComposer,
    closeCommandModal: commandActions.closeCommandModal,
    closeDiagnostics: diagnostics.closeDiagnostics,
    copyCurrentSessionReopenCommand: viewActions.copyCurrentSessionReopenCommand,
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
    textInputControllers,
    reviewInputControllers,
    reviewActions,
    runCommand: commandActions.runCommand,
    state,
    submitCommentComposer: githubActions.submitCommentComposer,
    submitMergeFromModal: githubActions.submitMergeFromModal,
    submitReviewFromModal: githubActions.submitReviewFromModal,
    toggleBranchFilter: launchActions.toggleBranchFilter,
    treeActions,
  });
}
