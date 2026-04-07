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
const SECOND_IN_MS = 1_000;
const MINUTE_IN_MS = 60 * SECOND_IN_MS;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const WEEK_IN_MS = 7 * DAY_IN_MS;

export interface RelativeTimestampInfo {
  label: string;
  nextRefreshAt?: number;
}

export function formatChecksSummary(pullRequest: GitHubPullRequestDetail): string {
  if (pullRequest.checks.total === 0) {
    return "no checks";
  }

  if (pullRequest.checks.failed > 0) {
    const label = pullRequest.checks.failed === 1 ? "check" : "checks";

    return `${pullRequest.checks.failed} ${label} failed`;
  }

  const displayedChecks = pullRequest.checks.successful;

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

export function formatRelativeTimestamp(value: string, nowMs = Date.now()): string {
  return getRelativeTimestampInfo(value, nowMs).label;
}

export function getRelativeTimestampInfo(value: string, nowMs = Date.now()): RelativeTimestampInfo {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { label: value };
  }

  const timestampMs = date.getTime();
  const elapsedMs = Math.max(0, nowMs - timestampMs);

  if (elapsedMs < MINUTE_IN_MS) {
    const seconds = Math.floor(elapsedMs / SECOND_IN_MS);
    return {
      label: formatRelativeUnit(seconds, "second"),
      nextRefreshAt: timestampMs + (seconds + 1) * SECOND_IN_MS,
    };
  }

  if (elapsedMs < DAY_IN_MS) {
    if (elapsedMs < HOUR_IN_MS) {
      const minutes = Math.floor(elapsedMs / MINUTE_IN_MS);
      return {
        label: formatRelativeUnit(minutes, "minute"),
        nextRefreshAt: timestampMs + (minutes + 1) * MINUTE_IN_MS,
      };
    }

    const hours = Math.floor(elapsedMs / HOUR_IN_MS);
    return {
      label: formatRelativeUnit(hours, "hour"),
      nextRefreshAt: timestampMs + (hours + 1) * HOUR_IN_MS,
    };
  }

  if (elapsedMs < WEEK_IN_MS) {
    const days = Math.floor(elapsedMs / DAY_IN_MS);
    return {
      label: formatRelativeUnit(days, "day"),
      nextRefreshAt: timestampMs + (days + 1) * DAY_IN_MS,
    };
  }

  const weeks = Math.floor(elapsedMs / WEEK_IN_MS);
  return {
    label: formatRelativeUnit(weeks, "week"),
    nextRefreshAt: timestampMs + (weeks + 1) * WEEK_IN_MS,
  };
}

function formatRelativeUnit(value: number, unit: "second" | "minute" | "hour" | "day" | "week") {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
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
