import type { ReviewSessionFreshnessResult } from "@diffdiff/core";

export function getRefreshIndicatorLabel(result: ReviewSessionFreshnessResult): string | null {
  if (result.hasComparisonUpdates && result.comparisonSummary != null) {
    const { filesChanged } = result.comparisonSummary;
    const changedLabel = `${filesChanged} ${filesChanged === 1 ? "file" : "files"} changed`;
    return result.hasGitHubUpdates ? `${changedLabel} + PR` : changedLabel;
  }

  if (result.hasComparisonUpdates) {
    return result.hasGitHubUpdates ? "updates + PR" : "updates available";
  }

  if (result.hasGitHubUpdates) {
    return "PR updated";
  }

  return null;
}
