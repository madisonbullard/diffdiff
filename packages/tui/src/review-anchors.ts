import type { GitHubReviewLineAnchor } from "@madisonbullard/diffdiff-core";
import type { DiffView, PreparedReviewFile, SideBySideDiffRow, UnifiedDiffLine } from "./types.ts";
import { getFilePreview } from "./diff/preview-lines.ts";

export interface SelectedReviewAnchor extends GitHubReviewLineAnchor {
  key: string;
  snippet: string;
  /** Newly extended edge to reveal; GitHub's `line` always stays the range end. */
  focusLine?: number;
}

export interface ReviewRangeSelection {
  file: PreparedReviewFile;
  baseKey: string;
  anchor: SelectedReviewAnchor;
}

/** Grow only within one hunk and one blob side, including its context lines. */
export function extendReviewRange(
  patch: string,
  anchor: SelectedReviewAnchor,
  delta: number,
): SelectedReviewAnchor {
  const start = anchor.startLine ?? anchor.line;
  for (const hunk of patch.split(/(?=^@@ )/mu)) {
    const lines = getPatchAnchors(anchor.path, hunk, anchor.side).filter(
      (candidate) => candidate.side === anchor.side,
    );
    const lo = lines.findIndex((candidate) => candidate.line === start);
    const hi = lines.findIndex((candidate) => candidate.line === anchor.line);
    if (lo < 0 || hi < 0) continue;
    const nextLo = delta < 0 ? Math.max(0, lo + delta) : lo;
    const nextHi = delta > 0 ? Math.min(lines.length - 1, hi + delta) : hi;
    if (nextLo === lo && nextHi === hi) return anchor;
    const first = lines[nextLo]!;
    const last = lines[nextHi]!;
    return {
      ...last,
      key: `${anchor.path}:${anchor.side}:${last.line}:${first.line}:${anchor.side}`,
      startLine: first.line,
      startSide: anchor.side,
      focusLine: delta < 0 ? first.line : last.line,
      snippet: lines
        .slice(nextLo, nextHi + 1)
        .map((line) => line.snippet)
        .join("\n"),
    };
  }
  return anchor;
}

export function getReviewAnchors(
  file: PreparedReviewFile | undefined,
  diffView: DiffView,
): SelectedReviewAnchor[] {
  if (file == null || file.isBinary) {
    return [];
  }
  file = getFilePreview(file);

  if (file.unifiedLines.length === 0 && file.sideBySideRows.length === 0) {
    return getPatchAnchors(file.path, file.patch);
  }

  return diffView === "split"
    ? file.sideBySideRows.flatMap((row) => getRowAnchors(file.path, row))
    : file.unifiedLines.flatMap((line) => getUnifiedAnchors(file.path, line));
}

export function matchesUnifiedAnchor(
  line: UnifiedDiffLine,
  anchor: SelectedReviewAnchor | undefined,
): boolean {
  if (anchor == null || line.kind === "hunk" || line.kind === "gap") {
    return false;
  }

  return anchor.side === "LEFT"
    ? line.oldLineNumber === anchor.line
    : line.newLineNumber === anchor.line;
}

/** Hunk positions are structural boundaries, not indexes into flattened anchors. */
export function getHunkReviewAnchors(
  file: PreparedReviewFile,
  diffView: DiffView,
): SelectedReviewAnchor[] {
  const anchors = getReviewAnchors(file, diffView);
  const byLine = new Map(anchors.map((anchor) => [`${anchor.side}:${anchor.line}`, anchor]));
  const hunks: SelectedReviewAnchor[] = [];
  let firstLine = true;
  for (const line of getFilePreview(file).unifiedLines) {
    if (line.kind === "hunk") {
      firstLine = true;
      continue;
    }
    if (line.kind === "gap" || !firstLine) continue;
    // Split context rows offer both sides; use their first anchor (LEFT).
    const side =
      line.kind === "deletion" || (diffView === "split" && line.kind === "context")
        ? "LEFT"
        : "RIGHT";
    const number = side === "LEFT" ? line.oldLineNumber : line.newLineNumber;
    const anchor = byLine.get(`${side}:${number}`);
    if (anchor != null) hunks.push(anchor);
    firstLine = false;
  }
  return hunks;
}

export function matchesSideBySideAnchor(
  row: SideBySideDiffRow,
  anchor: SelectedReviewAnchor | undefined,
): boolean {
  if (anchor == null || row.kind !== "line") {
    return false;
  }

  return anchor.side === "LEFT"
    ? row.left?.lineNumber === anchor.line
    : row.right?.lineNumber === anchor.line;
}

function getUnifiedAnchors(path: string, line: UnifiedDiffLine): SelectedReviewAnchor[] {
  if (line.kind === "hunk" || line.kind === "gap") {
    return [];
  }

  if (line.kind === "deletion") {
    return createAnchor(path, line.oldLineNumber, "LEFT", undefined, undefined, line.segments);
  }

  return createAnchor(path, line.newLineNumber, "RIGHT", undefined, undefined, line.segments);
}

function getRowAnchors(path: string, row: SideBySideDiffRow): SelectedReviewAnchor[] {
  if (row.kind !== "line") {
    return [];
  }

  const anchors: SelectedReviewAnchor[] = [];

  anchors.push(
    ...createAnchor(path, row.left?.lineNumber, "LEFT", undefined, undefined, row.left?.segments),
  );
  anchors.push(
    ...createAnchor(
      path,
      row.right?.lineNumber,
      "RIGHT",
      undefined,
      undefined,
      row.right?.segments,
    ),
  );

  return anchors;
}

function createAnchor(
  path: string,
  line: number | undefined,
  side: "LEFT" | "RIGHT",
  startLine: number | undefined,
  startSide: "LEFT" | "RIGHT" | undefined,
  segments: readonly { text: string }[] | undefined,
): SelectedReviewAnchor[] {
  if (line == null) {
    return [];
  }

  return [
    {
      key: `${path}:${side}:${line}:${startLine ?? ""}:${startSide ?? ""}`,
      line,
      path,
      side,
      snippet: segmentsToText(segments),
      startLine,
      startSide,
    },
  ];
}

function getPatchAnchors(
  path: string,
  patch: string,
  contextSide: "LEFT" | "RIGHT" = "RIGHT",
): SelectedReviewAnchor[] {
  const anchors: SelectedReviewAnchor[] = [];
  const lines = patch.split(/\r?\n/u);
  let oldLineNumber = 0;
  let newLineNumber = 0;
  let insideHunk = false;

  for (const line of lines) {
    const hunkMatch = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(line);
    if (hunkMatch != null) {
      oldLineNumber = Number.parseInt(hunkMatch[1]!, 10);
      newLineNumber = Number.parseInt(hunkMatch[2]!, 10);
      insideHunk = true;
      continue;
    }

    if (!insideHunk || line === "\\ No newline at end of file") {
      continue;
    }

    // File headers occur before a hunk; inside it, even +++/--- are content.
    if (line.startsWith("+")) {
      anchors.push(
        ...createAnchor(path, newLineNumber, "RIGHT", undefined, undefined, [
          { text: line.slice(1) },
        ]),
      );
      newLineNumber += 1;
      continue;
    }

    if (line.startsWith("-")) {
      anchors.push(
        ...createAnchor(path, oldLineNumber, "LEFT", undefined, undefined, [
          { text: line.slice(1) },
        ]),
      );
      oldLineNumber += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      anchors.push(
        ...createAnchor(
          path,
          contextSide === "LEFT" ? oldLineNumber : newLineNumber,
          contextSide,
          undefined,
          undefined,
          [{ text: line.slice(1) }],
        ),
      );
      oldLineNumber += 1;
      newLineNumber += 1;
      continue;
    }

    insideHunk = false;
  }

  return anchors;
}

function segmentsToText(segments: readonly { text: string }[] | undefined): string {
  const text = (segments ?? [])
    .map((segment) => segment.text)
    .join("")
    .trimEnd();
  return text === "" ? "(blank line)" : text;
}
