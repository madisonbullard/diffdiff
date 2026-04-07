import type { ReviewComposerHistoryEntry } from "@diffdiff/core";
import type { ReviewComposerHistoryScope } from "../app/review/review-composer.ts";

export function findLatestDismissedReviewComposerDraft(
  entries: readonly ReviewComposerHistoryEntry[],
  scope: ReviewComposerHistoryScope,
): ReviewComposerHistoryEntry | undefined {
  return [...entries]
    .reverse()
    .find(
      (entry) =>
        entry.outcome === "dismissed" &&
        entry.repositoryRootPath === scope.repositoryRootPath &&
        entry.target.key === scope.targetKey,
    );
}

export function getReviewComposerHistoryEntriesForBrowsing(
  entries: readonly ReviewComposerHistoryEntry[],
  scope: ReviewComposerHistoryScope,
): ReviewComposerHistoryEntry[] {
  const seenBodies = new Set<string>();

  return [...entries]
    .reverse()
    .filter((entry) => {
      if (entry.repositoryRootPath !== scope.repositoryRootPath) {
        return false;
      }

      if (
        scope.pullRequestNumber != null &&
        entry.target.pullRequestNumber != null &&
        entry.target.pullRequestNumber !== scope.pullRequestNumber
      ) {
        return false;
      }

      const dedupeKey = `${entry.target.key}\0${entry.body}`;
      if (seenBodies.has(dedupeKey)) {
        return false;
      }

      seenBodies.add(dedupeKey);
      return true;
    })
    .sort((left, right) => {
      const leftExact = left.target.key === scope.targetKey ? 1 : 0;
      const rightExact = right.target.key === scope.targetKey ? 1 : 0;
      if (leftExact !== rightExact) {
        return rightExact - leftExact;
      }

      const leftPath = left.target.path === scope.path ? 1 : 0;
      const rightPath = right.target.path === scope.path ? 1 : 0;
      if (leftPath !== rightPath) {
        return rightPath - leftPath;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });
}
