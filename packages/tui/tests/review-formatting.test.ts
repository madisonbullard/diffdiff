import type { GitHubPullRequestDetail } from "@diffdiff/core";
import { expect, test } from "vite-plus/test";
import {
  formatChecksSummary,
  formatRelativeTimestamp,
  getRelativeTimestampInfo,
} from "../src/review/formatting.ts";

const NOW_MS = Date.parse("2026-04-07T12:00:00Z");

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

test("formatRelativeTimestamp renders second-level labels for fresh comments", () => {
  expect(formatRelativeTimestamp("2026-04-07T11:59:31Z", NOW_MS)).toBe("29 seconds ago");
});

test("formatRelativeTimestamp renders minute-level labels after the first minute", () => {
  expect(formatRelativeTimestamp("2026-04-07T11:01:00Z", NOW_MS)).toBe("59 minutes ago");
});

test("formatRelativeTimestamp renders hour-level labels after the first hour", () => {
  expect(formatRelativeTimestamp("2026-04-06T13:00:00Z", NOW_MS)).toBe("23 hours ago");
});

test("formatRelativeTimestamp renders day-level labels for the first week", () => {
  expect(formatRelativeTimestamp("2026-04-01T12:00:00Z", NOW_MS)).toBe("6 days ago");
});

test("formatRelativeTimestamp renders week-level labels after the first week", () => {
  expect(formatRelativeTimestamp("2026-03-24T12:00:00Z", NOW_MS)).toBe("2 weeks ago");
});

test("getRelativeTimestampInfo reports the next second boundary", () => {
  expect(getRelativeTimestampInfo("2026-04-07T11:59:01Z", NOW_MS)).toEqual({
    label: "59 seconds ago",
    nextRefreshAt: Date.parse("2026-04-07T12:00:01Z"),
  });
});

test("getRelativeTimestampInfo reports the next minute, hour, day, and week boundaries", () => {
  expect(getRelativeTimestampInfo("2026-04-07T11:01:00Z", NOW_MS)).toEqual({
    label: "59 minutes ago",
    nextRefreshAt: Date.parse("2026-04-07T12:01:00Z"),
  });
  expect(getRelativeTimestampInfo("2026-04-06T13:00:00Z", NOW_MS)).toEqual({
    label: "23 hours ago",
    nextRefreshAt: Date.parse("2026-04-07T13:00:00Z"),
  });
  expect(getRelativeTimestampInfo("2026-04-01T12:00:00Z", NOW_MS)).toEqual({
    label: "6 days ago",
    nextRefreshAt: Date.parse("2026-04-08T12:00:00Z"),
  });
  expect(getRelativeTimestampInfo("2026-03-31T12:00:00Z", NOW_MS)).toEqual({
    label: "1 week ago",
    nextRefreshAt: Date.parse("2026-04-14T12:00:00Z"),
  });
});
