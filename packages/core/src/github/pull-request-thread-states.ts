import { logDiffdiffError } from "../logging.ts";
import type { ForgeRepository } from "../types/github.ts";
import type { GitHubApiClient } from "../types/providers.ts";

interface ThreadStatesResponse {
  repository?: {
    pullRequest?: {
      reviewThreads?: {
        nodes?: ({
          isResolved?: boolean;
          comments?: { nodes?: ({ databaseId?: number | null } | null)[] };
        } | null)[];
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      } | null;
    } | null;
  } | null;
}

// REST review comments omit resolution. Join GraphQL thread status by the root
// comment's database ID so existing thread IDs, reply targets, and caches stay stable.
export async function loadPullRequestThreadStates(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<Map<string, boolean>> {
  const states = new Map<string, boolean>();
  let after: string | null = null;
  try {
    while (true) {
      const response: ThreadStatesResponse = await client.graphql(
        `
        query PullRequestThreadStates($owner: String!, $repo: String!, $pullRequestNumber: Int!, $after: String) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $pullRequestNumber) {
              reviewThreads(first: 100, after: $after) {
                nodes { isResolved comments(first: 1) { nodes { databaseId } } }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        }
      `,
        { owner: repository.owner, repo: repository.repo, pullRequestNumber, after },
      );
      const connection = response.repository?.pullRequest?.reviewThreads;
      for (const thread of connection?.nodes ?? []) {
        const rootId = thread?.comments?.nodes?.[0]?.databaseId;
        if (rootId != null && typeof thread?.isResolved === "boolean") {
          states.set(String(rootId), thread.isResolved);
        }
      }
      if (connection?.pageInfo?.hasNextPage !== true || connection.pageInfo.endCursor == null) {
        return states;
      }
      after = connection.pageInfo.endCursor;
    }
  } catch (error) {
    // Status enrichment must not prevent reviewing the REST comments.
    logDiffdiffError("github", "load_pull_request_thread_states_failed", error, {
      pullRequestNumber,
      repository,
    });
    return states;
  }
}
