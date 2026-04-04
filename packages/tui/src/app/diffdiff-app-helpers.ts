import { buildReviewedFileFingerprint } from "@diffdiff/core";
import type {
  ReviewCacheState,
  ReviewSessionFreshnessResult,
  ReviewedFileState,
} from "@diffdiff/core";
import type { FileCardPreviewViewport } from "../components/file-card.tsx";
import type { BranchListFilters, FileTreeNode, PreparedReviewSession } from "../types.ts";
import {
  FILE_PREVIEW_HYDRATION_DISTANCE,
  INITIAL_FILE_BODY_RENDER_COUNT,
} from "./diffdiff-app-shared.ts";

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

export function haveSamePaths(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const path of left) {
    if (!right.has(path)) {
      return false;
    }
  }

  return true;
}

export function reconcileCollapsedPaths(
  currentPaths: ReadonlySet<string>,
  files: PreparedReviewSession["files"],
): Set<string> {
  const availablePaths = new Set(files.map((file) => file.path));
  const nextPaths = new Set<string>();

  for (const path of currentPaths) {
    if (availablePaths.has(path)) {
      nextPaths.add(path);
    }
  }

  for (const file of files) {
    if (file.status === "deleted") {
      nextPaths.add(file.path);
    }
  }

  return nextPaths;
}

export function getAncestorDirectoryPaths(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const ancestors: string[] = [];

  for (let index = 0; index < parts.length - 1; index += 1) {
    const ancestorPath = index === 0 ? parts[index]! : `${ancestors[index - 1]}/${parts[index]}`;
    ancestors.push(ancestorPath);
  }

  return ancestors;
}

export function reconcileCollapsedDirectories(
  currentPaths: ReadonlySet<string>,
  nodes: readonly FileTreeNode[],
): Set<string> {
  const availablePaths = new Set(
    nodes.filter((node) => node.kind === "directory").map((node) => node.path),
  );
  const nextPaths = new Set<string>();

  for (const path of currentPaths) {
    if (availablePaths.has(path)) {
      nextPaths.add(path);
    }
  }

  return nextPaths;
}

export function getBranchFilterLabel(key: keyof BranchListFilters): string {
  switch (key) {
    case "workingTree":
      return "Working tree";
    case "localBranch":
      return "Local branches";
    case "openPr":
      return "Open PRs";
    case "remoteBranch":
      return "Remote branches";
  }
}

function normalizeInlineMessage(message: string): string {
  return message.replace(/\s+/gu, " ").trim();
}

export function truncateInlineMessage(message: string, maxWidth: number): string {
  const normalizedMessage = normalizeInlineMessage(message);
  if (maxWidth <= 0) {
    return "";
  }

  if (normalizedMessage.length <= maxWidth) {
    return normalizedMessage;
  }

  if (maxWidth <= 3) {
    return normalizedMessage.slice(0, maxWidth);
  }

  return `${normalizedMessage.slice(0, maxWidth - 3)}...`;
}

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

export function buildReviewedFiles(
  files: PreparedReviewSession["files"],
  reviewedPaths: ReadonlySet<string>,
): ReviewedFileState[] {
  return files.flatMap((file) =>
    reviewedPaths.has(file.path)
      ? [{ fingerprint: buildReviewedFileFingerprint(file), path: file.path }]
      : [],
  );
}

export function restoreReviewedPaths(
  files: PreparedReviewSession["files"],
  cacheState?: Pick<ReviewCacheState, "reviewedFiles" | "reviewedPaths">,
): Set<string> {
  if (cacheState?.reviewedFiles != null) {
    const reviewedFingerprintsByPath = new Map<string, Set<string>>();

    for (const reviewedFile of cacheState.reviewedFiles) {
      const fingerprints = reviewedFingerprintsByPath.get(reviewedFile.path) ?? new Set<string>();
      fingerprints.add(reviewedFile.fingerprint);
      reviewedFingerprintsByPath.set(reviewedFile.path, fingerprints);
    }

    return new Set(
      files.flatMap((file) => {
        const fingerprints = reviewedFingerprintsByPath.get(file.path);
        if (fingerprints?.has(buildReviewedFileFingerprint(file)) !== true) {
          return [];
        }

        return [file.path];
      }),
    );
  }

  if (cacheState?.reviewedPaths != null) {
    const availablePaths = new Set(files.map((file) => file.path));
    return new Set(cacheState.reviewedPaths.filter((path) => availablePaths.has(path)));
  }

  return new Set();
}

export function getTreeSummaryLabels({
  additions,
  deletions,
  reviewedCount,
  sidebarWidth,
  totalFiles,
}: {
  additions: number;
  deletions: number;
  reviewedCount: number;
  sidebarWidth: number;
  totalFiles: number;
}) {
  const contentWidth = Math.max(sidebarWidth - 6, 0);
  const variants = [
    {
      reviewed: `${reviewedCount} / ${totalFiles} reviewed`,
      diffAdditions: `+${additions}`,
      diffSeparator: " / ",
      diffDeletions: `-${deletions}`,
    },
    {
      reviewed: `${reviewedCount}/${totalFiles} rev`,
      diffAdditions: `+${additions}`,
      diffSeparator: "/",
      diffDeletions: `-${deletions}`,
    },
    {
      reviewed: `${reviewedCount}/${totalFiles}`,
      diffAdditions: `+${additions}`,
      diffSeparator: "/",
      diffDeletions: `-${deletions}`,
    },
  ];

  return (
    variants.find(
      ({ reviewed, diffAdditions, diffSeparator, diffDeletions }) =>
        reviewed.length + diffAdditions.length + diffSeparator.length + diffDeletions.length + 1 <=
        contentWidth,
    ) ?? variants[variants.length - 1]!
  );
}
