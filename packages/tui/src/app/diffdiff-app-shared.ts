import type {
  DiffdiffPreferences,
  ReviewSessionFreshnessResult,
  GitHubCleanupPreferences,
  GitHubDashboardPullRequest,
  GitHubPullRequestComment,
  GitHubPullRequestConversationItem,
  GitHubPullRequestMergeRequest,
  GitHubPullRequestMergeResult,
  GitHubRefCleanupCandidate,
  GitHubReviewSession,
  GitHubReviewSubmissionEvent,
  GitHubUserPreferences,
  ReviewCacheKey,
  ReviewCacheState,
} from "@diffdiff/core";
import { updateDiffdiffSessionActivity } from "@diffdiff/core";
import { formatThreadAnchor } from "../review/threads.tsx";
import type { SyntaxStyle } from "@opentui/core";
import type { AppPane, LaunchOptions, PreparedReviewSession } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import type { StartupInstrumentation } from "../startup-tracing.ts";

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

export type ReviewComposerTarget =
  | {
      kind: "pull-request-comment-reply";
      item: GitHubPullRequestConversationItem;
      quotedBody: string;
    }
  | {
      anchor: import("../review-anchors.ts").SelectedReviewAnchor;
      kind: "review-thread";
    }
  | {
      comment: GitHubPullRequestComment;
      kind: "review-thread-reply";
      rootCommentId: number;
      thread: import("@diffdiff/core").GitHubPullRequestReviewThread;
    };

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

export const LIST_FILTER_KEYS = ["workingTree", "localBranch", "openPr", "remoteBranch"] as const;
export const LOADING_INDICATOR_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
export const TERMINAL_FOCUS_EVENT = "focus";
export const TERMINAL_BLUR_EVENT = "blur";
export const EMPTY_REVIEW_THREADS: readonly import("@diffdiff/core").GitHubPullRequestReviewThread[] =
  [];
export const EMPTY_CONVERSATION_ITEMS: readonly GitHubPullRequestConversationItem[] = [];
export const REVIEWED_NEXT_FILE_SCROLL_OFFSET = 3;
export const LIVE_REFRESH_INTERVAL_MS = 5_000;
export const INITIAL_FILE_BODY_RENDER_COUNT = 8;
export const FILE_PREVIEW_HYDRATION_DISTANCE = 24;
export const GITHUB_DIALOGS = new Set<import("./dialog-stack.ts").AppDialog>([
  "cleanup",
  "comment-composer",
  "comments",
  "merge",
  "submit-review",
]);

export function getReviewComposerContext(target: ReviewComposerTarget): {
  snippet: string;
  subtitle: string;
  title: string;
} {
  if (target.kind === "review-thread") {
    return {
      snippet: target.anchor.snippet,
      subtitle: `Comment on ${target.anchor.path}:${target.anchor.line} (${target.anchor.side.toLowerCase()}).`,
      title: "Add Comment",
    };
  }

  if (target.kind === "review-thread-reply") {
    return {
      snippet: target.comment.body,
      subtitle: `Reply in ${formatThreadAnchor(target.thread)} to ${target.comment.author.login}.`,
      title: "Reply to Thread",
    };
  }

  return {
    snippet: target.quotedBody,
    subtitle: `Reply to ${target.item.author.login}'s PR comment. A quoted top-level PR comment will be created.`,
    title: "Reply to PR Comment",
  };
}

export function buildQuotedPullRequestReply(
  item: GitHubPullRequestConversationItem,
  body: string,
): string {
  const quotedBody = item.body
    .split(/\r?\n/u)
    .map((line) => `> ${line}`)
    .join("\n");

  return [`Replying to ${item.author.login}:`, quotedBody, "", body].join("\n");
}
