import type { FileCardPreviewViewport } from "../../components/file-card.tsx";
import type { PreparedReviewSession } from "../../types.ts";
import {
  FILE_PREVIEW_HYDRATION_DISTANCE,
  INITIAL_FILE_BODY_RENDER_COUNT,
} from "../shared/constants.ts";

export function getMonotonicNow(): number {
  const now = globalThis.performance?.now?.();
  return typeof now === "number" ? now : Date.now();
}

export function getEstimatedFileCardBodyHeight(
  file: PreparedReviewSession["files"][number],
  diffView: "unified" | "split",
): number {
  if (file.isBinary || file.renderError != null || file.patch.trim() === "") {
    return 1;
  }

  if (diffView === "split") {
    if (file.sideBySideRows.length > 0) {
      return file.sideBySideRows.length;
    }

    if (file.diff != null) {
      return countEstimatedSideBySideRows(file.diff);
    }
  } else {
    if (file.unifiedLines.length > 0) {
      return file.unifiedLines.length;
    }

    if (file.diff != null) {
      return countEstimatedUnifiedLines(file.diff);
    }
  }

  return Math.max(file.additions + file.deletions + 3, 4);
}

function countEstimatedUnifiedLines(
  diff: NonNullable<PreparedReviewSession["files"][number]["diff"]>,
): number {
  let lineCount = 0;

  for (let hunkIndex = 0; hunkIndex < diff.hunks.length; hunkIndex += 1) {
    const hunk = diff.hunks[hunkIndex];
    if (hunk.collapsedBefore > 0 && hunkIndex > 0) {
      lineCount += 1;
    }

    lineCount += 1;
    for (const content of hunk.hunkContent) {
      if (content.type === "context") {
        lineCount += content.lines;
        continue;
      }

      lineCount += content.deletions + content.additions;
    }
  }

  return Math.max(lineCount, 1);
}

function countEstimatedSideBySideRows(
  diff: NonNullable<PreparedReviewSession["files"][number]["diff"]>,
): number {
  let rowCount = 0;

  for (let hunkIndex = 0; hunkIndex < diff.hunks.length; hunkIndex += 1) {
    const hunk = diff.hunks[hunkIndex];
    if (hunk.collapsedBefore > 0 && hunkIndex > 0) {
      rowCount += 1;
    }

    rowCount += 1;
    for (const content of hunk.hunkContent) {
      if (content.type === "context") {
        rowCount += content.lines;
        continue;
      }

      rowCount += Math.max(content.deletions, content.additions);
    }
  }

  return Math.max(rowCount, 1);
}

export function shouldRenderFileCardBody({
  estimatedBodyHeight,
  index,
  isSelected,
  previewViewport,
}: {
  estimatedBodyHeight: number;
  index: number;
  isSelected: boolean;
  previewViewport?: FileCardPreviewViewport;
}): boolean {
  if (isSelected) {
    return true;
  }

  if (previewViewport == null) {
    return index < INITIAL_FILE_BODY_RENDER_COUNT;
  }

  return (
    previewViewport.bottom > -previewViewport.overscan &&
    previewViewport.top < estimatedBodyHeight + previewViewport.overscan
  );
}

export function shouldHydrateFileCardBody({
  estimatedBodyHeight,
  isSelected,
  previewViewport,
}: {
  estimatedBodyHeight: number;
  isSelected: boolean;
  previewViewport?: FileCardPreviewViewport;
}): boolean {
  if (isSelected) {
    return true;
  }

  if (previewViewport == null) {
    return false;
  }

  return (
    previewViewport.bottom > -FILE_PREVIEW_HYDRATION_DISTANCE &&
    previewViewport.top < estimatedBodyHeight + FILE_PREVIEW_HYDRATION_DISTANCE
  );
}

export function needsSyntaxHydration(file: PreparedReviewSession["files"][number]): boolean {
  return (
    !file.isBinary &&
    file.diff != null &&
    file.renderError == null &&
    file.patch.trim() !== "" &&
    (file.unifiedLines.length === 0 || file.sideBySideRows.length === 0)
  );
}

export function mergeHydratedPreparedFile(
  currentFile: PreparedReviewSession["files"][number],
  hydratedFile: PreparedReviewSession["files"][number],
): PreparedReviewSession["files"][number] {
  const nextUnifiedLines =
    hydratedFile.unifiedLines.length > 0 ? hydratedFile.unifiedLines : currentFile.unifiedLines;
  const nextSideBySideRows =
    hydratedFile.sideBySideRows.length > 0
      ? hydratedFile.sideBySideRows
      : currentFile.sideBySideRows;
  const nextDiff = hydratedFile.diff ?? currentFile.diff;

  if (
    currentFile.diff === nextDiff &&
    currentFile.lineNumberWidth === hydratedFile.lineNumberWidth &&
    currentFile.renderError === hydratedFile.renderError &&
    currentFile.unifiedLines === nextUnifiedLines &&
    currentFile.sideBySideRows === nextSideBySideRows
  ) {
    return currentFile;
  }

  return {
    ...currentFile,
    diff: nextDiff,
    lineNumberWidth: hydratedFile.lineNumberWidth,
    renderError: hydratedFile.renderError,
    sideBySideRows: nextSideBySideRows,
    unifiedLines: nextUnifiedLines,
  };
}

export function getRenderFingerprintKey(
  fingerprint: PreparedReviewSession["renderFingerprint"],
): string {
  return [
    fingerprint.baseRef,
    fingerprint.headRef,
    fingerprint.comparisonMode,
    fingerprint.baseSha ?? "",
    fingerprint.headSha ?? "",
    String(fingerprint.fileCount),
    fingerprint.patchDigest,
  ].join(":");
}
