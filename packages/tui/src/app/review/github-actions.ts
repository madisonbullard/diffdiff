import { logDiffdiffError } from "@diffdiff/core";
import { closeDialog as closeAppDialog, openDialog as openAppDialog } from "../dialogs/stack.ts";
import { formatThreadAnchor } from "../../review/threads.tsx";
import { createReviewComposerInteractions } from "./review-composer-interactions.ts";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { createGitHubMutationActions } from "./github-mutation-actions.ts";
import type { ReviewComposerTarget } from "./review-composer.ts";

interface CreateGitHubReviewActionsOptions {
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
    | "appendReviewComposerHistory"
    | "addReviewThread"
    | "listGitHubPullRequests"
    | "loadSession"
    | "openExternalEditor"
    | "mergePullRequest"
    | "replyToReviewComment"
    | "removeCleanupRefs"
    | "submitPendingReview"
  >;
  state: DiffdiffAppState;
}

function ensureAuthenticated(state: DiffdiffAppState): string | null {
  if (state.session.github == null) {
    return "Open a GitHub pull request first.";
  }

  if (!state.session.github.auth.isAuthenticated) {
    return "GitHub auth is required. Run `diffdiff auth login --token-stdin` first.";
  }

  return null;
}

export function createGitHubReviewActions({
  actions,
  derived,
  persistence,
  props,
  state,
}: CreateGitHubReviewActionsOptions) {
  const reviewComposerInteractions = createReviewComposerInteractions({
    persistence,
    props,
    state,
  });
  const mutationActions = createGitHubMutationActions({
    actions,
    derived,
    persistence,
    props,
    persistSubmittedComment: (body, target) =>
      reviewComposerInteractions.persistReviewComposerHistory("submitted", body, target),
    state,
  });

  function beginPullRequestListLoad(): number {
    state.pullRequestListLoadIdRef.current += 1;
    return state.pullRequestListLoadIdRef.current;
  }

  function isLatestPullRequestListLoad(loadId: number): boolean {
    return loadId === state.pullRequestListLoadIdRef.current;
  }

  async function refreshGitHubPullRequestList(options: { announce?: boolean } = {}): Promise<void> {
    const announce = options.announce ?? true;
    if (props.listGitHubPullRequests == null) {
      if (announce) {
        persistence.persistenceApi.handleAppFailure("Unable to load GitHub pull requests.", {
          action: "refresh-github-pull-request-list",
          reason: "missing-list-handler",
        });
      }
      return;
    }

    if (state.isPullRequestListLoading) {
      return;
    }

    state.setIsPullRequestListLoading(true);
    if (announce) {
      state.setStatusMessage("Loading GitHub pull requests...");
    }
    const loadId = beginPullRequestListLoad();

    try {
      const nextPullRequests = await props.listGitHubPullRequests();
      if (!isLatestPullRequestListLoad(loadId)) {
        return;
      }

      state.setPullRequestList(nextPullRequests);
      if (announce) {
        state.setStatusMessage(
          nextPullRequests.length === 0
            ? "No open authored or review-requested pull requests were found."
            : `Loaded ${nextPullRequests.length} GitHub pull request${nextPullRequests.length === 1 ? "" : "s"}.`,
        );
      }
    } catch (error) {
      if (isLatestPullRequestListLoad(loadId)) {
        if (announce) {
          persistence.persistenceApi.handleAppError(error, "Unable to load GitHub pull requests.", {
            action: "refresh-github-pull-request-list",
          });
        } else {
          logDiffdiffError("app", "startup_pull_request_prefetch_failed", error, {
            action: "startup-prefetch-github-pull-request-list",
          });
        }
      }
    } finally {
      if (isLatestPullRequestListLoad(loadId)) {
        state.setIsPullRequestListLoading(false);
      }
    }
  }

  function openGitHubPullRequestList(): void {
    state.setPullRequestListIndex(0);
    state.setPullRequestSearchActive(false);
    state.setPullRequestSearchQuery("");
    state.setDialogStack((currentStack) =>
      openAppDialog(currentStack, "pull-request-list", { clear: true }),
    );
    state.setStatusMessage("Opened pull request list.");
    void refreshGitHubPullRequestList();
  }

  function openCommentComposer(): void {
    const authMessage = ensureAuthenticated(state);
    if (authMessage != null) {
      state.setStatusMessage(authMessage);
      return;
    }
    if (derived.selectedReviewAnchor == null) {
      state.setStatusMessage("No commentable line is selected.");
      return;
    }
    openReviewComposer(
      { anchor: derived.selectedReviewAnchor, kind: "review-thread" },
      `Commenting on ${derived.selectedReviewAnchor.path}:${derived.selectedReviewAnchor.line}.`,
    );
  }

  function openFocusedReviewThreadReplyComposer(): void {
    const authMessage = ensureAuthenticated(state);
    if (authMessage != null) {
      state.setStatusMessage(authMessage);
      return;
    }
    if (derived.selectedReviewThread == null || derived.selectedReviewComment == null) {
      state.setStatusMessage("No focused review thread is available in the selected file.");
      return;
    }

    const rootComment =
      derived.selectedReviewThread.comments.find((comment) => comment.replyToId == null) ??
      derived.selectedReviewThread.comments[0];
    if (rootComment == null) {
      state.setStatusMessage("No reply target is available for the focused thread.");
      return;
    }

    openReviewComposer(
      {
        comment: derived.selectedReviewComment,
        kind: "review-thread-reply",
        rootCommentId: rootComment.id,
        thread: derived.selectedReviewThread,
      },
      `Replying in ${formatThreadAnchor(derived.selectedReviewThread)}.`,
    );
  }

  function openPullRequestConversationReplyComposer(): void {
    const authMessage = ensureAuthenticated(state);
    if (authMessage != null) {
      state.setStatusMessage(authMessage);
      return;
    }
    if (derived.selectedPullRequestConversationItem == null) {
      state.setStatusMessage("No focused PR conversation item is available.");
      return;
    }

    openReviewComposer(
      {
        item: derived.selectedPullRequestConversationItem,
        kind: "pull-request-comment-reply",
        quotedBody: derived.selectedPullRequestConversationItem.body,
      },
      `Replying to ${derived.selectedPullRequestConversationItem.author.login}.`,
    );
  }

  function openPullRequestCommentsModal(): void {
    state.setPullRequestConversationIndex(0);
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "comments"));
    state.setStatusMessage("Opened PR comments.");
  }

  function openSubmitReviewModal(): void {
    const authMessage = ensureAuthenticated(state);
    if (authMessage != null) {
      state.setStatusMessage(authMessage);
      return;
    }
    state.setReviewSubmissionBody(
      derived.displaySession.github?.pullRequest.pendingReview?.body ?? "",
    );
    state.setReviewSubmissionEventIndex(0);
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "submit-review"));
    state.setStatusMessage("Preparing review submission.");
  }

  function openMergeModal(): void {
    const authMessage = ensureAuthenticated(state);
    if (authMessage != null) {
      state.setStatusMessage(authMessage);
      return;
    }

    state.setMergeCommitTitle(derived.displaySession.github!.pullRequest.title);
    state.setMergeCommitMessage(derived.displaySession.github!.pullRequest.body ?? "");
    state.setMergeMethod(state.gitHubPreferencesRef.current.defaultMergeMethod);
    state.setMergeConfirmOpen(false);
    state.setMergeModalField(
      state.gitHubPreferencesRef.current.defaultMergeMethod == null ? "method" : "title",
    );
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "merge"));
    state.setStatusMessage("Preparing merge modal.");
  }

  return {
    ...mutationActions,
    closeCommentComposer,
    openCommentComposer,
    openFocusedReviewThreadReplyComposer,
    openGitHubPullRequestList,
    openMergeModal,
    openMergeModalInExternalEditor,
    openPullRequestCommentsModal,
    openPullRequestConversationReplyComposer,
    openSubmitReviewModal,
    openSubmitReviewModalInExternalEditor,
    openReviewComposerInExternalEditor,
    refreshGitHubPullRequestList,
  };

  function openReviewComposer(target: ReviewComposerTarget, statusMessage: string): void {
    reviewComposerInteractions.openReviewComposerForTarget(target, statusMessage);
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "comment-composer"));
  }

  function closeCommentComposer(): void {
    const target = state.reviewComposer.target;
    const body = state.reviewComposer.body;
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "comment-composer", "dismiss"),
    );
    if (reviewComposerInteractions.closeCommentComposer(target, body)) {
      state.setStatusMessage("Closed comment composer. Draft saved.");
      return;
    }

    state.setStatusMessage("Closed comment composer.");
  }

  async function openReviewComposerInExternalEditor(): Promise<void> {
    await reviewComposerInteractions.openReviewComposerInExternalEditor();
  }

  async function openSubmitReviewModalInExternalEditor(): Promise<void> {
    await reviewComposerInteractions.openSubmitReviewModalInExternalEditor();
  }

  async function openMergeModalInExternalEditor(): Promise<void> {
    await reviewComposerInteractions.openMergeModalInExternalEditor();
  }
}
