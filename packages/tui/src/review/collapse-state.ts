import type { GitHubPullRequestReviewGroup, GitHubPullRequestReviewThread } from "@diffdiff/core";

export function getReviewThreadCollapseKey(thread: GitHubPullRequestReviewThread): string {
  return `thread:${thread.id}`;
}

export function getReviewThreadDefaultCollapsed(thread: GitHubPullRequestReviewThread): boolean {
  return thread.isOutdated;
}

export function getReviewGroupCollapseKey(group: GitHubPullRequestReviewGroup): string {
  if (group.reviewNodeId != null && group.reviewNodeId !== "") {
    return `group:${group.reviewNodeId}`;
  }

  if (group.reviewId != null) {
    return `group:${group.reviewId}`;
  }

  const firstCommentNodeId = group.comments[0]?.nodeId;
  if (firstCommentNodeId != null && firstCommentNodeId !== "") {
    return `group:${firstCommentNodeId}`;
  }

  return `group:${group.author.login}:${group.submittedAt ?? group.state}`;
}

export function getReviewGroupDefaultCollapsed(): boolean {
  return false;
}

export function getCommentCollapsed(
  collapseStates: Readonly<Record<string, boolean>>,
  itemKey: string,
  defaultCollapsed: boolean,
): boolean {
  return collapseStates[itemKey] ?? defaultCollapsed;
}

export function toggleCommentCollapseState(
  currentStates: Readonly<Record<string, boolean>>,
  itemKey: string,
  defaultCollapsed: boolean,
): Record<string, boolean> {
  const nextCollapsed = !(currentStates[itemKey] ?? defaultCollapsed);
  const nextStates = { ...currentStates };

  if (nextCollapsed === defaultCollapsed) {
    delete nextStates[itemKey];
  } else {
    nextStates[itemKey] = nextCollapsed;
  }

  return nextStates;
}
