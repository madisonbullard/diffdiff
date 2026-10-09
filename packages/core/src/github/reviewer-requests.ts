import { DiffdiffError } from "../errors.ts";
import type { GitHubApiClient } from "../types/providers.ts";
import type { GitHubReviewSession } from "../types/github.ts";

/** Add review requests without replacing existing user or team requests. */
export async function requestReviewers(
  client: GitHubApiClient,
  session: GitHubReviewSession,
  logins: readonly string[],
): Promise<void> {
  const alreadyRequested = new Set(
    session.pullRequest.reviewRequests
      .filter((request) => request.kind === "user")
      .map((request) => request.label.toLowerCase()),
  );
  const reviewers = [
    ...new Map(logins.map((login) => [login.trim().toLowerCase(), login.trim()])).values(),
  ].filter((login) => login !== "" && !alreadyRequested.has(login.toLowerCase()));
  if (
    reviewers.some(
      (login) => login.toLowerCase() === session.pullRequest.author.login.toLowerCase(),
    )
  ) {
    throw new DiffdiffError("The pull request author cannot be requested as a reviewer.");
  }
  if (session.pullRequest.state !== "open" || session.pullRequest.isMerged) {
    throw new DiffdiffError("Reviewers can only be requested for an open pull request.");
  }
  if (reviewers.length === 0) return;
  await client.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers", {
    owner: session.repository.owner,
    repo: session.repository.repo,
    pull_number: session.pullRequest.number,
    reviewers,
  });
}
