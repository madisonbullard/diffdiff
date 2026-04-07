import type { GitHubReviewLineAnchor } from "@madisonbullard/diffdiff-core";
import type { DiffView, PreparedReviewFile, SideBySideDiffRow, UnifiedDiffLine } from "./types.ts";

export interface SelectedReviewAnchor extends GitHubReviewLineAnchor {
  key: string;
  snippet: string;
}

export function getReviewAnchors(
  file: PreparedReviewFile | undefined,
  diffView: DiffView,
): SelectedReviewAnchor[] {
  if (file == null || file.isBinary) {
    return [];
  }

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

function getPatchAnchors(path: string, patch: string): SelectedReviewAnchor[] {
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

    if (line.startsWith("+") && !line.startsWith("+++")) {
      anchors.push(
        ...createAnchor(path, newLineNumber, "RIGHT", undefined, undefined, [
          { text: line.slice(1) },
        ]),
      );
      newLineNumber += 1;
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
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
        ...createAnchor(path, newLineNumber, "RIGHT", undefined, undefined, [
          { text: line.slice(1) },
        ]),
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
