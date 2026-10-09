import type { GitHubPullRequestReviewThread } from "@madisonbullard/diffdiff-core";
import type { SideBySideDiffCell, TextSegment, UnifiedDiffLine } from "../types.ts";
import type { LineAnnotation } from "./diff-thread-index.ts";

export interface ChunkLine {
  left?: SideBySideDiffCell;
  right?: SideBySideDiffCell;
  unified?: UnifiedDiffLine;
  annotations: { left: readonly LineAnnotation[]; right: readonly LineAnnotation[] };
}

export type DiffChunk =
  | { kind: "header"; segments: readonly TextSegment[]; headerKind: "hunk" | "gap" }
  | { kind: "lines"; lines: ChunkLine[]; threads: readonly GitHubPullRequestReviewThread[] };

/** Split only at structural boundaries, never at viewport boundaries. */
export function appendChunkLine(
  chunks: DiffChunk[],
  line: ChunkLine,
  threads: readonly GitHubPullRequestReviewThread[],
): void {
  const previous = chunks.at(-1);
  if (previous?.kind === "lines" && previous.threads.length === 0) {
    previous.lines.push(line);
    previous.threads = threads;
  } else {
    chunks.push({ kind: "lines", lines: [line], threads });
  }
}
