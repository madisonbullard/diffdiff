import { DiffdiffError } from "../errors.ts";
import { logDiffdiffInfo } from "../logging.ts";
import type { GitHubReviewSession } from "../types/github.ts";
import type { GitHubApiClient } from "../types/providers.ts";

export async function closePullRequest(
  client: GitHubApiClient,
  session: GitHubReviewSession,
): Promise<void> {
  if (session.pullRequest.state !== "open" || session.pullRequest.isMerged) {
    throw new DiffdiffError("Only an open, unmerged pull request can be closed.");
  }
  await client.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner: session.repository.owner,
    repo: session.repository.repo,
    pull_number: session.pullRequest.number,
    state: "closed",
  });
  logDiffdiffInfo("github", "pull_request_closed", {
    pullRequestNumber: session.pullRequest.number,
    repository: session.repository,
  });
}
