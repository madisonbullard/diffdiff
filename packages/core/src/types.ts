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

export interface PullRequestInfo {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  baseRefName: string;
}

export interface GitHubActor {
  login: string;
  url?: string;
}

export type GitHubTokenSource = "env" | "keychain" | "config";

export interface GitHubAuthSession {
  host: string;
  token: string;
  tokenSource: GitHubTokenSource;
  configFilePath?: string;
}

export interface GitHubAuthStatus {
  host: string;
  isAuthenticated: boolean;
  tokenSource?: GitHubTokenSource;
  configFilePath?: string;
}

export interface GitHubPendingReview {
  id: number;
  nodeId: string;
  body?: string;
  comments: GitHubPullRequestComment[];
}

export interface GitHubReviewLineAnchor {
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
  startLine?: number;
  startSide?: "LEFT" | "RIGHT";
}

export type GitHubReviewSubmissionEvent = "COMMENT" | "APPROVE" | "REQUEST_CHANGES";

export interface GitHubPullRequestComment {
  id: number;
  nodeId: string;
  author: GitHubActor;
  body: string;
  commitId?: string;
  createdAt: string;
  diffHunk?: string;
  isOutdated: boolean;
  line?: number;
  originalCommitId?: string;
  originalLine?: number;
  path: string;
  replyToId?: number;
  reviewId?: number;
  side: "LEFT" | "RIGHT";
  startLine?: number;
  startSide?: "LEFT" | "RIGHT";
  updatedAt: string;
  url: string;
}

export interface GitHubPullRequestReviewThread {
  id: string;
  comments: GitHubPullRequestComment[];
  isOutdated: boolean;
  line?: number;
  originalLine?: number;
  path: string;
  reviewId?: number;
  side: "LEFT" | "RIGHT";
  startLine?: number;
  startSide?: "LEFT" | "RIGHT";
}

export interface GitHubPullRequestReviewGroup {
  reviewId?: number;
  reviewNodeId?: string;
  author: GitHubActor;
  body?: string;
  comments: GitHubPullRequestComment[];
  state: string;
  submittedAt?: string;
}

export interface GitHubPullRequestChecksSummary {
  state: "success" | "pending" | "failure" | "unknown";
  total: number;
  successful: number;
  failed: number;
  pending: number;
}

export interface GitHubPullRequestMergeState {
  canMerge: boolean;
  isDraft: boolean;
  isMerged: boolean;
  mergeable?: boolean;
  mergeableState?: string;
  mergedAt?: string;
}

export interface GitHubPullRequestDetail extends PullRequestInfo {
  author: GitHubActor;
  body?: string;
  checks: GitHubPullRequestChecksSummary;
  headSha: string;
  isDraft: boolean;
  isMerged: boolean;
  merge: GitHubPullRequestMergeState;
  nodeId: string;
  pendingReview?: GitHubPendingReview;
  reviewGroups: GitHubPullRequestReviewGroup[];
  reviewThreads: GitHubPullRequestReviewThread[];
  state: "open" | "closed";
}

export interface GitHubReviewSession {
  auth: GitHubAuthStatus;
  pullRequest: GitHubPullRequestDetail;
  remoteName: string;
  repository: ForgeRepository;
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

export interface GitHubApiClient {
  auth?: GitHubAuthSession;
  graphql<T = unknown>(query: string, parameters: Record<string, unknown>): Promise<T>;
  paginate(route: string, parameters: Record<string, unknown>): Promise<unknown[]>;
  request(route: string, parameters: Record<string, unknown>): Promise<unknown>;
}

export interface GitHubClientFactory {
  create(repository: ForgeRepository): Promise<GitHubApiClient | null>;
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
