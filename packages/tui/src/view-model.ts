import type { BranchInfo, ComparisonInfo } from "@diffdiff/core";
import type { DiffView, DiffViewPreference, PreparedReviewFile, TextSegment } from "./types.ts";

export const MIN_SIDE_BY_SIDE_DIFF_WIDTH = 121;

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

  const diffRows = Math.max(file.unifiedLines.length, file.sideBySideRows.length, 1);
  return headerRows + diffRows + 1;
}

export function resolveDiffView(preference: DiffViewPreference, terminalWidth: number): DiffView {
  if (preference === "side-by-side" && terminalWidth >= MIN_SIDE_BY_SIDE_DIFF_WIDTH) {
    return "split";
  }

  return "unified";
}

export function getDiffViewLabel(view: DiffView): string {
  return view === "split" ? "side-by-side" : "unified";
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
