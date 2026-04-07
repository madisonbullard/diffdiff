import { closeDialog as closeAppDialog, openDialog as openAppDialog } from "../dialogs/stack.ts";
import { getReviewSubmissionEvent } from "../../review/formatting.ts";
import { formatThreadAnchor } from "../../review/threads.tsx";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { clearReviewComposer } from "./review-composer-state.ts";
import { buildQuotedPullRequestReply } from "./review-composer.ts";
import type { ReviewComposerTarget } from "./review-composer.ts";
import { createTextInputState } from "../text-input/input-state.ts";
import {
  buildOptimisticMergeOperation,
  buildOptimisticPullRequestCommentOperation,
  buildOptimisticReviewThreadOperation,
  buildOptimisticReviewThreadReplyOperation,
  buildOptimisticSubmittedReviewOperation,
  createGitHubOptimisticOperationController,
  toOptimisticPendingReviewRef,
} from "./optimistic-github-operations.ts";

interface CreateGitHubMutationActionsOptions {
  actions: {
    applyLoadedSession: (
      nextSession: import("../../types.ts").PreparedReviewSession,
      options?: {
        resetReviewState?: boolean;
        reviewCacheState?: import("@diffdiff/core").ReviewCacheState;
      },
    ) => void;
    beginSessionLoad: () => number;
    isLatestSessionLoad: (loadId: number) => boolean;
  };
  derived: DiffdiffAppDerived;
  persistence: DiffdiffAppPersistence;
  props: Pick<
    DiffdiffAppProps,
    | "addPullRequestComment"
    | "addReviewThread"
    | "loadSession"
    | "mergePullRequest"
    | "replyToReviewComment"
    | "removeCleanupRefs"
    | "submitPendingReview"
  >;
  persistSubmittedComment?: (body: string, target: ReviewComposerTarget) => Promise<void>;
  state: DiffdiffAppState;
}

export function createGitHubMutationActions({
  actions,
  derived,
  persistSubmittedComment,
  persistence,
  props,
  state,
}: CreateGitHubMutationActionsOptions) {
  const optimisticOperations = createGitHubOptimisticOperationController(state);

  async function submitCommentComposer(): Promise<void> {
    if (
      state.session.github == null ||
      state.reviewComposer.target == null ||
      state.reviewComposer.input.value.trim() === ""
    ) {
      return;
    }

    const reviewSession = state.session.github;
    const reviewComposerTarget = state.reviewComposer.target;
    const nextBody = state.reviewComposer.input.value.trim();

    if (reviewComposerTarget.kind === "review-thread" && props.addReviewThread == null) {
      return;
    }
    if (reviewComposerTarget.kind === "review-thread-reply" && props.replyToReviewComment == null) {
      return;
    }
    if (
      reviewComposerTarget.kind === "pull-request-comment-reply" &&
      props.addPullRequestComment == null
    ) {
      return;
    }

    const operationId = optimisticOperations.reserveId();
    let quotedBody: string | undefined;

    if (reviewComposerTarget.kind === "review-thread") {
      optimisticOperations.push(
        buildOptimisticReviewThreadOperation({
          anchor: reviewComposerTarget.anchor,
          body: nextBody,
          operationId,
          pendingReview: toOptimisticPendingReviewRef(
            derived.displaySession.github?.pullRequest.pendingReview,
          ),
          pullRequestUrl: reviewSession.pullRequest.url,
        }),
      );
    } else if (reviewComposerTarget.kind === "review-thread-reply") {
      optimisticOperations.push(
        buildOptimisticReviewThreadReplyOperation({
          body: nextBody,
          operationId,
          pullRequestUrl: reviewSession.pullRequest.url,
          rootCommentId: reviewComposerTarget.rootCommentId,
          thread: reviewComposerTarget.thread,
        }),
      );
    } else {
      quotedBody = buildQuotedPullRequestReply(reviewComposerTarget.item, nextBody);
      optimisticOperations.push(
        buildOptimisticPullRequestCommentOperation({
          body: quotedBody,
          operationId,
          pullRequestUrl: reviewSession.pullRequest.url,
        }),
      );
    }

    let mutationSucceeded = false;
    let sessionLoadId: number | undefined;
    state.setIsSubmittingReviewAction(true);

    try {
      if (reviewComposerTarget.kind === "review-thread") {
        state.setStatusMessage(
          `Adding review comment on ${reviewComposerTarget.anchor.path}:${reviewComposerTarget.anchor.line}...`,
        );
        await props.addReviewThread!(reviewSession, reviewComposerTarget.anchor, nextBody);
      } else if (reviewComposerTarget.kind === "review-thread-reply") {
        state.setStatusMessage(`Replying in ${formatThreadAnchor(reviewComposerTarget.thread)}...`);
        await props.replyToReviewComment!(
          reviewSession,
          reviewComposerTarget.rootCommentId,
          nextBody,
        );
      } else {
        state.setStatusMessage(`Replying to ${reviewComposerTarget.item.author.login}...`);
        await props.addPullRequestComment!(reviewSession, quotedBody!);
      }

      mutationSucceeded = true;
      void persistSubmittedComment?.(nextBody, reviewComposerTarget).catch(() => undefined);
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "comment-composer", "complete"),
      );
      state.setReviewComposer((currentReviewComposer) =>
        clearReviewComposer(currentReviewComposer),
      );
      state.setStatusMessage(
        reviewComposerTarget.kind === "review-thread"
          ? "Added review comment."
          : reviewComposerTarget.kind === "review-thread-reply"
            ? "Added review reply."
            : "Added PR reply comment.",
      );
      sessionLoadId = actions.beginSessionLoad();
      const nextSession = await props.loadSession(state.startupOptions);
      if (actions.isLatestSessionLoad(sessionLoadId)) {
        actions.applyLoadedSession(nextSession);
      }
    } catch (error) {
      if (sessionLoadId != null && !actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      if (!mutationSucceeded) {
        optimisticOperations.remove(operationId);
        persistence.persistenceApi.handleAppError(error, "Unable to submit the comment.", {
          action: reviewComposerTarget.kind,
        });
        return;
      }

      persistence.persistenceApi.handleAppError(
        error,
        "Added the comment, but unable to refresh the session.",
        {
          action: reviewComposerTarget.kind,
        },
      );
    } finally {
      state.setIsSubmittingReviewAction(false);
    }
  }

  async function submitReviewFromModal(): Promise<void> {
    if (state.session.github == null || props.submitPendingReview == null) {
      return;
    }

    const reviewSession = state.session.github;
    const event = getReviewSubmissionEvent(state.reviewSubmissionEventIndex);
    const nextBody =
      state.reviewSubmissionInput.value.trim() === ""
        ? undefined
        : state.reviewSubmissionInput.value.trim();
    const operationId = optimisticOperations.reserveId();

    optimisticOperations.push(
      buildOptimisticSubmittedReviewOperation({
        body: nextBody,
        event,
        operationId,
        pendingReview: toOptimisticPendingReviewRef(
          derived.displaySession.github?.pullRequest.pendingReview,
        ),
        pullRequestUrl: reviewSession.pullRequest.url,
      }),
    );
    state.setIsSubmittingReviewAction(true);
    state.setStatusMessage("Submitting review...");
    let mutationSucceeded = false;
    let sessionLoadId: number | undefined;
    try {
      await props.submitPendingReview(reviewSession, event, nextBody);
      mutationSucceeded = true;
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "submit-review", "complete"),
      );
      state.setReviewSubmissionInput(createTextInputState());
      state.setStatusMessage("Submitted review.");
      sessionLoadId = actions.beginSessionLoad();
      const nextSession = await props.loadSession(state.startupOptions);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      actions.applyLoadedSession(nextSession);
    } catch (error) {
      if (sessionLoadId != null && !actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }

      if (!mutationSucceeded) {
        optimisticOperations.remove(operationId);
        persistence.persistenceApi.handleAppError(error, "Unable to submit the review.", {
          action: "submit-review",
          event,
        });
        return;
      }

      persistence.persistenceApi.handleAppError(
        error,
        "Submitted the review, but unable to refresh the session.",
        {
          action: "submit-review",
          event,
        },
      );
    } finally {
      state.setIsSubmittingReviewAction(false);
    }
  }

  async function submitMergeFromModal(): Promise<void> {
    if (
      state.session.github == null ||
      props.mergePullRequest == null ||
      state.mergeMethod == null
    ) {
      return;
    }

    state.setMergeConfirmOpen(false);
    const reviewSession = state.session.github;
    const operationId = optimisticOperations.reserveId();

    optimisticOperations.push(buildOptimisticMergeOperation(operationId));
    state.setIsSubmittingReviewAction(true);
    state.setStatusMessage(`Merging pull request with ${state.mergeMethod}...`);
    let mergeSucceeded = false;
    let mergeResult:
      | Awaited<ReturnType<NonNullable<DiffdiffAppProps["mergePullRequest"]>>>
      | undefined;
    let sessionLoadId: number | undefined;
    try {
      mergeResult = await props.mergePullRequest(reviewSession, {
        commitMessage:
          state.mergeCommitMessageInput.value.trim() === ""
            ? undefined
            : state.mergeCommitMessageInput.value.trim(),
        commitTitle:
          state.mergeCommitTitleInput.value.trim() === ""
            ? undefined
            : state.mergeCommitTitleInput.value.trim(),
        comparison: state.session.comparison,
        method: state.mergeMethod,
      });
      mergeSucceeded = true;
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "merge", "complete"));
      state.setStatusMessage("Merged the pull request. Refreshing local refs...");
      sessionLoadId = actions.beginSessionLoad();
      const nextSession = await props.loadSession(state.startupOptions);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      actions.applyLoadedSession(nextSession);
      if (mergeResult.cleanupCandidates.length > 0) {
        state.setCleanupCandidateIndex(0);
        state.setCleanupCandidates(mergeResult.cleanupCandidates);
        state.setCleanupSelection(state.gitHubPreferencesRef.current.cleanup);
        state.setDialogStack((currentStack) =>
          openAppDialog(currentStack, "cleanup", { replace: true, triggeredBy: "merge" }),
        );
        state.setStatusMessage("Merged the pull request. Choose any stale refs to remove.");
      } else {
        state.setStatusMessage("Merged the pull request and refreshed local refs.");
      }
    } catch (error) {
      if (sessionLoadId != null && !actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }

      if (!mergeSucceeded) {
        optimisticOperations.remove(operationId);
        persistence.persistenceApi.handleAppError(error, "Unable to merge the pull request.", {
          action: "merge-pull-request",
          mergeMethod: state.mergeMethod,
          pullRequestNumber: state.session.github.pullRequest.number,
        });
        return;
      }

      if (mergeResult?.cleanupCandidates.length) {
        state.setCleanupCandidateIndex(0);
        state.setCleanupCandidates(mergeResult.cleanupCandidates);
        state.setCleanupSelection(state.gitHubPreferencesRef.current.cleanup);
        state.setDialogStack((currentStack) =>
          openAppDialog(currentStack, "cleanup", { clear: true, triggeredBy: "merge" }),
        );
      }

      persistence.persistenceApi.handleAppError(
        error,
        "Merged the pull request, but unable to refresh local refs.",
        {
          action: "merge-pull-request",
          mergeMethod: state.mergeMethod,
          pullRequestNumber: state.session.github.pullRequest.number,
        },
      );
    } finally {
      state.setIsSubmittingReviewAction(false);
    }
  }

  async function applyCleanupSelection(): Promise<void> {
    if (state.session.github == null || props.removeCleanupRefs == null) {
      return;
    }

    const refsToRemove = state.cleanupCandidates.filter((candidate) =>
      candidate.kind === "local-branch"
        ? state.cleanupSelection.removeLocal
        : state.cleanupSelection.removeRemote,
    );
    if (refsToRemove.length === 0) {
      return;
    }

    state.setIsSubmittingReviewAction(true);
    state.setStatusMessage("Removing selected refs...");
    const sessionLoadId = actions.beginSessionLoad();
    try {
      await props.removeCleanupRefs(state.session.repository.rootPath, refsToRemove);
      const nextSession = await props.loadSession(state.startupOptions);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      actions.applyLoadedSession(nextSession);
      state.setCleanupCandidates([]);
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "cleanup", "complete"));
      state.setStatusMessage("Removed selected refs and reloaded the current session.");
    } catch (error) {
      if (actions.isLatestSessionLoad(sessionLoadId)) {
        persistence.persistenceApi.handleAppError(error, "Unable to remove the selected refs.", {
          action: "remove-cleanup-refs",
          refsToRemove,
        });
      }
    } finally {
      state.setIsSubmittingReviewAction(false);
    }
  }

  return {
    applyCleanupSelection,
    submitCommentComposer,
    submitMergeFromModal,
    submitReviewFromModal,
  };
}
