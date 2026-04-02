import type { GitHubPullRequestReviewThread } from "@diffdiff/core";
import type { SideBySideDiffRow, UnifiedDiffLine } from "../types.ts";

const EMPTY_THREADS: readonly GitHubPullRequestReviewThread[] = [];

export interface ThreadIndex {
  leftThreads: Map<number, GitHubPullRequestReviewThread[]>;
  rightThreads: Map<number, GitHubPullRequestReviewThread[]>;
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
      continue;
    }

    if (!rightLineNumbers.has(anchorLine)) {
      unanchoredThreads.push(thread);
      continue;
    }

    pushThread(rightThreads, anchorLine, thread);
  }

  return {
    leftThreads,
    rightThreads,
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
