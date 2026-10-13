import { DiffdiffError } from "../errors.ts";
import type { GitHubApiClient } from "../types/providers.ts";
import type {
  GitHubReviewSession,
  GitHubPullRequestMergeRequest,
  GitHubPullRequestMergeResult,
} from "../types/github.ts";

export async function enablePullRequestAutoMerge(
  client: GitHubApiClient,
  session: GitHubReviewSession,
  input: GitHubPullRequestMergeRequest,
): Promise<GitHubPullRequestMergeResult> {
  const pr = session.pullRequest;
  if (
    !pr.merge.autoMergeAllowed ||
    pr.merge.autoMergeEnabled ||
    pr.isDraft ||
    pr.isMerged ||
    pr.state !== "open" ||
    !pr.merge.allowedMethods?.includes(input.method)
  ) {
    throw new DiffdiffError("Auto-merge is unavailable for this pull request.");
  }
  const response = await client.graphql<{
    enablePullRequestAutoMerge?: {
      pullRequest?: { autoMergeRequest?: { enabledAt: string } | null } | null;
    } | null;
  }>(
    `
    mutation EnablePullRequestAutoMerge($input: EnablePullRequestAutoMergeInput!) {
      enablePullRequestAutoMerge(input: $input) {
        pullRequest { autoMergeRequest { enabledAt } }
      }
    }
  `,
    {
      input: {
        pullRequestId: pr.nodeId,
        mergeMethod: input.method === "squash" ? "SQUASH" : "MERGE",
        commitHeadline: input.commitTitle,
        commitBody: input.commitMessage,
      },
    },
  );
  if (response.enablePullRequestAutoMerge?.pullRequest?.autoMergeRequest == null) {
    throw new DiffdiffError("GitHub did not confirm auto-merge was enabled.");
  }
  return {
    autoMergeEnabled: true,
    cleanupCandidates: [],
    deletedRemoteRefs: [],
    message: "Auto-merge enabled.",
  };
}
