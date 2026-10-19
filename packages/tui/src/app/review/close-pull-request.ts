import { closeDialog } from "../dialogs/stack.ts";
import { canSubmitMerge } from "../../review/merge-eligibility.ts";
import { mutationErrorOptions } from "./mutation-errors.ts";
import type { CreateGitHubMutationActionsOptions } from "./github-mutation-actions.ts";

export async function submitClosePullRequest({
  actions,
  props,
  state,
  persistence,
}: Pick<
  CreateGitHubMutationActionsOptions,
  "actions" | "props" | "state" | "persistence"
>): Promise<void> {
  const github = state.session.github;
  if (
    github == null ||
    !github.auth.isAuthenticated ||
    props.closePullRequest == null ||
    !canSubmitMerge(github.pullRequest, "close", false)
  )
    return;
  // Share the merge claim so reopening the menu cannot start a competing write.
  const release = state.writeGuard.acquire("merge");
  if (release == null) return;
  const owner = state.dialogStackRef.current.at(-1);
  const loadId = actions.beginSessionLoad();
  state.setMergeConfirmOpen(false);
  state.setIsSubmittingReviewAction(true);
  state.setStatusMessage("Closing the pull request...");
  let closed = false;
  try {
    await props.closePullRequest(github);
    closed = true;
    state.setSession((session) => {
      if (session.github?.pullRequest.url !== github.pullRequest.url) return session;
      return {
        ...session,
        github: {
          ...session.github,
          pullRequest: {
            ...session.github.pullRequest,
            state: "closed",
            merge: {
              ...session.github.pullRequest.merge,
              canMerge: false,
              autoMergeEnabled: false,
            },
          },
        },
      };
    });
    if (state.dialogStackRef.current.at(-1) === owner) {
      state.setDialogStack((stack) => closeDialog(stack, "merge", "complete"));
    }
    if (!actions.isLatestSessionLoad(loadId)) return;
    state.setStatusMessage("Closed the pull request without merging. Branches were kept.");
    const next = await props.loadSession(state.startupOptions);
    if (actions.isLatestSessionLoad(loadId)) actions.applyLoadedSession(next);
  } catch (error) {
    if (!actions.isLatestSessionLoad(loadId)) return;
    persistence.persistenceApi.handleAppError(
      error,
      closed
        ? "Closed the pull request, but unable to refresh the session."
        : "Unable to close the pull request.",
      { action: "close-pull-request", pullRequestNumber: github.pullRequest.number },
      closed
        ? {
            dialogOwner: owner,
            displayMessage:
              "Closed the pull request, but unable to refresh the session. Branches were kept.",
          }
        : mutationErrorOptions(state, owner, error, github.pullRequest.number, "github.close"),
    );
  } finally {
    release();
    state.setIsSubmittingReviewAction(state.writeGuard.hasPending());
  }
}
