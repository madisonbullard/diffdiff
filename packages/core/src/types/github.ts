import type { ComparisonInfo } from "./session.ts";

export interface PullRequestInfo {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  baseRefName: string;
  createdAt?: string;
}

export interface GitHubActor {
  login: string;
  url?: string;
}

export interface GitHubDashboardPullRequest {
  author: GitHubActor;
  isAuthor: boolean;
  isDraft: boolean;
  isReviewRequested: boolean;
  number: number;
  repository: ForgeRepository;
  title: string;
  updatedAt: string;
  url: string;
}

export type GitHubTokenSource = "env" | "secure-store" | "config";

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

export type GitHubMergeMethod = "merge" | "squash";

export interface GitHubCleanupPreferences {
  removeLocal: boolean;
  removeRemote: boolean;
}

export interface GitHubUserPreferences {
  cleanup: GitHubCleanupPreferences;
  defaultMergeMethod?: GitHubMergeMethod;
}

export interface DiffdiffPreferences {
  github: GitHubUserPreferences;
  /**
   * User keymap overrides. Keys are mode names (e.g. `"diff"`, `"tree"`),
   * values are nested objects mapping key strings to action IDs.
   * See `packages/tui/src/app/keymap/types.ts` for the full schema.
   */
  keys?: Record<string, Record<string, unknown>>;
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

export interface GitHubPullRequestConversationItem {
  id: string;
  kind: "pull-request-comment" | "review";
  author: GitHubActor;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  reviewId?: number;
  reviewNodeId?: string;
  reviewState?: string;
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

export type GitHubPullRequestReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED";

export type GitHubPullRequestReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "COMMENTED"
  | "DISMISSED";

export interface GitHubPullRequestRequestedReviewer {
  kind: "team" | "user";
  label: string;
  url?: string;
}

export interface GitHubPullRequestLatestOpinionatedReview {
  author: GitHubActor;
  state: GitHubPullRequestReviewState;
  updatedAt: string;
}

export type GitHubPullRequestFileViewedState = "VIEWED" | "UNVIEWED" | "DISMISSED";

export interface GitHubPullRequestChangedFile {
  path: string;
  viewedState: GitHubPullRequestFileViewedState;
}

export type GitHubPullRequestChangedFilesByPath = Record<string, GitHubPullRequestChangedFile>;

export interface GitHubPullRequestMergeState {
  canMerge: boolean;
  isDraft: boolean;
  isMerged: boolean;
  mergeable?: boolean;
  mergeableState?: string;
  mergedAt?: string;
}

export interface GitHubRefCleanupCandidate {
  branchName: string;
  kind: "local-branch" | "remote-tracking";
  ref: string;
}

export interface GitHubPullRequestMergeRequest {
  commitMessage?: string;
  commitTitle?: string;
  comparison: ComparisonInfo;
  method: GitHubMergeMethod;
}

export interface GitHubPullRequestMergeResult {
  cleanupCandidates: GitHubRefCleanupCandidate[];
  deletedRemoteRefs: string[];
  message: string;
  sha?: string;
}

export interface GitHubPullRequestDetail extends PullRequestInfo {
  author: GitHubActor;
  body?: string;
  checks: GitHubPullRequestChecksSummary;
  changedFileCount: number;
  changedFiles: GitHubPullRequestChangedFilesByPath;
  commitCount: number;
  conversationItems: GitHubPullRequestConversationItem[];
  headSha: string;
  isDraft: boolean;
  isMerged: boolean;
  issueCommentCount: number;
  latestOpinionatedReviews: GitHubPullRequestLatestOpinionatedReview[];
  merge: GitHubPullRequestMergeState;
  nodeId: string;
  pendingReview?: GitHubPendingReview;
  reviewCommentCount: number;
  reviewDecision?: GitHubPullRequestReviewDecision;
  reviewGroups: GitHubPullRequestReviewGroup[];
  reviewRequests: GitHubPullRequestRequestedReviewer[];
  reviewThreads: GitHubPullRequestReviewThread[];
  state: "open" | "closed";
  updatedAt: string;
}

export interface ForgeRepository {
  forge: string;
  owner: string;
  repo: string;
  host: string;
}

export interface GitRemote {
  name: string;
  fetchUrl: string;
  forge?: ForgeRepository;
}

export interface GitHubReviewSession {
  auth: GitHubAuthStatus;
  pullRequest: GitHubPullRequestDetail;
  remoteName: string;
  repository: ForgeRepository;
  repositoryRootPath: string;
}
