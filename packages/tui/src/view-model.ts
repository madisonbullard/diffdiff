import type { BranchInfo, ComparisonInfo } from "@diffdiff/core";
import type { PreparedReviewFile, TextSegment } from "./types.ts";

export function getVisibleRemoteBranches(
  branches: readonly BranchInfo[],
  comparison: ComparisonInfo,
  showAll: boolean,
): BranchInfo[] {
  if (showAll) {
    return [...branches];
  }

  return branches.filter((branch) => {
    return (
      branch.pullRequest != null ||
      branch.name === comparison.base ||
      branch.name === comparison.head ||
      branch.isDefault
    );
  });
}

export function clampIndex(index: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, size - 1));
}

export function estimateFileRows(file: PreparedReviewFile, collapsed: boolean): number {
  const headerRows = file.previousPath == null ? 4 : 5;
  if (collapsed) {
    return headerRows;
  }

  return headerRows + Math.max(file.unifiedLines.length, 1) + 1;
}

export function truncateSegments(
  segments: readonly TextSegment[],
  maxWidth: number,
): TextSegment[] {
  if (maxWidth <= 0) {
    return [];
  }

  const result: TextSegment[] = [];
  let remaining = maxWidth;

  for (const segment of segments) {
    if (remaining <= 0) {
      break;
    }

    const normalizedText = segment.text.replace(/\t/gu, "  ");
    const truncatedText =
      normalizedText.length > remaining ? normalizedText.slice(0, remaining) : normalizedText;

    if (truncatedText.length === 0) {
      continue;
    }

    result.push({
      ...segment,
      text: truncatedText,
    });

    remaining -= truncatedText.length;
  }

  return result;
}
