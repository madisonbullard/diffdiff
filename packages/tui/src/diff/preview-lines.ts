import type { PreparedReviewFile } from "../types.ts";
import { buildSideBySideRows, buildUnifiedLines } from "./rich-preview.ts";

const plainPreviews = new WeakMap<PreparedReviewFile, PreparedReviewFile>();

/** Plain and highlighted previews have identical logical lines and geometry. */
export function getFilePreview(file: PreparedReviewFile): PreparedReviewFile {
  if (file.diff == null || (file.unifiedLines.length > 0 && file.sideBySideRows.length > 0)) {
    return file;
  }
  const cached = plainPreviews.get(file);
  if (cached != null) return cached;

  const deletionLines = file.diff.deletionLines.map((value) => ({ type: "text" as const, value }));
  const additionLines = file.diff.additionLines.map((value) => ({ type: "text" as const, value }));
  const variables = new Map<string, string>();
  const preview = {
    ...file,
    unifiedLines:
      file.unifiedLines.length > 0
        ? file.unifiedLines
        : buildUnifiedLines(file.diff, deletionLines, additionLines, variables, (color) => color),
    sideBySideRows:
      file.sideBySideRows.length > 0
        ? file.sideBySideRows
        : buildSideBySideRows(file.diff, deletionLines, additionLines, variables, (color) => color),
  };
  plainPreviews.set(file, preview);
  return preview;
}
