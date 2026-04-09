import type {
  PullRequestUpdateReason,
  PullRequestUpdateReasonCode,
  ReviewSessionFreshnessResult,
} from "@madisonbullard/diffdiff-core";

interface RefreshIndicatorPresentation {
  label: string | null;
  statusMessage: string | null;
}

interface PullRequestReasonDescriptor {
  badge: (reason: PullRequestUpdateReason) => string;
  sentence: (reason: PullRequestUpdateReason) => string;
}

const PULL_REQUEST_REASON_DESCRIPTORS: Record<
  PullRequestUpdateReasonCode,
  PullRequestReasonDescriptor
> = {
  activity: {
    badge: () => "PR updated",
    sentence: () => "PR activity changed.",
  },
  "changes-requested": {
    badge: () => "changes requested",
    sentence: (reason) =>
      formatActorSentence(
        reason.actors,
        "Changes were requested on the PR.",
        "Changes requested by",
      ),
  },
  "checks-changed": {
    badge: () => "checks updated",
    sentence: (reason) =>
      `Checks changed from ${reason.from ?? "unknown"} to ${reason.to ?? "unknown"}.`,
  },
  closed: {
    badge: () => "PR closed",
    sentence: () => "PR was closed.",
  },
  "comments-added": {
    badge: () => "comments updated",
    sentence: (reason) =>
      formatCountLabel(
        reason.count,
        "A new PR comment was added.",
        "new PR comment was added.",
        "new PR comments were added.",
      ),
  },
  "converted-to-draft": {
    badge: () => "moved to draft",
    sentence: () => "PR was moved back to draft.",
  },
  "file-list-changed": {
    badge: () => "files updated",
    sentence: (reason) =>
      `Changed file count moved from ${reason.from ?? "unknown"} to ${reason.to ?? "unknown"}.`,
  },
  merged: {
    badge: () => "PR merged",
    sentence: () => "PR was merged.",
  },
  "mergeability-changed": {
    badge: () => "mergeability updated",
    sentence: (reason) =>
      `Mergeability changed from ${reason.from ?? "unknown"} to ${reason.to ?? "unknown"}.`,
  },
  "new-commits": {
    badge: (reason) => formatCountLabel(reason.count, "new commit", "new commits", "new commits"),
    sentence: (reason) =>
      formatCountLabel(
        reason.count,
        "A new commit landed on the PR.",
        "new commit landed on the PR.",
        "new commits landed on the PR.",
      ),
  },
  reopened: {
    badge: () => "PR reopened",
    sentence: () => "PR was reopened.",
  },
  "ready-for-review": {
    badge: () => "ready for review",
    sentence: () => "PR is ready for review.",
  },
  "review-approved": {
    badge: () => "approved",
    sentence: (reason) => formatActorSentence(reason.actors, "PR was approved.", "Approved by"),
  },
  "review-request-removed": {
    badge: () => "review request removed",
    sentence: (reason) =>
      formatReviewerSentence(
        reason.reviewers,
        "A review request was removed.",
        "Review request removed for",
      ),
  },
  "review-requested": {
    badge: (reason) =>
      reason.reviewers != null && reason.reviewers.length > 1
        ? "reviews requested"
        : "review requested",
    sentence: (reason) =>
      formatReviewerSentence(reason.reviewers, "A review was requested.", "Review requested from"),
  },
  "review-threads-updated": {
    badge: () => "reviews updated",
    sentence: (reason) => {
      if (reason.actors != null && reason.actors.length > 0) {
        return `Reviews updated from ${formatList(reason.actors)}.`;
      }

      return formatCountLabel(
        reason.count,
        "A new review thread comment was added.",
        "new review thread comment was added.",
        "new review thread comments were added.",
      );
    },
  },
};

export function getRefreshIndicatorPresentation(
  result: ReviewSessionFreshnessResult,
): RefreshIndicatorPresentation {
  const changedLabel =
    result.comparisonSummary == null
      ? null
      : formatFilesChangedLabel(result.comparisonSummary.filesChanged);
  const pullRequestBadgeLabel = getPullRequestBadgeLabel(result.githubUpdateReasons);
  const pullRequestStatusDetail = getPullRequestStatusDetail(result.githubUpdateReasons);

  if (result.hasComparisonUpdates && changedLabel != null) {
    if (result.hasGitHubUpdates) {
      return {
        label: `${changedLabel} + PR`,
        statusMessage: withRefreshHint(
          `${changedLabel}. ${pullRequestStatusDetail ?? "PR activity changed."}`,
        ),
      };
    }

    return {
      label: changedLabel,
      statusMessage: withRefreshHint(`${changedLabel}.`),
    };
  }

  if (result.hasComparisonUpdates) {
    if (result.hasGitHubUpdates) {
      return {
        label: "updates + PR",
        statusMessage: withRefreshHint(
          `Comparison updates are available. ${pullRequestStatusDetail ?? "PR activity changed."}`,
        ),
      };
    }

    return {
      label: "updates available",
      statusMessage: withRefreshHint("Comparison updates are available."),
    };
  }

  if (result.hasGitHubUpdates) {
    return {
      label: pullRequestBadgeLabel,
      statusMessage: withRefreshHint(pullRequestStatusDetail ?? "PR activity changed."),
    };
  }

  return {
    label: null,
    statusMessage: null,
  };
}

function formatFilesChangedLabel(filesChanged: number): string {
  return `${filesChanged} ${filesChanged === 1 ? "file" : "files"} changed`;
}

function getPullRequestBadgeLabel(reasons: readonly PullRequestUpdateReason[] | undefined): string {
  const reason = reasons?.[0];
  return reason == null ? "PR updated" : PULL_REQUEST_REASON_DESCRIPTORS[reason.code].badge(reason);
}

function getPullRequestStatusDetail(
  reasons: readonly PullRequestUpdateReason[] | undefined,
): string | null {
  if (reasons == null || reasons.length === 0) {
    return null;
  }

  return joinSentences(reasons.map(formatPullRequestReasonSentence));
}

function formatPullRequestReasonSentence(reason: PullRequestUpdateReason): string {
  return PULL_REQUEST_REASON_DESCRIPTORS[reason.code].sentence(reason);
}

function formatCountLabel(
  count: number | undefined,
  singularWithoutCount: string,
  singularWithCount: string,
  pluralWithCount: string,
): string {
  if (count == null || count <= 0) {
    return singularWithoutCount;
  }

  if (count === 1) {
    return `1 ${singularWithCount}`;
  }

  return `${count} ${pluralWithCount}`;
}

function formatActorSentence(
  actors: readonly string[] | undefined,
  fallback: string,
  prefix: string,
): string {
  return actors == null || actors.length === 0 ? fallback : `${prefix} ${formatList(actors)}.`;
}

function formatReviewerSentence(
  reviewers: readonly string[] | undefined,
  fallback: string,
  prefix: string,
): string {
  return reviewers == null || reviewers.length === 0
    ? fallback
    : `${prefix} ${formatList(reviewers)}.`;
}

function formatList(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "unknown";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function joinSentences(sentences: readonly string[]): string {
  return sentences.map((sentence) => sentence.trim()).join(" ");
}

function withRefreshHint(message: string): string {
  return `${message} Press Shift+R to refresh.`;
}
