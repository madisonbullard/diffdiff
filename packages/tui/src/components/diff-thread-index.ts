import type { GitHubPullRequestReviewThread } from "@madisonbullard/diffdiff-core";
import type { SideBySideDiffRow, UnifiedDiffLine } from "../types.ts";

const EMPTY_THREADS: readonly GitHubPullRequestReviewThread[] = [];
const EMPTY_ANNOTATIONS: readonly LineAnnotation[] = [];

/**
 * Describes a line's position within a multi-line comment range.
 * - "single": the comment covers only this line (no startLine, or startLine === line)
 * - "start": first line of a multi-line range
 * - "middle": interior line of a multi-line range
 * - "end": last line where the comment is anchored (threads render after this line)
 */
type CommentRangePosition = "single" | "start" | "middle" | "end";

export interface LineAnnotation {
  position: CommentRangePosition;
  thread: GitHubPullRequestReviewThread;
}

interface ThreadIndex {
  leftThreads: Map<number, GitHubPullRequestReviewThread[]>;
  rightThreads: Map<number, GitHubPullRequestReviewThread[]>;
  /** Lines inside a comment range, keyed by "left:N" or "right:N". */
  lineAnnotations: Map<string, LineAnnotation[]>;
  unanchoredThreads: GitHubPullRequestReviewThread[];
}

export function buildUnifiedThreadIndex(
  threads: readonly GitHubPullRequestReviewThread[],
  lines: readonly UnifiedDiffLine[],
): ThreadIndex {
  const leftLineNumbers = new Set<number>();
  const rightLineNumbers = new Set<number>();

  for (const line of lines) {
    if (line.kind === "hunk" || line.kind === "gap") {
      continue;
    }

    if (line.oldLineNumber != null) {
      leftLineNumbers.add(line.oldLineNumber);
    }

    if (line.newLineNumber != null) {
      rightLineNumbers.add(line.newLineNumber);
    }
  }

  return buildThreadIndex(threads, leftLineNumbers, rightLineNumbers);
}

export function getUnifiedLineThreads(
  threadIndex: ThreadIndex,
  line: UnifiedDiffLine,
): readonly GitHubPullRequestReviewThread[] {
  if (line.kind === "hunk" || line.kind === "gap") {
    return EMPTY_THREADS;
  }

  if (line.kind === "deletion") {
    return line.oldLineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.leftThreads.get(line.oldLineNumber) ?? EMPTY_THREADS);
  }

  if (line.kind === "addition") {
    return line.newLineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.rightThreads.get(line.newLineNumber) ?? EMPTY_THREADS);
  }

  return mergeLineThreads(
    line.oldLineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.leftThreads.get(line.oldLineNumber) ?? EMPTY_THREADS),
    line.newLineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.rightThreads.get(line.newLineNumber) ?? EMPTY_THREADS),
  );
}

export function buildSideBySideThreadIndex(
  threads: readonly GitHubPullRequestReviewThread[],
  rows: readonly SideBySideDiffRow[],
): ThreadIndex {
  const leftLineNumbers = new Set<number>();
  const rightLineNumbers = new Set<number>();

  for (const row of rows) {
    if (row.kind !== "line") {
      continue;
    }

    if (row.left?.lineNumber != null) {
      leftLineNumbers.add(row.left.lineNumber);
    }

    if (row.right?.lineNumber != null) {
      rightLineNumbers.add(row.right.lineNumber);
    }
  }

  return buildThreadIndex(threads, leftLineNumbers, rightLineNumbers);
}

export function getSideBySideRowThreads(
  threadIndex: ThreadIndex,
  row: SideBySideDiffRow,
): readonly GitHubPullRequestReviewThread[] {
  if (row.kind !== "line") {
    return EMPTY_THREADS;
  }

  return mergeLineThreads(
    row.left?.lineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.leftThreads.get(row.left.lineNumber) ?? EMPTY_THREADS),
    row.right?.lineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.rightThreads.get(row.right.lineNumber) ?? EMPTY_THREADS),
  );
}

function buildThreadIndex(
  threads: readonly GitHubPullRequestReviewThread[],
  leftLineNumbers: ReadonlySet<number>,
  rightLineNumbers: ReadonlySet<number>,
): ThreadIndex {
  const leftThreads = new Map<number, GitHubPullRequestReviewThread[]>();
  const rightThreads = new Map<number, GitHubPullRequestReviewThread[]>();
  const lineAnnotations = new Map<string, LineAnnotation[]>();
  const unanchoredThreads: GitHubPullRequestReviewThread[] = [];

  for (const thread of threads) {
    const anchorLine = thread.line ?? thread.originalLine;
    if (anchorLine == null) {
      unanchoredThreads.push(thread);
      continue;
    }

    if (thread.side === "LEFT") {
      if (!leftLineNumbers.has(anchorLine)) {
        unanchoredThreads.push(thread);
        continue;
      }

      pushThread(leftThreads, anchorLine, thread);
    } else {
      if (!rightLineNumbers.has(anchorLine)) {
        unanchoredThreads.push(thread);
        continue;
      }

      pushThread(rightThreads, anchorLine, thread);
    }

    // Build line annotations for comment range visualization.
    const sidePrefix = thread.side === "LEFT" ? "left" : "right";
    const startLine = thread.startLine;
    if (startLine == null || startLine === anchorLine) {
      // Single-line comment: annotate only the anchor line.
      pushAnnotation(lineAnnotations, `${sidePrefix}:${anchorLine}`, {
        position: "single",
        thread,
      });
    } else {
      // Multi-line comment: annotate from startLine to anchorLine.
      const lo = Math.min(startLine, anchorLine);
      const hi = Math.max(startLine, anchorLine);
      for (let lineNum = lo; lineNum <= hi; lineNum += 1) {
        const position: CommentRangePosition =
          lineNum === lo ? "start" : lineNum === hi ? "end" : "middle";
        pushAnnotation(lineAnnotations, `${sidePrefix}:${lineNum}`, {
          position,
          thread,
        });
      }
    }
  }

  return {
    leftThreads,
    rightThreads,
    lineAnnotations,
    unanchoredThreads,
  };
}

function mergeLineThreads(
  leftThreads: readonly GitHubPullRequestReviewThread[],
  rightThreads: readonly GitHubPullRequestReviewThread[],
): readonly GitHubPullRequestReviewThread[] {
  if (leftThreads.length === 0) {
    return rightThreads;
  }

  if (rightThreads.length === 0) {
    return leftThreads;
  }

  return [...leftThreads, ...rightThreads];
}

export function getUnifiedLineAnnotations(
  threadIndex: ThreadIndex,
  line: UnifiedDiffLine,
): readonly LineAnnotation[] {
  if (line.kind === "hunk" || line.kind === "gap") {
    return EMPTY_ANNOTATIONS;
  }

  if (line.kind === "deletion") {
    return line.oldLineNumber == null
      ? EMPTY_ANNOTATIONS
      : (threadIndex.lineAnnotations.get(`left:${line.oldLineNumber}`) ?? EMPTY_ANNOTATIONS);
  }

  if (line.kind === "addition") {
    return line.newLineNumber == null
      ? EMPTY_ANNOTATIONS
      : (threadIndex.lineAnnotations.get(`right:${line.newLineNumber}`) ?? EMPTY_ANNOTATIONS);
  }

  // Context line: merge annotations from both sides.
  const leftAnns =
    line.oldLineNumber == null
      ? EMPTY_ANNOTATIONS
      : (threadIndex.lineAnnotations.get(`left:${line.oldLineNumber}`) ?? EMPTY_ANNOTATIONS);
  const rightAnns =
    line.newLineNumber == null
      ? EMPTY_ANNOTATIONS
      : (threadIndex.lineAnnotations.get(`right:${line.newLineNumber}`) ?? EMPTY_ANNOTATIONS);

  if (leftAnns.length === 0) {
    return rightAnns;
  }

  if (rightAnns.length === 0) {
    return leftAnns;
  }

  return [...leftAnns, ...rightAnns];
}

export function getSideBySideRowAnnotations(
  threadIndex: ThreadIndex,
  row: SideBySideDiffRow,
): { left: readonly LineAnnotation[]; right: readonly LineAnnotation[] } {
  if (row.kind !== "line") {
    return { left: EMPTY_ANNOTATIONS, right: EMPTY_ANNOTATIONS };
  }

  return {
    left:
      row.left?.lineNumber == null
        ? EMPTY_ANNOTATIONS
        : (threadIndex.lineAnnotations.get(`left:${row.left.lineNumber}`) ?? EMPTY_ANNOTATIONS),
    right:
      row.right?.lineNumber == null
        ? EMPTY_ANNOTATIONS
        : (threadIndex.lineAnnotations.get(`right:${row.right.lineNumber}`) ?? EMPTY_ANNOTATIONS),
  };
}

function pushThread(
  index: Map<number, GitHubPullRequestReviewThread[]>,
  lineNumber: number,
  thread: GitHubPullRequestReviewThread,
): void {
  const existingThreads = index.get(lineNumber);
  if (existingThreads == null) {
    index.set(lineNumber, [thread]);
    return;
  }

  existingThreads.push(thread);
}

function pushAnnotation(
  index: Map<string, LineAnnotation[]>,
  key: string,
  annotation: LineAnnotation,
): void {
  const existing = index.get(key);
  if (existing == null) {
    index.set(key, [annotation]);
    return;
  }

  existing.push(annotation);
}
