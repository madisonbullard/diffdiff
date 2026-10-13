import type {
  GitHubPullRequestReviewThread,
  GitHubReviewSession,
} from "@madisonbullard/diffdiff-core";

export function thread(
  path: string,
  line: number,
  side: "LEFT" | "RIGHT" = "RIGHT",
): GitHubPullRequestReviewThread {
  return {
    id: `${side}:${line}`,
    path,
    line,
    side,
    startLine: line - 1,
    startSide: side,
    isOutdated: false,
    comments: [
      {
        id: line,
        nodeId: `comment:${line}`,
        author: { login: "reviewer" },
        body: `INLINE_COMMENT_${line}`,
        path,
        line,
        side,
        isOutdated: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        url: "https://github.com/example/repo/pull/1",
      },
    ],
  };
}

export function githubReview(
  root: string,
  threads: GitHubPullRequestReviewThread[],
): GitHubReviewSession {
  return {
    auth: { host: "github.com", isAuthenticated: false },
    repository: { forge: "github", host: "github.com", owner: "example", repo: "repo" },
    remoteName: "origin",
    repositoryRootPath: root,
    pullRequest: {
      number: 1,
      title: "Review fixture",
      url: "https://github.com/example/repo/pull/1",
      baseRefName: "main",
      headRefName: "feature",
      headSha: "fixture",
      nodeId: "fixture",
      author: { login: "author" },
      checks: { state: "unknown", total: 0, failed: 0, pending: 0, successful: 0 },
      merge: {
        allowedMethods: ["merge", "squash"],
        canMerge: false,
        isDraft: false,
        isMerged: false,
        mergeable: false,
        mergeableState: "unknown",
      },
      changedFileCount: 1,
      changedFiles: {},
      commitCount: 1,
      conversationItems: [],
      isDraft: false,
      isMerged: false,
      issueCommentCount: 0,
      latestOpinionatedReviews: [],
      reviewCommentCount: threads.length,
      reviewGroups: [],
      reviewRequests: [],
      reviewThreads: threads,
      state: "open",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  };
}
