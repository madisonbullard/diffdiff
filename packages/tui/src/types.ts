import type { ChangedFile, ReviewSession } from "@diffdiff/core";
import type { FileDiffMetadata } from "@pierre/diffs";

export type PierreThemeName = "pierre-dark" | "pierre-light";

export interface TextSegment {
  text: string;
  fg?: string;
  bg?: string;
}

export interface UnifiedDiffLine {
  kind: "hunk" | "gap" | "context" | "addition" | "deletion";
  oldLineNumber?: number;
  newLineNumber?: number;
  segments: TextSegment[];
}

export interface PreparedReviewFile extends ChangedFile {
  diff?: FileDiffMetadata;
  unifiedLines: UnifiedDiffLine[];
  lineNumberWidth: number;
  renderError?: string;
}

export interface PreparedReviewSession extends Omit<ReviewSession, "files"> {
  files: PreparedReviewFile[];
  themeName: PierreThemeName;
}
