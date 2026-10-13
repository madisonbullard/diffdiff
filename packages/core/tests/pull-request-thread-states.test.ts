import { expect, test, vi } from "vite-plus/test";
import { loadPullRequestThreadStates } from "../src/github/pull-request-thread-states.ts";
import type { GitHubApiClient } from "../src/types/providers.ts";

const repository = { forge: "github" as const, host: "github.com", owner: "a", repo: "b" };

test("missing status and deleted root comments are not treated as resolved", async () => {
  const graphql = vi.fn(async () => ({
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: [
            null,
            { isResolved: true, comments: { nodes: [null] } },
            { comments: { nodes: [{ databaseId: 1 }] } },
            { isResolved: false, comments: { nodes: [{ databaseId: 2 }] } },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
    },
  }));
  const client = { graphql } as unknown as GitHubApiClient;
  expect(await loadPullRequestThreadStates(client, repository, 1)).toEqual(new Map([["2", false]]));
});

test("status query failures do not prevent comment loading", async () => {
  const client = {
    graphql: vi.fn().mockRejectedValue(new Error("unavailable")),
  } as unknown as GitHubApiClient;
  expect(await loadPullRequestThreadStates(client, repository, 1)).toEqual(new Map());
});
