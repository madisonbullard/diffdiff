import type { KeyboardInput } from "../../commands.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { createClearReviewedKeyHandler } from "../review/handlers/clear-reviewed-keymap.ts";
import { createCleanupKeyHandler } from "../review/handlers/cleanup-keymap.ts";
import { createCommentComposerKeyHandler } from "../review/handlers/comment-composer-keymap.ts";
import { createConversationKeyHandler } from "../review/handlers/conversation-keymap.ts";
import { createMergeKeyHandler } from "../review/handlers/merge-keymap.ts";
import { createSubmitReviewKeyHandler } from "../review/handlers/submit-review-keymap.ts";

interface CreateReviewModalHandlersOptions {
  applyCleanupSelection: () => Promise<void>;
  clearReviewed: () => void;
  copySelectedPullRequestConversationItemUrl: () => Promise<void>;
  handleTextInputPrefixKeypress: (
    key: KeyboardInput,
    options?: { onPrefixDown?: () => void; onPrefixUp?: () => void },
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
  clearReviewed,
  copySelectedPullRequestConversationItemUrl,
  handleTextInputPrefixKeypress,
  openMergeConfirmModal,
  openPullRequestConversationReplyComposer,
  persistence,
  state,
  submitCommentComposer,
  submitMergeFromModal,
  submitReviewFromModal,
}: CreateReviewModalHandlersOptions) {
  const handleClearReviewedModalKey = createClearReviewedKeyHandler({
    clearReviewed,
    state,
  });
  const handleCommentComposerKey = createCommentComposerKeyHandler({
    handleTextInputPrefixKeypress,
    state,
    submitCommentComposer,
  });
  const handlePullRequestCommentsModalKey = createConversationKeyHandler({
    copySelectedPullRequestConversationItemUrl,
    openPullRequestConversationReplyComposer,
    state,
  });
  const handleSubmitReviewModalKey = createSubmitReviewKeyHandler({
    handleTextInputPrefixKeypress,
    state,
    submitReviewFromModal,
  });
  const handleMergeModalKey = createMergeKeyHandler({
    handleTextInputPrefixKeypress,
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
    handleClearReviewedModalKey,
    handleCleanupModalKey,
    handleCommentComposerKey,
    handleMergeModalKey,
    handlePullRequestCommentsModalKey,
    handleSubmitReviewModalKey,
  };
}
