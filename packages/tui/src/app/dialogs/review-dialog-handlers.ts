import type { KeyboardInput } from "../../commands.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { createCleanupKeyHandler } from "../review/handlers/cleanup-keymap.ts";
import { createCommentComposerKeyHandler } from "../review/handlers/comment-composer-keymap.ts";
import { createConversationKeyHandler } from "../review/handlers/conversation-keymap.ts";
import { createMergeKeyHandler } from "../review/handlers/merge-keymap.ts";
import { createSubmitReviewKeyHandler } from "../review/handlers/submit-review-keymap.ts";

interface CreateReviewModalHandlersOptions {
  applyCleanupSelection: () => Promise<void>;
  copySelectedPullRequestConversationItemUrl: () => Promise<void>;
  handleTextInputLeaderKey: (
    key: KeyboardInput,
    options?: { onLeaderDown?: () => void; onLeaderUp?: () => void },
  ) => boolean;
  openMergeConfirmModal: () => void;
  openPullRequestConversationReplyComposer: () => void;
  persistence: import("../session/use-app-persistence.ts").DiffdiffAppPersistence;
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
  const handleCommentComposerKey = createCommentComposerKeyHandler({
    handleTextInputLeaderKey,
    state,
    submitCommentComposer,
  });
  const handlePullRequestCommentsModalKey = createConversationKeyHandler({
    copySelectedPullRequestConversationItemUrl,
    openPullRequestConversationReplyComposer,
    state,
  });
  const handleSubmitReviewModalKey = createSubmitReviewKeyHandler({
    handleTextInputLeaderKey,
    state,
    submitReviewFromModal,
  });
  const handleMergeModalKey = createMergeKeyHandler({
    handleTextInputLeaderKey,
    openMergeConfirmModal,
    persistence,
    state,
    submitMergeFromModal,
  });
  const handleCleanupModalKey = createCleanupKeyHandler({
    applyCleanupSelection,
    persistence,
    state,
  });

  return {
    handleCleanupModalKey,
    handleCommentComposerKey,
    handleMergeModalKey,
    handlePullRequestCommentsModalKey,
    handleSubmitReviewModalKey,
  };
}
