import type { FileDiffMetadata } from "@pierre/diffs";
import { logDiffdiffError, logDiffdiffWarn } from "@diffdiff/core";
import type { ChangedFile } from "@diffdiff/core";
import type {
  PreparedReviewFile,
  SideBySideDiffCell,
  SideBySideDiffRow,
  TextSegment,
  UnifiedDiffLine,
} from "../types.ts";
import type { PierreDiffsModule } from "./pierre-internals.ts";
import { shouldHideLeadingHunkHeader } from "./hunk-header-visibility.ts";

export function createDeferredPreparedFile(
  file: ChangedFile,
  pierreDiffs: PierreDiffsModule,
): PreparedReviewFile {
  if (file.isBinary) {
    return {
      ...file,
      diff: undefined,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: 3,
    };
  }

  try {
    const diff = pierreDiffs.parsePatchFiles(file.patch)[0]?.files?.[0];

    return {
      ...file,
      diff,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: diff == null ? 3 : getLineNumberWidth(diff),
      renderError: undefined,
    };
  } catch (error) {
    logDiffdiffWarn("render", "deferred_diff_parse_failed", {
      error,
      path: file.path,
    });
    return {
      ...file,
      diff: undefined,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: 3,
      renderError: undefined,
    };
  }
}

export function parseReviewFile(
  file: ChangedFile,
  pierreDiffs: PierreDiffsModule,
): PreparedReviewFile {
  if (file.isBinary) {
    return {
      ...file,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: 3,
    };
  }

  try {
    const diff = pierreDiffs.parsePatchFiles(file.patch)[0]?.files?.[0];

    if (diff == null) {
      logDiffdiffWarn("render", "diff_parse_returned_null", {
        path: file.path,
      });
    }

    return {
      ...file,
      diff,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: diff == null ? 3 : getLineNumberWidth(diff),
      renderError: diff == null ? "Unable to parse the git patch for this file." : undefined,
    };
  } catch (error) {
    logDiffdiffError("render", "diff_parse_failed", error, {
      path: file.path,
    });
    return {
      ...file,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: 3,
      renderError: error instanceof Error ? error.message : "Unable to parse this diff.",
    };
  }
}

export function getLineNumberWidth(diff: FileDiffMetadata): number {
  const highestLineNumber = Math.max(
    ...diff.hunks.flatMap((hunk) => [
      hunk.additionStart + hunk.additionCount,
      hunk.deletionStart + hunk.deletionCount,
    ]),
    0,
  );

  return Math.max(String(highestLineNumber).length, 3);
}

export function buildPlainUnifiedLines(diff: FileDiffMetadata): UnifiedDiffLine[] {
  const lines: UnifiedDiffLine[] = [];
  let deletionIndex = 0;
  let additionIndex = 0;

  for (let hunkIndex = 0; hunkIndex < diff.hunks.length; hunkIndex += 1) {
    const hunk = diff.hunks[hunkIndex];

    if (hunk.collapsedBefore > 0 && hunkIndex > 0) {
      lines.push({
        kind: "gap",
        segments: [{ text: `... ${hunk.collapsedBefore} unchanged lines ...` }],
      });
    }

    if (!shouldHideLeadingHunkHeader(hunkIndex, hunk)) {
      const hunkHeader = sanitizePlainText(
        [hunk.hunkSpecs, hunk.hunkContext].filter(Boolean).join(" "),
      );
      lines.push({
        kind: "hunk",
        segments: [{ text: hunkHeader || "@@" }],
      });
    }

    let oldLineNumber = hunk.deletionStart;
    let newLineNumber = hunk.additionStart;

    for (const hunkContent of hunk.hunkContent) {
      if (hunkContent.type === "context") {
        for (let index = 0; index < hunkContent.lines; index += 1) {
          lines.push({
            kind: "context",
            oldLineNumber,
            newLineNumber,
            segments: toPlainSegments(diff.additionLines[additionIndex]),
          });
          oldLineNumber += 1;
          newLineNumber += 1;
          deletionIndex += 1;
          additionIndex += 1;
        }

        continue;
      }

      for (let index = 0; index < hunkContent.deletions; index += 1) {
        lines.push({
          kind: "deletion",
          oldLineNumber,
          segments: toPlainSegments(diff.deletionLines[deletionIndex]),
        });
        oldLineNumber += 1;
        deletionIndex += 1;
      }

      for (let index = 0; index < hunkContent.additions; index += 1) {
        lines.push({
          kind: "addition",
          newLineNumber,
          segments: toPlainSegments(diff.additionLines[additionIndex]),
        });
        newLineNumber += 1;
        additionIndex += 1;
      }
    }
  }

  return lines;
}

export function buildPlainSideBySideRows(diff: FileDiffMetadata): SideBySideDiffRow[] {
  const rows: SideBySideDiffRow[] = [];
  let deletionIndex = 0;
  let additionIndex = 0;

  for (let hunkIndex = 0; hunkIndex < diff.hunks.length; hunkIndex += 1) {
    const hunk = diff.hunks[hunkIndex];

    if (hunk.collapsedBefore > 0 && hunkIndex > 0) {
      rows.push({
        kind: "gap",
        segments: [{ text: `... ${hunk.collapsedBefore} unchanged lines ...` }],
      });
    }

    if (!shouldHideLeadingHunkHeader(hunkIndex, hunk)) {
      const hunkHeader = sanitizePlainText(
        [hunk.hunkSpecs, hunk.hunkContext].filter(Boolean).join(" "),
      );
      rows.push({
        kind: "hunk",
        segments: [{ text: hunkHeader || "@@" }],
      });
    }

    let oldLineNumber = hunk.deletionStart;
    let newLineNumber = hunk.additionStart;

    for (const hunkContent of hunk.hunkContent) {
      if (hunkContent.type === "context") {
        for (let index = 0; index < hunkContent.lines; index += 1) {
          rows.push({
            kind: "line",
            left: {
              kind: "context",
              lineNumber: oldLineNumber,
              segments: toPlainSegments(diff.deletionLines[deletionIndex]),
            },
            right: {
              kind: "context",
              lineNumber: newLineNumber,
              segments: toPlainSegments(diff.additionLines[additionIndex]),
            },
          });

          oldLineNumber += 1;
          newLineNumber += 1;
          deletionIndex += 1;
          additionIndex += 1;
        }

        continue;
      }

      const deletions: SideBySideDiffCell[] = [];
      const additions: SideBySideDiffCell[] = [];

      for (let index = 0; index < hunkContent.deletions; index += 1) {
        deletions.push({
          kind: "deletion",
          lineNumber: oldLineNumber,
          segments: toPlainSegments(diff.deletionLines[deletionIndex]),
        });
        oldLineNumber += 1;
        deletionIndex += 1;
      }

      for (let index = 0; index < hunkContent.additions; index += 1) {
        additions.push({
          kind: "addition",
          lineNumber: newLineNumber,
          segments: toPlainSegments(diff.additionLines[additionIndex]),
        });
        newLineNumber += 1;
        additionIndex += 1;
      }

      const pairCount = Math.max(deletions.length, additions.length);

      for (let index = 0; index < pairCount; index += 1) {
        rows.push({
          kind: "line",
          left: deletions[index] ?? { kind: "empty", segments: [] },
          right: additions[index] ?? { kind: "empty", segments: [] },
        });
      }
    }
  }

  return rows;
}

export function requiresPlainDeferredPreview(patch: string): boolean {
  return patch.split(/\r?\n/u).some((line) => line === "+" || line === "-" || line === " ");
}

function toPlainSegments(line: string | undefined): TextSegment[] {
  if (line == null) {
    return [];
  }

  const text = sanitizePlainText(line);
  return text === "" ? [] : [{ text }];
}

function sanitizePlainText(text: string): string {
  return text.replace(/\r?\n$/u, "");
}
