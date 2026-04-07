import type { GitHubPullRequestReviewThread } from "@madisonbullard/diffdiff-core";

export function getReviewThreadCollapseKey(thread: GitHubPullRequestReviewThread): string {
  return `thread:${thread.id}`;
}

export function getReviewThreadDefaultCollapsed(thread: GitHubPullRequestReviewThread): boolean {
  return thread.isOutdated;
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
