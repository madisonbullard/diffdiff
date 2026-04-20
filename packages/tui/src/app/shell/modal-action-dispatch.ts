/* eslint-disable max-lines */

import { clampIndex } from "../../view-model.ts";
import * as A from "../keymap/actions.ts";
import type { ActionDispatchMap } from "../keymap/action-dispatch.ts";
import { closeDialog as closeAppDialog, openDialog as openAppDialog } from "../dialogs/stack.ts";
import { getMergeMethod, getMergeMethodIndex } from "../../review/formatting.ts";
import type { ReviewInputControllers } from "../review/review-input-controllers.ts";
import { LIST_FILTER_KEYS } from "../shared/constants.ts";
import type { DiffdiffAppPersistenceApi } from "../state/app-props.ts";
import type { KeymapMode } from "./keymap-mode.ts";
import type { AppCommand } from "../commands/registry.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { DiffdiffAppDerived } from "./use-app-models.ts";
import type { AppTextInputControllers } from "../text-input/input-controllers.ts";

export interface BuildModalActionDispatchMapOptions {
  activeKeymapMode: KeymapMode;
  applyBranchSelection: (
    target: "base" | "head",
    branch: import("@madisonbullard/diffdiff-core").BranchInfo,
  ) => Promise<void>;
  applyCleanupSelection: () => Promise<void>;
  applyCommitSelection: (target: "base" | "head", sha: string, shortSha: string) => Promise<void>;
  applyDashboardPullRequestSelection: (
    pullRequest: import("@madisonbullard/diffdiff-core").GitHubDashboardPullRequest,
  ) => Promise<void>;
  applyPullRequestSelection: (
    branch: import("@madisonbullard/diffdiff-core").BranchInfo,
  ) => Promise<void>;
  applyWorkingTreeSelection: () => Promise<void>;
  clearReviewed: () => void;
  closeCommandModal: () => void;
  closeCommentComposer: () => void;
  closeDiagnostics: () => void;
  copySelectedPullRequestConversationItemUrl: () => Promise<void>;
  derived: DiffdiffAppDerived;
  filteredCommands: readonly AppCommand[];
  jumpToFirstDiagnostic: () => void;
  jumpToLastDiagnostic: () => void;
  moveDiagnosticSelection: (delta: number) => void;
  openMergeConfirmModal: () => void;
  openPullRequestConversationReplyComposer: () => void;
  persistenceApi: DiffdiffAppPersistenceApi;
  refreshGitHubPullRequestList: () => Promise<void>;
  textInputControllers: AppTextInputControllers;
  reviewInputControllers: ReviewInputControllers;
  runCommand: (command: AppCommand) => void;
  state: DiffdiffAppState;
  submitCommentComposer: () => Promise<void>;
  submitMergeFromModal: () => Promise<void>;
  submitReviewFromModal: () => Promise<void>;
  toggleBranchFilter: (key: keyof import("../../types.ts").BranchListFilters) => void;
}

export function buildModalActionDispatchMap({
  activeKeymapMode,
  applyBranchSelection,
  applyCleanupSelection,
  applyCommitSelection,
  applyDashboardPullRequestSelection,
  applyPullRequestSelection,
  applyWorkingTreeSelection,
  clearReviewed,
  closeCommandModal,
  closeCommentComposer: dismissCommentComposer,
  closeDiagnostics,
  copySelectedPullRequestConversationItemUrl,
  derived,
  filteredCommands,
  jumpToFirstDiagnostic,
  jumpToLastDiagnostic,
  moveDiagnosticSelection,
  openMergeConfirmModal,
  openPullRequestConversationReplyComposer,
  persistenceApi,
  refreshGitHubPullRequestList,
  textInputControllers,
  reviewInputControllers,
  runCommand,
  state,
  submitCommentComposer,
  submitMergeFromModal,
  submitReviewFromModal,
  toggleBranchFilter,
}: BuildModalActionDispatchMapOptions): ActionDispatchMap {
  const map: ActionDispatchMap = new Map();

  function acceptReviewComposerSelection(): void {
    if (reviewInputControllers.reviewComposer.acceptAutocomplete()) {
      return;
    }

    void submitCommentComposer();
  }

  function closeBranchModal(): void {
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "branch", "dismiss"));
    textInputControllers.commitSearch.reset();
    textInputControllers.commitSearch.deactivate();
    state.setStatusMessage("Closed list modal.");
  }

  function closePullRequestList(): void {
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "pull-request-list", "dismiss"),
    );
    textInputControllers.pullRequestSearch.reset();
    textInputControllers.pullRequestSearch.deactivate();
    state.setStatusMessage("Closed pull request list.");
  }

  function closeListFilters(): void {
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "list-filter", "dismiss"));
    state.setStatusMessage("Closed list filters.");
  }

  function closeCommentComposer(): void {
    dismissCommentComposer();
  }

  function closePullRequestConversation(): void {
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "comments", "dismiss"));
    state.setStatusMessage("Closed PR conversation.");
  }

  function closeSubmitReviewModal(): void {
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "submit-review", "dismiss"),
    );
    reviewInputControllers.reviewSubmission.close();
    state.setStatusMessage("Closed submit review modal.");
  }

  function closeMergeModal(): void {
    reviewInputControllers.mergeMessage.close();
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "merge", "dismiss"));
    state.setStatusMessage("Closed merge modal.");
  }

  function closeCleanupModal(): void {
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "cleanup", "dismiss"));
    state.setCleanupCandidates([]);
    state.setStatusMessage("Skipped post-merge cleanup.");
  }

  function closeClearReviewedModal(): void {
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "clear-reviewed", "dismiss"),
    );
    state.setStatusMessage("Canceled clearing review marks.");
  }

  function closeHelpModal(): void {
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "help", "dismiss"));
    state.setStatusMessage("Closed help.");
  }

  function setAllBranchFilters(enabled: boolean): void {
    state.setBranchListFilters({
      workingTree: enabled,
      localBranch: enabled,
      openPr: enabled,
      remoteBranch: enabled,
    });
    state.setStatusMessage(enabled ? "Enabled all list filters." : "Disabled all list filters.");
  }

  function updateMergeMethod(delta: number): void {
    const nextMethod = getMergeMethod(getMergeMethodIndex(state.mergeMethod) + delta);
    state.setMergeMethod(nextMethod);
    void persistenceApi.persistGitHubPreferences({
      ...state.gitHubPreferencesRef.current,
      defaultMergeMethod: nextMethod,
    });
    state.setStatusMessage(`Default merge method set to ${nextMethod}.`);
  }

  function moveListSelection(delta: number): void {
    switch (activeKeymapMode) {
      case "commands":
        state.setCommandIndex((currentIndex) =>
          clampIndex(currentIndex + delta, filteredCommands.length),
        );
        return;
      case "pull-request-list":
      case "pull-request-search":
        state.setPullRequestListIndex((currentIndex) =>
          clampIndex(currentIndex + delta, derived.filteredPullRequests.length),
        );
        return;
      case "compare-branches":
        state.setBranchListIndex((currentIndex) =>
          clampIndex(currentIndex + delta, derived.branchItems.length),
        );
        return;
      case "compare-commits":
      case "commit-search":
        state.setCommitListIndex((currentIndex) =>
          clampIndex(currentIndex + delta, derived.filteredCommitItems.length),
        );
        return;
      case "filters":
        state.setFilterIndex((currentIndex) =>
          clampIndex(currentIndex + delta, LIST_FILTER_KEYS.length),
        );
        return;
      case "conversation":
        state.setPullRequestConversationIndex((currentIndex) =>
          clampIndex(currentIndex + delta, derived.pullRequestConversationItems.length),
        );
        return;
      case "submit-review": {
        reviewInputControllers.reviewSubmission.move(delta);
        return;
      }
      case "comment": {
        reviewInputControllers.reviewComposer.move(delta);
        return;
      }
      case "merge-method":
        updateMergeMethod(delta);
        return;
      case "cleanup":
        state.setCleanupCandidateIndex((currentIndex) => clampIndex(currentIndex + delta, 2));
        return;
      case "diagnostics":
        moveDiagnosticSelection(delta);
        return;
    }
  }

  function jumpListSelection(edge: "first" | "last"): void {
    switch (activeKeymapMode) {
      case "commands":
        state.setCommandIndex(edge === "first" ? 0 : Math.max(filteredCommands.length - 1, 0));
        return;
      case "pull-request-list":
      case "pull-request-search":
        state.setPullRequestListIndex(
          edge === "first" ? 0 : Math.max(derived.filteredPullRequests.length - 1, 0),
        );
        return;
      case "compare-branches":
        state.setBranchListIndex(
          edge === "first" ? 0 : Math.max(derived.branchItems.length - 1, 0),
        );
        return;
      case "compare-commits":
      case "commit-search":
        state.setCommitListIndex(
          edge === "first" ? 0 : Math.max(derived.filteredCommitItems.length - 1, 0),
        );
        return;
      case "filters":
        state.setFilterIndex(edge === "first" ? 0 : Math.max(LIST_FILTER_KEYS.length - 1, 0));
        return;
      case "diagnostics":
        if (edge === "first") {
          jumpToFirstDiagnostic();
        } else {
          jumpToLastDiagnostic();
        }
        return;
    }
  }

  function dismissCurrentMode(): void {
    switch (activeKeymapMode) {
      case "commands":
        closeCommandModal();
        return;
      case "pull-request-list":
        closePullRequestList();
        return;
      case "pull-request-search":
        textInputControllers.pullRequestSearch.reset();
        textInputControllers.pullRequestSearch.deactivate();
        return;
      case "compare-branches":
      case "compare-commits":
        closeBranchModal();
        return;
      case "commit-search":
        textInputControllers.commitSearch.reset();
        textInputControllers.commitSearch.deactivate();
        return;
      case "filters":
        closeListFilters();
        return;
      case "comment":
        if (reviewInputControllers.reviewComposer.dismissAutocomplete()) {
          return;
        }

        closeCommentComposer();
        return;
      case "conversation":
        closePullRequestConversation();
        return;
      case "submit-review":
        closeSubmitReviewModal();
        return;
      case "merge-method":
      case "merge-title":
      case "merge-body":
        closeMergeModal();
        return;
      case "confirm-merge":
        state.setMergeConfirmOpen(false);
        state.setStatusMessage("Returned to the merge form.");
        return;
      case "cleanup":
        closeCleanupModal();
        return;
      case "clear-reviewed":
        closeClearReviewedModal();
        return;
      case "diagnostics":
        closeDiagnostics();
        return;
    }
  }

  function acceptCurrentSelection(): void {
    switch (activeKeymapMode) {
      case "pull-request-list":
        if (derived.selectedPullRequest != null) {
          void applyDashboardPullRequestSelection(derived.selectedPullRequest);
        }
        return;
      case "pull-request-search":
        state.setPullRequestSearchActive(false);
        return;
      case "compare-branches":
        if (
          derived.selectedBranchItem?.kind === "open-pr" &&
          derived.selectedBranchItem.branch != null
        ) {
          void applyPullRequestSelection(derived.selectedBranchItem.branch);
        }
        return;
      case "commit-search":
        state.setCommitSearchActive(false);
        return;
      case "comment":
        acceptReviewComposerSelection();
        return;
    }
  }

  function backspaceText(): void {
    switch (activeKeymapMode) {
      case "commands":
        textInputControllers.commandPalette.backspace();
        return;
      case "pull-request-search":
        textInputControllers.pullRequestSearch.backspace();
        return;
      case "commit-search":
        textInputControllers.commitSearch.backspace();
        return;
      case "comment":
        reviewInputControllers.reviewComposer.backspace();
        return;
      case "submit-review":
        reviewInputControllers.reviewSubmission.backspace();
        return;
      case "merge-title":
        reviewInputControllers.mergeMessage.backspaceTitle();
        return;
      case "merge-body":
        reviewInputControllers.mergeMessage.backspaceBody();
        return;
    }
  }

  function insertNewline(): void {
    switch (activeKeymapMode) {
      case "comment":
        reviewInputControllers.reviewComposer.insertNewline();
        return;
      case "submit-review":
        reviewInputControllers.reviewSubmission.insertNewline();
        return;
      case "merge-body":
        reviewInputControllers.mergeMessage.insertBodyNewline();
        return;
    }
  }

  map.set(A.LIST_MOVE_DOWN, (count) => {
    moveListSelection(count ?? 1);
  });

  map.set(A.LIST_MOVE_UP, (count) => {
    moveListSelection(-(count ?? 1));
  });

  map.set(A.LIST_FIRST, () => {
    jumpListSelection("first");
  });

  map.set(A.LIST_LAST, () => {
    jumpListSelection("last");
  });

  map.set(A.LIST_PAGE_DOWN, () => {
    if (activeKeymapMode === "commands") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex + 10, filteredCommands.length),
      );
    }
  });

  map.set(A.LIST_PAGE_UP, () => {
    if (activeKeymapMode === "commands") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex - 10, filteredCommands.length),
      );
    }
  });

  map.set(A.LIST_ACCEPT, () => {
    acceptCurrentSelection();
  });

  map.set(A.MODAL_DISMISS, () => {
    dismissCurrentMode();
  });

  map.set(A.TEXT_BACKSPACE, () => {
    backspaceText();
  });

  map.set(A.TEXT_NEWLINE, () => {
    insertNewline();
  });

  map.set(A.TEXT_OPEN_EXTERNAL_EDITOR, () => {
    switch (activeKeymapMode) {
      case "comment":
        void reviewInputControllers.reviewComposer.openExternalEditor();
        return;
      case "submit-review":
        void reviewInputControllers.reviewSubmission.openExternalEditor();
        return;
      case "merge-title":
      case "merge-body":
        void reviewInputControllers.mergeMessage.openExternalEditor();
        return;
    }
  });

  map.set(A.COMMAND_PALETTE_RUN, () => {
    const command = filteredCommands[clampIndex(state.commandIndex, filteredCommands.length)];
    if (command != null) {
      runCommand(command);
    }
  });

  map.set(A.BRANCH_SWITCH_TAB, () => {
    state.setActiveListView((currentView) => (currentView === "branch" ? "commit" : "branch"));
    textInputControllers.commitSearch.deactivate();
  });

  map.set(A.BRANCH_GO_TO_BRANCHES, () => {
    state.setActiveListView("branch");
    textInputControllers.commitSearch.deactivate();
  });

  map.set(A.BRANCH_GO_TO_COMMITS, () => {
    state.setActiveListView("commit");
    textInputControllers.commitSearch.deactivate();
  });

  map.set(A.BRANCH_OPEN_FILTERS, () => {
    state.setFilterIndex(0);
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "list-filter"));
    state.setStatusMessage("Opened list filters.");
  });

  map.set(A.BRANCH_TOGGLE_REMOTE, () => {
    toggleBranchFilter("remoteBranch");
  });

  map.set(A.BRANCH_SELECT_HEAD, () => {
    if (activeKeymapMode === "compare-branches") {
      if (derived.selectedBranchItem?.kind === "working-tree") {
        void applyWorkingTreeSelection();
      } else if (derived.selectedBranchItem?.branch != null) {
        void applyBranchSelection("head", derived.selectedBranchItem.branch);
      }
      return;
    }

    if (activeKeymapMode === "compare-commits" && derived.selectedCommitItem != null) {
      void applyCommitSelection(
        "head",
        derived.selectedCommitItem.commit.sha,
        derived.selectedCommitItem.commit.shortSha,
      );
    }
  });

  map.set(A.BRANCH_SELECT_BASE, () => {
    if (activeKeymapMode === "compare-branches") {
      if (derived.selectedBranchItem?.kind === "working-tree") {
        void applyWorkingTreeSelection();
      } else if (derived.selectedBranchItem?.branch != null) {
        void applyBranchSelection("base", derived.selectedBranchItem.branch);
      }
      return;
    }

    if (activeKeymapMode === "compare-commits" && derived.selectedCommitItem != null) {
      void applyCommitSelection(
        "base",
        derived.selectedCommitItem.commit.sha,
        derived.selectedCommitItem.commit.shortSha,
      );
    }
  });

  map.set(A.BRANCH_SELECT_WORKING_TREE, () => {
    void applyWorkingTreeSelection();
  });

  map.set(A.BRANCH_SEARCH, () => {
    textInputControllers.commitSearch.activate();
  });

  map.set(A.PR_LIST_REFRESH, () => {
    void refreshGitHubPullRequestList();
  });

  map.set(A.PR_LIST_SEARCH, () => {
    textInputControllers.pullRequestSearch.activate();
  });

  map.set(A.FILTER_TOGGLE, () => {
    const filterKey = LIST_FILTER_KEYS[state.filterIndex];
    if (filterKey != null) {
      toggleBranchFilter(filterKey);
    }
  });

  map.set(A.FILTER_ENABLE_ALL, () => {
    setAllBranchFilters(true);
  });

  map.set(A.FILTER_DISABLE_ALL, () => {
    setAllBranchFilters(false);
  });

  map.set(A.CONVERSATION_REPLY, () => {
    openPullRequestConversationReplyComposer();
  });

  map.set(A.CONVERSATION_COPY_URL, () => {
    void copySelectedPullRequestConversationItemUrl();
  });

  map.set(A.SUBMIT_REVIEW_SUBMIT, () => {
    void submitReviewFromModal();
  });

  map.set(A.MERGE_NEXT_FIELD, () => {
    reviewInputControllers.mergeMessage.cycleField();
  });

  map.set(A.MERGE_CONFIRM, () => {
    if (activeKeymapMode === "confirm-merge") {
      void submitMergeFromModal();
      return;
    }

    openMergeConfirmModal();
  });

  map.set(A.CLEANUP_TOGGLE_OPTION, () => {
    const nextKey = state.cleanupCandidateIndex === 0 ? "removeLocal" : "removeRemote";
    const hasCandidate = state.cleanupCandidates.some((candidate) =>
      nextKey === "removeLocal"
        ? candidate.kind === "local-branch"
        : candidate.kind === "remote-tracking",
    );
    if (!hasCandidate) {
      return;
    }

    persistenceApi.updateCleanupSelection((currentSelection) => ({
      ...currentSelection,
      [nextKey]: !currentSelection[nextKey],
    }));
  });

  map.set(A.CLEANUP_APPLY, () => {
    void applyCleanupSelection();
  });

  map.set(A.CLEAR_REVIEWED_CONFIRM, () => {
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "clear-reviewed", "complete"),
    );
    clearReviewed();
  });

  map.set(A.HELP_DISMISS, () => {
    closeHelpModal();
  });

  return map;
}
