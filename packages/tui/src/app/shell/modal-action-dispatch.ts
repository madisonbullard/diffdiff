/* eslint-disable max-lines */

import { clampIndex } from "../../view-model.ts";
import clipboard from "clipboardy";
import { keyRows } from "../../components/dialog/key-rows.ts";
import { getCleanupAfterMerge } from "@madisonbullard/diffdiff-core";
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
  closeReviewerPicker: () => void;
  moveReviewerSelection: (delta: number) => void;
  refreshReviewerCandidates: () => Promise<void>;
  submitReviewerRequests: () => Promise<void>;
  toggleReviewerSelection: (index?: number) => void;
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
  applyCommitSelection,
  applyDashboardPullRequestSelection,
  applyPullRequestSelection,
  applyWorkingTreeSelection,
  clearReviewed,
  closeCommandModal,
  closeCommentComposer: dismissCommentComposer,
  closeDiagnostics,
  closeReviewerPicker,
  moveReviewerSelection,
  refreshReviewerCandidates,
  submitReviewerRequests,
  toggleReviewerSelection,
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
  }

  function closePullRequestList(): void {
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "pull-request-list", "dismiss"),
    );
    textInputControllers.pullRequestSearch.reset();
    textInputControllers.pullRequestSearch.deactivate();
  }

  function closeListFilters(): void {
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "list-filter", "dismiss"));
  }

  function closeCommentComposer(): void {
    dismissCommentComposer();
  }

  function closePullRequestConversation(): void {
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "comments", "dismiss"));
  }

  function closeSubmitReviewModal(): void {
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "submit-review", "dismiss"),
    );
    reviewInputControllers.reviewSubmission.close();
  }

  function closeMergeModal(): void {
    reviewInputControllers.mergeMessage.close();
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "merge", "dismiss"));
  }

  function closeClearReviewedModal(): void {
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "clear-reviewed", "dismiss"),
    );
    state.setStatusMessage("Canceled clearing review marks.");
  }

  function closeHelpModal(): void {
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "help", "dismiss"));
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
    const methods = [
      ...(derived.displaySession.github?.pullRequest.merge.allowedMethods ?? []),
      "close" as const,
    ];
    const nextMethod = getMergeMethod(
      getMergeMethodIndex(state.mergeMethod, methods) + delta,
      methods,
    );
    if (nextMethod == null) return;
    state.setMergeMethod(nextMethod);
    if (nextMethod === "close") {
      state.setMergeAutoMerge(false);
      return;
    }
    void persistenceApi.persistGitHubPreferences({
      ...state.gitHubPreferencesRef.current,
      defaultMergeMethod: nextMethod,
    });
    state.setStatusMessage(`Default merge method set to ${nextMethod}.`);
  }

  function moveListSelection(delta: number): void {
    if (
      state.inspectorDetailFocused &&
      ["checks", "conversation", "diagnostics"].includes(activeKeymapMode)
    ) {
      state.checksDetailScrollRef.current?.scrollBy(delta);
      return;
    }
    switch (activeKeymapMode) {
      case "help":
        state.setCommandIndex((index) =>
          clampIndex(
            index + delta,
            keyRows(state.reverseKeymaps, state.commandInput.value, state.helpLeaderOnly).length,
          ),
        );
        return;
      case "checks":
        state.setChecksIndex((index) =>
          clampIndex(
            index + delta,
            derived.displaySession.github?.pullRequest.checks.items?.length ?? 0,
          ),
        );
        return;
      case "reviewer-picker":
        moveReviewerSelection(delta);
        return;
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
        if (activeKeymapMode === "commit-search" && state.activeListView === "branch")
          state.setBranchListIndex((index) =>
            clampIndex(index + delta, derived.branchItems.length),
          );
        else
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
      case "diagnostics":
        moveDiagnosticSelection(delta);
        return;
    }
  }

  function jumpListSelection(edge: "first" | "last"): void {
    switch (activeKeymapMode) {
      case "help":
        state.setCommandIndex(
          edge === "first"
            ? 0
            : Math.max(
                0,
                keyRows(state.reverseKeymaps, state.commandInput.value, state.helpLeaderOnly)
                  .length - 1,
              ),
        );
        return;
      case "reviewer-picker":
        moveReviewerSelection(
          edge === "first" ? -Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER,
        );
        return;
      case "conversation":
        state.setPullRequestConversationIndex(
          edge === "first" ? 0 : Math.max(derived.pullRequestConversationItems.length - 1, 0),
        );
        return;
      case "checks":
        state.setChecksIndex(
          edge === "first"
            ? 0
            : Math.max(
                (derived.displaySession.github?.pullRequest.checks.items?.length ?? 0) - 1,
                0,
              ),
        );
        return;
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
        if (activeKeymapMode === "commit-search" && state.activeListView === "branch")
          state.setBranchListIndex(
            edge === "first" ? 0 : Math.max(derived.branchItems.length - 1, 0),
          );
        else
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
      case "checks":
        state.setDialogStack((stack) => closeAppDialog(stack, "checks"));
        return;
      case "reviewer-picker":
        closeReviewerPicker();
        return;
      case "commands":
        closeCommandModal();
        return;
      case "pull-request-list":
        closePullRequestList();
        return;
      case "pull-request-search":
        closePullRequestList();
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
      case "reviewer-picker":
        toggleReviewerSelection();
        return;
      case "pull-request-list":
      case "pull-request-search":
        if (derived.selectedPullRequest != null) {
          void applyDashboardPullRequestSelection(derived.selectedPullRequest);
        }
        return;
      case "compare-branches":
        if (
          derived.selectedBranchItem?.kind === "open-pr" &&
          derived.selectedBranchItem.branch != null
        ) {
          void applyPullRequestSelection(derived.selectedBranchItem.branch);
        } else if (derived.selectedBranchItem?.kind === "working-tree") {
          void applyWorkingTreeSelection();
        } else if (derived.selectedBranchItem?.branch != null) {
          void applyBranchSelection("head", derived.selectedBranchItem.branch);
        }
        return;
      case "compare-commits":
        if (derived.selectedCommitItem != null)
          void applyCommitSelection(
            "head",
            derived.selectedCommitItem.commit.sha,
            derived.selectedCommitItem.commit.shortSha,
          );
        return;
      case "commit-search":
        if (state.activeListView === "branch") {
          if (derived.selectedBranchItem?.kind === "open-pr" && derived.selectedBranchItem.branch)
            void applyPullRequestSelection(derived.selectedBranchItem.branch);
          else if (derived.selectedBranchItem?.branch)
            void applyBranchSelection("head", derived.selectedBranchItem.branch);
          else if (derived.selectedBranchItem?.kind === "working-tree")
            void applyWorkingTreeSelection();
        } else if (derived.selectedCommitItem)
          void applyCommitSelection(
            "head",
            derived.selectedCommitItem.commit.sha,
            derived.selectedCommitItem.commit.shortSha,
          );
        return;
      case "comment":
        acceptReviewComposerSelection();
        return;
    }
  }

  function backspaceText(): void {
    switch (activeKeymapMode) {
      case "help":
        textInputControllers.commandPalette.backspace();
        return;
      case "reviewer-picker":
        textInputControllers.reviewerSearch.backspace();
        return;
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
  map.set(A.INSPECTOR_FOCUS, () => state.setInspectorDetailFocused((focused) => !focused));

  map.set(A.CHECKS_COPY_URL, async () => {
    const items = derived.displaySession.github?.pullRequest.checks.items ?? [];
    const url = items[clampIndex(state.checksIndex, items.length)]?.url;
    if (url == null) {
      state.setStatusMessage("No details link is available for this check.");
      return;
    }
    try {
      await clipboard.write(url);
      persistenceApi.showToast("Copied check URL");
    } catch (error) {
      persistenceApi.handleAppError(error, "Unable to copy check URL.", {
        action: "copy-check-url",
      });
    }
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
    moveListSelection(Math.max(1, state.terminalDimensions.height - 10));
  });

  map.set(A.LIST_PAGE_UP, () => {
    moveListSelection(-Math.max(1, state.terminalDimensions.height - 10));
  });

  map.set(A.LIST_ACCEPT, () => {
    acceptCurrentSelection();
  });
  map.set(A.REVIEWERS_SUBMIT, () => {
    void submitReviewerRequests();
  });
  map.set(A.REVIEWERS_TOGGLE_AT, (index) => toggleReviewerSelection(index ?? undefined));
  map.set(A.REVIEWERS_REFRESH, () => {
    void refreshReviewerCandidates();
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
  map.set(A.TEXT_ACCEPT_COMPLETION, () => {
    reviewInputControllers.reviewComposer.acceptAutocomplete();
  });
  map.set(A.REVIEW_SWITCH_FIELD, () =>
    state.setReviewSubmissionField((field) => (field === "event" ? "body" : "event")),
  );

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
  map.set(A.COMMANDS_SWITCH_TAB, () => {
    state.setCommandIndex(0);
    state.setDialogStack((stack) =>
      openAppDialog(stack, activeKeymapMode === "help" ? "command-palette" : "help", {
        replace: true,
      }),
    );
  });
  map.set(A.MERGE_TOGGLE_CLEANUP, () => {
    if (state.mergeAutoMerge || state.mergeMethod === "close") return;
    const current = state.gitHubPreferencesRef.current;
    const afterMerge = !getCleanupAfterMerge(current.cleanup);
    void persistenceApi.persistGitHubPreferences({
      ...current,
      cleanup: { afterMerge },
    });
  });
  map.set(A.MERGE_PREVIOUS_FIELD, () => {
    if (state.mergeMethod === "close") return;
    state.setMergeModalField((field) =>
      field === "body" ? "title" : field === "title" ? "method" : "body",
    );
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
  map.set(A.MERGE_TOGGLE_AUTO, () => {
    if (state.mergeMethod === "close") return;
    const pr = derived.displaySession.github?.pullRequest;
    if (
      state.isSubmittingReviewAction ||
      pr == null ||
      !pr.merge.autoMergeAllowed ||
      pr.merge.autoMergeEnabled ||
      pr.isDraft ||
      pr.isMerged ||
      pr.state !== "open"
    )
      return;
    state.setMergeAutoMerge((current) => !current);
  });

  map.set(A.MERGE_CONFIRM, () => {
    if (activeKeymapMode === "confirm-merge") {
      void submitMergeFromModal();
      return;
    }

    openMergeConfirmModal();
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
