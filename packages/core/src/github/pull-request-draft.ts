import { DiffdiffError } from "../errors.ts";
import type { GitHubApiClient } from "../types/providers.ts";
import type { GitHubReviewSession } from "../types/github.ts";

export async function setPullRequestDraft(
  client: GitHubApiClient,
  session: GitHubReviewSession,
  isDraft: boolean,
): Promise<void> {
  if (session.pullRequest.state !== "open" || session.pullRequest.isMerged) {
    throw new DiffdiffError("Draft status can only be changed for an open pull request.");
  }
  const mutation = isDraft ? "convertPullRequestToDraft" : "markPullRequestReadyForReview";
  const result = await client.graphql<Record<string, { pullRequest?: { isDraft: boolean } }>>(
    `mutation SetPullRequestDraft($pullRequestId: ID!) {
      ${mutation}(input: { pullRequestId: $pullRequestId }) {
        pullRequest { isDraft }
      }
    }`,
    { pullRequestId: session.pullRequest.nodeId },
  );
  if (result[mutation]?.pullRequest?.isDraft !== isDraft) {
    throw new DiffdiffError("GitHub did not confirm the pull request draft status change.");
  }
}
