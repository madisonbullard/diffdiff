import type { KeyboardInput } from "../commands.ts";
import { clampIndex } from "../view-model.ts";
import { closeDialog as closeAppDialog } from "./dialog-stack.ts";
import { getMergeMethod, getMergeMethodIndex } from "../review/formatting.ts";
import type { DiffdiffAppState } from "./diffdiff-app-state.ts";

interface CreateReviewModalHandlersOptions {
  applyCleanupSelection: () => Promise<void>;
  copySelectedPullRequestConversationItemUrl: () => Promise<void>;
  handleTextInputLeaderKey: (
    key: KeyboardInput,
    options?: { onLeaderDown?: () => void; onLeaderUp?: () => void },
  ) => boolean;
  openMergeConfirmModal: () => void;
  openPullRequestConversationReplyComposer: () => void;
  persistence: import("./diffdiff-app-persistence.ts").DiffdiffAppPersistence;
  state: DiffdiffAppState;
  submitCommentComposer: () => Promise<void>;
  submitMergeFromModal: () => Promise<void>;
  submitReviewFromModal: () => Promise<void>;
}

export function createReviewModalHandlers({
  applyCleanupSelection,
  copySelectedPullRequestConversationItemUrl,
  handleTextInputLeaderKey,
  openMergeConfirmModal,
  openPullRequestConversationReplyComposer,
  persistence,
  state,
  submitCommentComposer,
  submitMergeFromModal,
  submitReviewFromModal,
}: CreateReviewModalHandlersOptions) {
  function handleCommentComposerKey(key: KeyboardInput): void {
    if (handleTextInputLeaderKey(key)) {
      return;
    }

    if (key.name === "escape") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "comment-composer", "dismiss"),
      );
      state.setReviewComposerTarget(null);
      state.setReviewComposerBody("");
      state.setStatusMessage("Closed comment composer.");
      return;
    }

    if (key.name === "backspace") {
      state.setReviewComposerBody((currentBody) => currentBody.slice(0, -1));
      return;
    }

    if (key.name === "return" && key.shift) {
      state.setReviewComposerBody((currentBody) => `${currentBody}\n`);
      return;
    }

    if (key.name === "return") {
      void submitCommentComposer();
      return;
    }

    if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
      state.setReviewComposerBody((currentBody) => currentBody + key.sequence);
    }
  }

  function handlePullRequestCommentsModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q" || key.name === "t") {
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "comments", "dismiss"));
      state.setStatusMessage("Closed PR conversation.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      state.setPullRequestConversationIndex((currentIndex) =>
        clampIndex(
          currentIndex + 1,
          state.session.github?.pullRequest.conversationItems.length ?? 0,
        ),
      );
      return;
    }

    if (key.name === "k" || key.name === "up") {
      state.setPullRequestConversationIndex((currentIndex) =>
        clampIndex(
          currentIndex - 1,
          state.session.github?.pullRequest.conversationItems.length ?? 0,
        ),
      );
      return;
    }

    if (key.name === "r") {
      openPullRequestConversationReplyComposer();
      return;
    }

    if (key.name === "y") {
      void copySelectedPullRequestConversationItemUrl();
    }
  }

  function handleSubmitReviewModalKey(key: KeyboardInput): void {
    if (
      handleTextInputLeaderKey(key, {
        onLeaderDown: () => {
          state.setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex + 1, 3));
        },
        onLeaderUp: () => {
          state.setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex - 1, 3));
        },
      })
    ) {
      return;
    }

    if (key.name === "escape") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "submit-review", "dismiss"),
      );
      state.setReviewSubmissionBody("");
      state.setStatusMessage("Closed submit review modal.");
      return;
    }

    if (key.name === "down") {
      state.setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex + 1, 3));
      return;
    }

    if (key.name === "up") {
      state.setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex - 1, 3));
      return;
    }

    if (key.name === "backspace") {
      state.setReviewSubmissionBody((currentBody) => currentBody.slice(0, -1));
      return;
    }

    if (key.name === "return" && key.shift) {
      state.setReviewSubmissionBody((currentBody) => `${currentBody}\n`);
      return;
    }

    if (key.name === "return") {
      void submitReviewFromModal();
      return;
    }

    if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
      state.setReviewSubmissionBody((currentBody) => currentBody + key.sequence);
    }
  }

  function handleMergeConfirmModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q") {
      state.setMergeConfirmOpen(false);
      state.setStatusMessage("Returned to the merge form.");
      return;
    }

    if (key.name === "return") {
      void submitMergeFromModal();
    }
  }

  function handleMergeModalKey(key: KeyboardInput): void {
    if (state.mergeConfirmOpen) {
      handleMergeConfirmModalKey(key);
      return;
    }

    if (
      (state.mergeModalField === "title" || state.mergeModalField === "body") &&
      handleTextInputLeaderKey(key)
    ) {
      return;
    }

    if (key.name === "escape") {
      state.setMergeConfirmOpen(false);
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "merge", "dismiss"));
      state.setStatusMessage("Closed merge modal.");
      return;
    }

    if (key.name === "tab") {
      state.setMergeModalField((currentField) => {
        switch (currentField) {
          case "method":
            return "title";
          case "title":
            return "body";
          case "body":
            return "method";
        }
      });
      return;
    }

    if (state.mergeModalField === "method") {
      if (key.name === "j" || key.name === "down" || key.name === "k" || key.name === "up") {
        const delta = key.name === "j" || key.name === "down" ? 1 : -1;
        const nextMethod = getMergeMethod(getMergeMethodIndex(state.mergeMethod) + delta);
        state.setMergeMethod(nextMethod);
        void persistence.persistenceApi.persistGitHubPreferences({
          ...state.gitHubPreferencesRef.current,
          defaultMergeMethod: nextMethod,
        });
        state.setStatusMessage(`Default merge method set to ${nextMethod}.`);
      }
      if (key.name === "return") {
        openMergeConfirmModal();
      }
      return;
    }

    if (state.mergeModalField === "title") {
      if (key.name === "backspace") {
        state.setMergeCommitTitle((currentTitle) => currentTitle.slice(0, -1));
        return;
      }

      if (key.name === "return") {
        openMergeConfirmModal();
        return;
      }

      if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
        state.setMergeCommitTitle((currentTitle) => currentTitle + key.sequence);
      }
      return;
    }

    if (key.name === "backspace") {
      state.setMergeCommitMessage((currentBody) => currentBody.slice(0, -1));
      return;
    }

    if (key.name === "return" && key.shift) {
      state.setMergeCommitMessage((currentBody) => `${currentBody}\n`);
      return;
    }

    if (key.name === "return") {
      openMergeConfirmModal();
      return;
    }

    if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
      state.setMergeCommitMessage((currentBody) => currentBody + key.sequence);
    }
  }

  function handleCleanupModalKey(key: KeyboardInput): void {
    const entryCount = 2;

    if (key.name === "escape") {
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "cleanup", "dismiss"));
      state.setCleanupCandidates([]);
      state.setStatusMessage("Skipped post-merge cleanup.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      state.setCleanupCandidateIndex((currentIndex) => clampIndex(currentIndex + 1, entryCount));
      return;
    }

    if (key.name === "k" || key.name === "up") {
      state.setCleanupCandidateIndex((currentIndex) => clampIndex(currentIndex - 1, entryCount));
      return;
    }

    if (key.name === "space") {
      const nextKey = state.cleanupCandidateIndex === 0 ? "removeLocal" : "removeRemote";
      const hasCandidate = state.cleanupCandidates.some((candidate) =>
        nextKey === "removeLocal"
          ? candidate.kind === "local-branch"
          : candidate.kind === "remote-tracking",
      );
      if (!hasCandidate) {
        return;
      }

      persistence.persistenceApi.updateCleanupSelection((currentSelection) => ({
        ...currentSelection,
        [nextKey]: !currentSelection[nextKey],
      }));
      return;
    }

    if (key.name === "return") {
      void applyCleanupSelection();
    }
  }

  return {
    handleCleanupModalKey,
    handleCommentComposerKey,
    handleMergeModalKey,
    handlePullRequestCommentsModalKey,
    handleSubmitReviewModalKey,
  };
}
