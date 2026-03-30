import type {
  BranchInfo,
  ChangeSummary,
  ChangedFile,
  ComparisonCommit,
  ReviewSession,
} from "@diffdiff/core";
import type { FileDiffMetadata } from "@pierre/diffs";

export type PierreThemeName = "pierre-dark" | "pierre-light";

export type DiffViewPreference = "unified" | "side-by-side";

export type DiffView = "unified" | "split";

export type ListModalView = "branch" | "commit";

export type BranchListItemKind = "working-tree" | "local-branch" | "open-pr" | "remote-branch";

export interface BranchListFilters {
  workingTree: boolean;
  localBranch: boolean;
  openPr: boolean;
  remoteBranch: boolean;
}

export interface BranchListItem {
  key: string;
  kind: BranchListItemKind;
  branch?: BranchInfo;
  summary?: ChangeSummary;
}

export interface CommitListItem {
  key: string;
  commit: ComparisonCommit;
}

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

export interface SideBySideDiffCell {
  kind: "context" | "addition" | "deletion" | "empty";
  lineNumber?: number;
  segments: TextSegment[];
}

export interface SideBySideDiffRow {
  kind: "hunk" | "gap" | "line";
  segments?: TextSegment[];
  left?: SideBySideDiffCell;
  right?: SideBySideDiffCell;
}

export interface PreparedReviewFile extends ChangedFile {
  diff?: FileDiffMetadata;
  sideBySideRows: SideBySideDiffRow[];
  unifiedLines: UnifiedDiffLine[];
  lineNumberWidth: number;
  renderError?: string;
}

export interface PreparedReviewSession extends Omit<ReviewSession, "files"> {
  files: PreparedReviewFile[];
  themeName: PierreThemeName;
}
