import type { ForgeRepository, GitHubReviewSession, GitRemote, PullRequestInfo } from "./github.ts";

export interface ReviewSession {
  repository: RepositoryInfo;
  comparison: ComparisonInfo;
  files: ChangedFile[];
  branches: BranchCollection;
  commits: ComparisonCommit[];
  github?: GitHubReviewSession;
  renderFingerprint: ReviewSessionFingerprint;
  workingTreeSummary: ChangeSummary;
  warnings: ReviewWarning[];
}

export interface RepositoryInfo {
  kind: string;
  rootPath: string;
  name: string;
  remotes: GitRemote[];
  currentForgeRepository?: ForgeRepository;
  currentBranch?: string;
  defaultBranch?: string;
}

export interface ComparisonInfo {
  base: string;
  head: string;
  baseSha?: string;
  headSha?: string;
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

export interface PullRequestFingerprint {
  number: number;
  headSha: string;
  checksState: string;
  state: "open" | "closed";
  isDraft: boolean;
  isMerged: boolean;
  mergeableState?: string;
  updatedAt: string;
}

export interface ReviewSessionFingerprint {
  comparisonMode: ComparisonMode;
  baseRef: string;
  headRef: string;
  baseSha?: string;
  headSha?: string;
  fileCount: number;
  patchDigest: string;
  pullRequest?: PullRequestFingerprint;
}

export interface ReviewSessionFreshnessResult {
  hasComparisonUpdates: boolean;
  hasGitHubUpdates: boolean;
  comparisonSummary?: ChangeSummary;
  nextBaseSha?: string;
  nextHeadSha?: string;
  nextPullRequestFingerprint?: PullRequestFingerprint;
}

export interface ReviewWarning {
  code: string;
  message: string;
}
