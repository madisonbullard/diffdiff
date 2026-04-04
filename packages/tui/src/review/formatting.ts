import type {
  GitHubMergeMethod,
  GitHubPullRequestDetail,
  GitHubReviewSubmissionEvent,
} from "@diffdiff/core";
import type { UiTheme } from "../theme.ts";

const REVIEW_SUBMISSION_EVENTS: readonly GitHubReviewSubmissionEvent[] = [
  "COMMENT",
  "APPROVE",
  "REQUEST_CHANGES",
];

const MERGE_METHODS: readonly GitHubMergeMethod[] = ["merge", "squash"];

export function formatChecksSummary(pullRequest: GitHubPullRequestDetail): string {
  if (pullRequest.checks.total === 0) {
    return "no checks";
  }

  const displayedChecks =
    pullRequest.checks.failed > 0 ? pullRequest.checks.failed : pullRequest.checks.successful;

  return `${displayedChecks}/${pullRequest.checks.total} checks ${pullRequest.checks.state}`;
}

export function getPullRequestTag(
  pullRequest: GitHubPullRequestDetail,
  theme: UiTheme,
): { background: string; label: string } {
  if (pullRequest.state !== "open") {
    return { background: theme.danger, label: "CLOSED PR" };
  }

  if (pullRequest.isDraft) {
    return { background: theme.warning, label: "DRAFT PR" };
  }

  return { background: theme.success, label: "PR" };
}

export function getMergeStatusLabel(pullRequest: GitHubPullRequestDetail): string {
  if (pullRequest.isMerged) {
    return "merged";
  }

  if (pullRequest.state !== "open") {
    return "closed";
  }

  if (pullRequest.isDraft) {
    return "merge blocked";
  }

  if (pullRequest.merge.canMerge) {
    return "merge ready";
  }

  return pullRequest.merge.mergeableState ?? "merge blocked";
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function getChecksColor(pullRequest: GitHubPullRequestDetail, theme: UiTheme): string {
  switch (pullRequest.checks.state) {
    case "success":
      return theme.success;
    case "failure":
      return theme.danger;
    case "pending":
      return theme.warning;
    case "unknown":
      return theme.textMuted;
  }
}

export function getMergeStatusColor(pullRequest: GitHubPullRequestDetail, theme: UiTheme): string {
  if (pullRequest.isMerged) {
    return theme.success;
  }

  if (pullRequest.state !== "open") {
    return theme.danger;
  }

  if (pullRequest.isDraft) {
    return theme.warning;
  }

  return pullRequest.merge.canMerge ? theme.success : theme.warning;
}

export function getReviewStateColor(state: string, theme: UiTheme): string {
  if (state === "APPROVED") {
    return theme.success;
  }

  if (state === "CHANGES_REQUESTED") {
    return theme.danger;
  }

  if (state === "PENDING") {
    return theme.accent;
  }

  return theme.warning;
}

export function getReviewSubmissionEvent(index: number): GitHubReviewSubmissionEvent {
  return REVIEW_SUBMISSION_EVENTS[
    Math.max(0, Math.min(index, REVIEW_SUBMISSION_EVENTS.length - 1))
  ]!;
}

export function getMergeMethod(index: number): GitHubMergeMethod {
  return MERGE_METHODS[Math.max(0, Math.min(index, MERGE_METHODS.length - 1))]!;
}

export function getMergeMethodIndex(method?: GitHubMergeMethod): number {
  return method == null ? 0 : Math.max(MERGE_METHODS.indexOf(method), 0);
}

export function formatReviewEvent(event: GitHubReviewSubmissionEvent): string {
  switch (event) {
    case "APPROVE":
      return "Approve";
    case "COMMENT":
      return "Comment";
    case "REQUEST_CHANGES":
      return "Request changes";
  }
}

export function formatMergeMethod(method: GitHubMergeMethod): string {
  return method === "merge" ? "Merge commit" : "Squash merge";
}

export function getMergeBlockedReason(pullRequest: GitHubPullRequestDetail): string {
  if (pullRequest.isMerged) {
    return "This pull request is already merged.";
  }

  if (pullRequest.state !== "open") {
    return "This pull request is closed, so merge is disabled.";
  }

  if (pullRequest.isDraft) {
    return "GitHub currently marks this PR as a draft, so merge is disabled.";
  }

  if (pullRequest.merge.mergeableState != null) {
    return `GitHub currently reports ${pullRequest.merge.mergeableState}; merge is disabled until that changes.`;
  }

  return "GitHub has not reported a mergeable state yet, so merge is disabled for now.";
}
