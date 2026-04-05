import { updateDiffdiffSessionActivity } from "@diffdiff/core";
import type {
  DiffdiffPreferences,
  GitHubCleanupPreferences,
  GitHubDashboardPullRequest,
  GitHubPullRequestMergeRequest,
  GitHubPullRequestMergeResult,
  GitHubRefCleanupCandidate,
  GitHubReviewSession,
  GitHubReviewSubmissionEvent,
  GitHubUserPreferences,
  ReviewCacheKey,
  ReviewCacheState,
  ReviewSessionFreshnessResult,
} from "@diffdiff/core";
import type { SyntaxStyle } from "@opentui/core";
import type { StartupInstrumentation } from "../../startup-tracing.ts";
import type { UiTheme } from "../../theme.ts";
import type { AppPane, LaunchOptions, PreparedReviewSession } from "../../types.ts";
import type { SessionDiagnosticEvent } from "../diagnostics/session-events.ts";

export interface DiffdiffAppProps {
  addReviewThread?: (
    reviewSession: GitHubReviewSession,
    anchor: import("@diffdiff/core").GitHubReviewLineAnchor,
    body: string,
  ) => Promise<void>;
  addPullRequestComment?: (reviewSession: GitHubReviewSession, body: string) => Promise<void>;
  initialGitHubPreferences?: GitHubUserPreferences;
  initialShowKeyLegend?: boolean;
  isGitHubAuthenticated?: boolean;
  initialReviewCache?: ReviewCacheState;
  initialSession: PreparedReviewSession;
  initialOptions: LaunchOptions;
  listGitHubPullRequests?: () => Promise<GitHubDashboardPullRequest[]>;
  loadComparisonBrowserData?: (options: LaunchOptions) => Promise<{
    branches: PreparedReviewSession["branches"];
    commits: PreparedReviewSession["commits"];
    workingTreeSummary: PreparedReviewSession["workingTreeSummary"];
  }>;
  loadSessionDiagnostics?: (logFilePath: string) => Promise<SessionDiagnosticEvent[]>;
  loadSession: (options: LaunchOptions) => Promise<PreparedReviewSession>;
  logFilePath?: string;
  mergePullRequest?: (
    reviewSession: GitHubReviewSession,
    input: GitHubPullRequestMergeRequest,
  ) => Promise<GitHubPullRequestMergeResult>;
  onExit: () => void;
  resolveLaunchTarget?: (target: string, options: LaunchOptions) => Promise<LaunchOptions>;
  replyToReviewComment?: (
    reviewSession: GitHubReviewSession,
    commentId: number,
    body: string,
  ) => Promise<void>;
  removeCleanupRefs?: (
    repositoryRootPath: string,
    refs: readonly GitHubRefCleanupCandidate[],
  ) => Promise<void>;
  startupInstrumentation?: StartupInstrumentation;
  submitPendingReview?: (
    reviewSession: GitHubReviewSession,
    event: GitHubReviewSubmissionEvent,
    body?: string,
  ) => Promise<void>;
  probeFreshness?: (session: PreparedReviewSession) => Promise<ReviewSessionFreshnessResult>;
  syncRemotes?: (repositoryRootPath: string) => Promise<unknown>;
  syntaxStyle: SyntaxStyle;
  theme: UiTheme;
}

export type MergeModalField = "method" | "title" | "body";
export type SessionActivityUpdate = Parameters<typeof updateDiffdiffSessionActivity>[0];

export interface TextInputLeaderOptions {
  onLeaderDown?: () => void;
  onLeaderUp?: () => void;
}

export interface RenderSurfaceMetrics {
  collapsedFileCount: number;
  deferredPreviewCount: number;
  expandedFileCount: number;
  fileCount: number;
  renderedPreviewFileCount: number;
  renderedSplitRowCount: number;
  renderedThreadCount: number;
  renderedUnifiedLineCount: number;
}

export interface DiffViewportMetrics {
  height: number;
  scrollTop: number;
}

export interface PendingInteraction {
  details?: Record<string, unknown>;
  expectedDiffView?: "split" | "unified";
  expectedPane?: AppPane;
  expectedSelectedFilePath?: string;
  expectedSelectedTreePath?: string;
  kind: string;
  startedAt: number;
  token: number;
}

export interface DiffdiffAppPersistenceApi {
  dismissErrorToast: () => void;
  exitApp: () => void;
  handleAppError: (
    error: unknown,
    fallbackMessage: string,
    context: Record<string, unknown>,
  ) => void;
  handleAppFailure: (message: string, context: Record<string, unknown>) => void;
  persistDiffdiffPreferences: (nextPreferences: DiffdiffPreferences) => Promise<void>;
  persistGitHubPreferences: (nextPreferences: GitHubUserPreferences) => Promise<void>;
  scheduleReviewCacheSave: (key: ReviewCacheKey, state: ReviewCacheState, delayMs?: number) => void;
  scheduleSessionActivity: (activity: SessionActivityUpdate, delayMs?: number) => void;
  showToast: (message: string) => void;
  updateCleanupSelection: (
    updater: (currentSelection: GitHubCleanupPreferences) => GitHubCleanupPreferences,
  ) => void;
}
