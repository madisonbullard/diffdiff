import type { GitHubReviewSession, GitRemote, PullRequestInfo } from "./github.ts";

export interface ReviewSession {
  repository: RepositoryInfo;
  comparison: ComparisonInfo;
  files: ChangedFile[];
  branches: BranchCollection;
  commits: ComparisonCommit[];
  github?: GitHubReviewSession;
  workingTreeSummary: ChangeSummary;
  warnings: ReviewWarning[];
}

export interface RepositoryInfo {
  kind: string;
  rootPath: string;
  name: string;
  remotes: GitRemote[];
  currentBranch?: string;
  defaultBranch?: string;
}

export interface ComparisonInfo {
  base: string;
  head: string;
  mergeBase?: string;
  range: string;
  mode: ComparisonMode;
  usesMergeBase: boolean;
}

export interface ChangedFile {
  path: string;
  previousPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  isBinary: boolean;
  patch: string;
}

export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export type ComparisonMode = "range" | "working-tree";

export interface BranchCollection {
  local: BranchInfo[];
  remote: BranchInfo[];
}

export interface BranchInfo {
  kind: "local" | "remote";
  name: string;
  ref: string;
  sha: string;
  upstream?: string;
  remoteName?: string;
  isCurrent: boolean;
  isDefault: boolean;
  tipAuthor?: string;
  pullRequest?: PullRequestInfo;
  summary?: BranchSummary;
}

export interface ChangeSummary {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface BranchSummary extends ChangeSummary {
  comparedTo: string;
  commitCount: number;
  authors: string[];
}

export interface ComparisonCommit {
  sha: string;
  shortSha: string;
  decoration?: string;
  subject: string;
  author: string;
}

export interface ReviewWarning {
  code: string;
  message: string;
}
