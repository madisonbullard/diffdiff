export interface StartupOptions {
  repoPath?: string;
  base?: string;
  head?: string;
}

export interface ParsedStartupOptions extends StartupOptions {
  help: boolean;
  version: boolean;
}

export interface ReviewSession {
  repository: RepositoryInfo;
  comparison: ComparisonInfo;
  files: ChangedFile[];
  branches: BranchCollection;
  warnings: ReviewWarning[];
}

export interface RepositoryInfo {
  kind: string;
  rootPath: string;
  name: string;
  remotes: GitRemote[];
  currentBranch?: string;
}

export interface ComparisonInfo {
  base: string;
  head: string;
  mergeBase?: string;
  range: string;
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
  pullRequest?: PullRequestInfo;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  baseRefName: string;
}

export interface GitRemote {
  name: string;
  fetchUrl: string;
  forge?: ForgeRepository;
}

export interface ForgeRepository {
  forge: string;
  owner: string;
  repo: string;
  host: string;
}

export interface ReviewWarning {
  code: string;
  message: string;
}

export interface RepositoryProvider {
  kind: string;
  detectRepository(startPath: string): Promise<RepositoryHandle | null>;
}

export interface RepositoryHandle {
  kind: string;
  rootPath: string;
  loadReviewSession(
    options: StartupOptions,
    forgeProviders: ForgeMetadataProvider[],
  ): Promise<ReviewSession>;
}

export interface ForgeMetadataProvider {
  kind: string;
  supports(remote: GitRemote): boolean;
  enrichBranches(input: ForgeBranchMetadataRequest): Promise<ForgeBranchMetadataResult>;
}

export interface ForgeBranchMetadataRequest {
  repositoryRoot: string;
  remote: GitRemote;
  branches: BranchInfo[];
}

export interface ForgeBranchMetadataResult {
  branches: BranchInfo[];
  warnings: ReviewWarning[];
}
