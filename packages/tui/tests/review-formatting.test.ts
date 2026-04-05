import type { GitHubPullRequestDetail } from "@diffdiff/core";
import { expect, test } from "vite-plus/test";
import { formatChecksSummary } from "../src/review/formatting.ts";

function createPullRequest(
  overrides: Partial<GitHubPullRequestDetail["checks"]> = {},
): GitHubPullRequestDetail {
  return {
    author: { login: "octocat", url: "https://github.com/octocat" },
    baseRefName: "main",
    body: "Body",
    checks: {
      failed: 0,
      pending: 0,
      state: "success",
      successful: 1,
      total: 1,
      ...overrides,
    },
    changedFiles: {},
    conversationItems: [],
    headRefName: "feature/checks",
    headSha: "abc123",
    isDraft: false,
    isMerged: false,
    merge: {
      canMerge: true,
      isDraft: false,
      isMerged: false,
    },
    nodeId: "PR_node_42",
    number: 42,
    reviewGroups: [],
    reviewThreads: [],
    state: "open",
    title: "Show failed checks count",
    updatedAt: "2026-04-03T00:00:00Z",
    url: "https://github.com/diffdiff/diffdiff/pull/42",
  };
}

test("formatChecksSummary shows the successful count when checks pass", () => {
  const pullRequest = createPullRequest({
    failed: 0,
    state: "success",
    successful: 3,
    total: 3,
  });

  expect(formatChecksSummary(pullRequest)).toBe("3/3 checks success");
});

test("formatChecksSummary shows the failed count when checks fail", () => {
  const pullRequest = createPullRequest({
    failed: 2,
    state: "failure",
    successful: 5,
    total: 7,
  });

  expect(formatChecksSummary(pullRequest)).toBe("2 checks failed");
});

test("formatChecksSummary uses the singular label for one failed check", () => {
  const pullRequest = createPullRequest({
    failed: 1,
    state: "failure",
    successful: 10,
    total: 11,
  });

  expect(formatChecksSummary(pullRequest)).toBe("1 check failed");
});

test("formatChecksSummary shows no checks when none ran", () => {
  const pullRequest = createPullRequest({
    failed: 0,
    pending: 0,
    state: "unknown",
    successful: 0,
    total: 0,
  });

  expect(formatChecksSummary(pullRequest)).toBe("no checks");
});
