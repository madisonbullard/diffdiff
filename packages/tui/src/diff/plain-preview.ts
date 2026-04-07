import type { FileDiffMetadata } from "@pierre/diffs";
import { logDiffdiffError, logDiffdiffWarn } from "@madisonbullard/diffdiff-core";
import type { ChangedFile } from "@madisonbullard/diffdiff-core";
import type { PreparedReviewFile } from "../types.ts";
import type { PierreDiffsModule } from "./pierre-internals.ts";

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
