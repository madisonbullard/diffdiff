import type { GitHubPullRequestReviewThread } from "@madisonbullard/diffdiff-core";

export function getReviewThreadCollapseKey(thread: GitHubPullRequestReviewThread): string {
  // Resolution changes reset earlier expansion overrides; resolved threads can
  // still be expanded manually, with that choice persisted separately.
  return `thread:${thread.id}${thread.isResolved ? ":resolved" : ""}`;
}

export function getReviewThreadDefaultCollapsed(thread: GitHubPullRequestReviewThread): boolean {
  return thread.isOutdated || thread.isResolved === true;
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
