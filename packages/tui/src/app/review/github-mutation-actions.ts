import { closeDialog as closeAppDialog } from "../dialogs/stack.ts";
import { formDraftKey } from "./form-drafts.ts";
import { cleanMergedRefs } from "./merge-cleanup.ts";
import { submitClosePullRequest } from "./close-pull-request.ts";
import { mutationErrorOptions } from "./mutation-errors.ts";
import { getCleanupAfterMerge } from "@madisonbullard/diffdiff-core";
import { canSubmitMerge } from "../../review/merge-eligibility.ts";
import { getReviewSubmissionEvent } from "../../review/formatting.ts";
import { formatThreadAnchor } from "../../review/threads.tsx";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { buildQuotedPullRequestReply } from "./review-composer.ts";
import type { ReviewComposerTarget } from "./review-composer.ts";
import type { ReviewInputControllers } from "./review-input-controllers.ts";
import {
  buildOptimisticMergeOperation,
  buildOptimisticPullRequestCommentOperation,
  buildOptimisticReviewThreadOperation,
  buildOptimisticReviewThreadReplyOperation,
  buildOptimisticSubmittedReviewOperation,
  createGitHubOptimisticOperationController,
  toOptimisticPendingReviewRef,
} from "./optimistic-github-operations.ts";

export interface CreateGitHubMutationActionsOptions {
  actions: {
    applyLoadedSession: (
      nextSession: import("../../types.ts").PreparedReviewSession,
      options?: {
        resetReviewState?: boolean;
        reviewCacheState?: import("@madisonbullard/diffdiff-core").ReviewCacheState;
      },
    ) => void;
    beginSessionLoad: () => number;
    isLatestSessionLoad: (loadId: number) => boolean;
  };
  controllers: ReviewInputControllers;
  derived: DiffdiffAppDerived;
  persistence: DiffdiffAppPersistence;
  props: Pick<
    DiffdiffAppProps,
    | "addPullRequestComment"
    | "addReviewThread"
    | "loadSession"
    | "mergePullRequest"
    | "closePullRequest"
    | "setPullRequestDraft"
    | "replyToReviewComment"
    | "removeCleanupRefs"
    | "submitPendingReview"
  >;
  persistSubmittedComment?: (body: string, target: ReviewComposerTarget) => Promise<void>;
  state: DiffdiffAppState;
}

export function createGitHubMutationActions({
  actions,
  controllers,
  derived,
  persistSubmittedComment,
  persistence,
  props,
  state,
}: CreateGitHubMutationActionsOptions) {
  const optimisticOperations = createGitHubOptimisticOperationController(state);

  async function togglePullRequestDraft(): Promise<void> {
    const github = state.session.github;
    if (github == null || !github.auth.isAuthenticated) {
      state.setStatusMessage(
        github == null
          ? "Open a GitHub pull request first."
          : "GitHub auth is required. Run `diffdiff auth login --token-stdin` first.",
      );
      return;
    }
    if (github.pullRequest.state !== "open" || github.pullRequest.isMerged) {
      state.setStatusMessage("Draft status can only be changed for an open pull request.");
      return;
    }
    if (
      props.setPullRequestDraft == null ||
      state.isSubmittingReviewAction ||
      state.writeGuard.isPending("draft")
    )
      return;
    const release = state.writeGuard.acquire("draft");
    if (release == null) return;
    const isDraft = !github.pullRequest.isDraft;
    const destination = isDraft ? "draft" : "ready for review";
    const loadId = actions.beginSessionLoad();
    state.setIsSubmittingReviewAction(true);
    state.setStatusMessage(`Marking pull request as ${destination}...`);
    let changed = false;
    try {
      await props.setPullRequestDraft(github, isDraft);
      changed = true;
      state.setSession((session) => {
        const current = session.github;
        if (current?.pullRequest.url !== github.pullRequest.url) return session;
        return {
          ...session,
          github: {
            ...current,
            pullRequest: {
              ...current.pullRequest,
              isDraft,
              merge: { ...current.pullRequest.merge, isDraft },
            },
          },
        };
      });
      if (!actions.isLatestSessionLoad(loadId)) return;
      state.setStatusMessage(`Marked pull request as ${destination}.`);
      const next = await props.loadSession(state.startupOptions);
      if (actions.isLatestSessionLoad(loadId)) actions.applyLoadedSession(next);
    } catch (error) {
      if (!actions.isLatestSessionLoad(loadId)) return;
      const message = changed
        ? `Marked pull request as ${destination}, but unable to refresh the session.`
        : "Unable to change pull request draft status.";
      persistence.persistenceApi.handleAppError(
        error,
        message,
        { action: "toggle-pull-request-draft" },
        { displayMessage: message },
      );
    } finally {
      release();
      state.setIsSubmittingReviewAction(state.writeGuard.hasPending());
    }
  }

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

    const release = state.writeGuard.acquire("comment");
    if (release == null) return;
    const owner = state.dialogStackRef.current.at(-1);
    const sessionLoadId = actions.beginSessionLoad();
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
      if (!actions.isLatestSessionLoad(sessionLoadId)) return;
      if (state.dialogStackRef.current.at(-1) === owner) {
        state.setDialogStack((currentStack) =>
          closeAppDialog(currentStack, "comment-composer", "complete"),
        );
        controllers.reviewComposer.reset();
      }
      state.setStatusMessage(
        reviewComposerTarget.kind === "review-thread"
          ? "Added review comment."
          : reviewComposerTarget.kind === "review-thread-reply"
            ? "Added review reply."
            : "Added PR reply comment.",
      );
      const nextSession = await props.loadSession(state.startupOptions);
      if (actions.isLatestSessionLoad(sessionLoadId)) {
        actions.applyLoadedSession(nextSession);
      }
    } catch (error) {
      if (!mutationSucceeded) {
        optimisticOperations.remove(operationId);
        persistence.persistenceApi.handleAppError(
          error,
          "Unable to submit the comment.",
          {
            action: reviewComposerTarget.kind,
          },
          mutationErrorOptions(
            state,
            owner,
            error,
            reviewSession.pullRequest.number,
            reviewComposerTarget.kind === "review-thread"
              ? "github.add-comment"
              : reviewComposerTarget.kind === "review-thread-reply"
                ? "github.reply-thread"
                : "conversation.reply",
          ),
        );
        return;
      }
      if (!actions.isLatestSessionLoad(sessionLoadId)) return;

      persistence.persistenceApi.handleAppError(
        error,
        "Added the comment, but unable to refresh the session.",
        {
          action: reviewComposerTarget.kind,
        },
        { dialogOwner: owner },
      );
    } finally {
      release();
      state.setIsSubmittingReviewAction(state.writeGuard.hasPending());
    }
  }

  async function submitReviewFromModal(): Promise<void> {
    if (state.session.github == null || props.submitPendingReview == null) {
      return;
    }
    if (
      getReviewSubmissionEvent(state.reviewSubmissionEventIndex) === "REQUEST_CHANGES" &&
      state.reviewSubmissionInput.value.trim() === ""
    ) {
      state.setStatusMessage("Add a summary before requesting changes.");
      return;
    }
    const release = state.writeGuard.acquire("review");
    if (release == null) return;
    const owner = state.dialogStackRef.current.at(-1);
    const sessionLoadId = actions.beginSessionLoad();
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
    try {
      await props.submitPendingReview(reviewSession, event, nextBody);
      mutationSucceeded = true;
      const drafts = state.formDraftsRef.current.get(formDraftKey(state.session));
      if (drafts?.review?.body.trim() === (nextBody ?? "")) delete drafts.review;
      if (!actions.isLatestSessionLoad(sessionLoadId)) return;
      if (state.dialogStackRef.current.at(-1) === owner) {
        state.setDialogStack((currentStack) =>
          closeAppDialog(currentStack, "submit-review", "complete"),
        );
        controllers.reviewSubmission.reset();
      }
      state.setStatusMessage("Submitted review.");
      const nextSession = await props.loadSession(state.startupOptions);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      actions.applyLoadedSession(nextSession);
    } catch (error) {
      if (!mutationSucceeded) {
        optimisticOperations.remove(operationId);
        persistence.persistenceApi.handleAppError(
          error,
          "Unable to submit the review.",
          {
            action: "submit-review",
            event,
          },
          mutationErrorOptions(
            state,
            owner,
            error,
            reviewSession.pullRequest.number,
            "github.submit-review",
          ),
        );
        return;
      }
      if (!actions.isLatestSessionLoad(sessionLoadId)) return;

      persistence.persistenceApi.handleAppError(
        error,
        "Submitted the review, but unable to refresh the session.",
        {
          action: "submit-review",
          event,
        },
        { dialogOwner: owner },
      );
    } finally {
      release();
      state.setIsSubmittingReviewAction(state.writeGuard.hasPending());
    }
  }

  async function submitMergeFromModal(): Promise<void> {
    if (state.mergeMethod === "close")
      return submitClosePullRequest({ actions, props, state, persistence });
    if (
      state.session.github == null ||
      props.mergePullRequest == null ||
      state.mergeMethod == null ||
      !canSubmitMerge(state.session.github.pullRequest, state.mergeMethod, state.mergeAutoMerge)
    ) {
      return;
    }

    const release = state.writeGuard.acquire("merge");
    if (release == null) return;
    const owner = state.dialogStackRef.current.at(-1);
    const sessionLoadId = actions.beginSessionLoad();
    state.setMergeConfirmOpen(false);
    const reviewSession = state.session.github;
    const cleanupAfterMerge =
      !state.mergeAutoMerge && getCleanupAfterMerge(state.gitHubPreferencesRef.current.cleanup);
    const operationId = optimisticOperations.reserveId();

    if (!state.mergeAutoMerge)
      optimisticOperations.push(buildOptimisticMergeOperation(operationId));
    state.setIsSubmittingReviewAction(true);
    state.setStatusMessage(
      state.mergeAutoMerge
        ? "Enabling auto-merge..."
        : `Merging pull request with ${state.mergeMethod}...`,
    );
    let mergeSucceeded = false;
    let mergeResult:
      | Awaited<ReturnType<NonNullable<DiffdiffAppProps["mergePullRequest"]>>>
      | undefined;
    try {
      mergeResult = await props.mergePullRequest(reviewSession, {
        ...(state.mergeAutoMerge ? { autoMerge: true } : {}),
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
      const drafts = state.formDraftsRef.current.get(formDraftKey(state.session));
      if (
        drafts?.merge?.title === state.mergeCommitTitleInput.value &&
        drafts.merge.body === state.mergeCommitMessageInput.value
      )
        delete drafts.merge;
      const cleanupMessage = cleanupAfterMerge
        ? await cleanMergedRefs(mergeResult, reviewSession, props.removeCleanupRefs)
        : "";
      if (!actions.isLatestSessionLoad(sessionLoadId)) return;
      if (mergeResult.autoMergeEnabled) {
        state.setSession((current) =>
          current.github == null
            ? current
            : {
                ...current,
                github: {
                  ...current.github,
                  pullRequest: {
                    ...current.github.pullRequest,
                    merge: { ...current.github.pullRequest.merge, autoMergeEnabled: true },
                  },
                },
              },
        );
        if (state.dialogStackRef.current.at(-1) === owner) {
          state.setDialogStack((stack) => closeAppDialog(stack, "merge", "complete"));
        }
        state.setStatusMessage("Auto-merge enabled. GitHub will merge when requirements pass.");
        return;
      }
      const stillOwned = state.dialogStackRef.current.at(-1) === owner;
      if (stillOwned) {
        state.setDialogStack((currentStack) => closeAppDialog(currentStack, "merge", "complete"));
      }
      state.setStatusMessage("Merged the pull request. Refreshing local refs...");
      const nextSession = await props.loadSession(state.startupOptions);
      if (!actions.isLatestSessionLoad(sessionLoadId)) return;
      actions.applyLoadedSession(nextSession);
      if (mergeResult.refsRefreshError) {
        persistence.persistenceApi.showErrorToast(
          `Merged PR #${reviewSession.pullRequest.number}. Ref refresh failed: ${mergeResult.refsRefreshError}. Local refs were kept.`,
        );
        state.setStatusMessage(
          `Merged the pull request; local refs were kept. ${mergeResult.refsRefreshError}`,
        );
      } else
        state.setStatusMessage(
          `Merged the pull request and refreshed local refs.${cleanupMessage}`,
        );
    } catch (error) {
      if (!mergeSucceeded) {
        optimisticOperations.remove(operationId);
        persistence.persistenceApi.handleAppError(
          error,
          state.mergeAutoMerge
            ? "Unable to enable auto-merge."
            : "Unable to merge the pull request.",
          {
            action: "merge-pull-request",
            mergeMethod: state.mergeMethod,
            pullRequestNumber: state.session.github.pullRequest.number,
          },
          mutationErrorOptions(
            state,
            owner,
            error,
            reviewSession.pullRequest.number,
            "github.merge",
          ),
        );
        return;
      }
      if (!actions.isLatestSessionLoad(sessionLoadId)) return;

      persistence.persistenceApi.handleAppError(
        error,
        "Merged the pull request, but unable to refresh local refs.",
        {
          action: "merge-pull-request",
          mergeMethod: state.mergeMethod,
          pullRequestNumber: state.session.github.pullRequest.number,
        },
        { dialogOwner: owner },
      );
    } finally {
      release();
      state.setIsSubmittingReviewAction(state.writeGuard.hasPending());
    }
  }

  return {
    togglePullRequestDraft,
    submitCommentComposer,
    submitMergeFromModal,
    submitReviewFromModal,
  };
}
