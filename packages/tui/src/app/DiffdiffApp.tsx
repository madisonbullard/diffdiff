import type {
  ReviewSessionFreshnessResult,
  BranchInfo,
  GitHubCleanupPreferences,
  GitHubMergeMethod,
  GitHubPullRequestComment,
  GitHubPullRequestConversationItem,
  GitHubReviewLineAnchor,
  GitHubRefCleanupCandidate,
  GitHubPullRequestMergeRequest,
  GitHubPullRequestMergeResult,
  GitHubReviewSession,
  GitHubReviewSubmissionEvent,
  GitHubUserPreferences,
  ReviewCacheKey,
  ReviewCacheState,
  ReviewedFileState,
} from "@diffdiff/core";
import {
  buildReviewedFileFingerprint,
  getDefaultGitHubPreferences,
  getDiffdiffLogSession,
  logDiffdiffError,
  logDiffdiffInfo,
  logDiffdiffVerbose,
  logDiffdiffWarn,
  probeReviewSessionFreshness,
  saveReviewCache,
  saveDiffdiffPreferences,
  syncGitRemotes,
  updateDiffdiffSessionActivity,
} from "@diffdiff/core";
import type { BoxRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closeDialog as closeAppDialog,
  getActiveDialog,
  hasOpenDialog,
  openDialog as openAppDialog,
  type AppDialog,
} from "./dialog-stack.ts";
import { DiffdiffAppDialogs } from "./layout.tsx";
import {
  getUnifiedVirtualWindow,
  shouldVirtualizeUnifiedPreview,
} from "../components/unified-diff-virtualization.ts";
import {
  FileCard,
  StickyFileHeader,
  type FileCardPreviewViewport,
} from "../components/file-card.tsx";
import { FileTreeSidebar } from "../components/file-tree-sidebar.tsx";
import { Tag } from "../components/shared.tsx";
import { PullRequestBanner } from "../review/banner.tsx";
import {
  getCommentCollapsed,
  getReviewThreadCollapseKey,
  getReviewThreadDefaultCollapsed,
  toggleCommentCollapseState,
} from "../review/collapse-state.ts";
import {
  getMergeMethod,
  getMergeMethodIndex,
  getReviewSubmissionEvent,
} from "../review/formatting.ts";
import { formatThreadAnchor } from "../review/threads.tsx";
import { getReviewAnchors } from "../review-anchors.ts";
import type { UiTheme } from "../theme.ts";
import type {
  AppPane,
  BranchListFilters,
  DiffViewPreference,
  FileTreeNode,
  LaunchOptions,
  ListModalView,
  PreparedReviewSession,
} from "../types.ts";
import {
  filterCommands,
  formatCommandKeybind,
  isPrintableKey,
  matchCommandKeybind,
  type CommandDefinition,
  type KeyboardInput,
} from "../commands.ts";
import {
  buildFileTreeNodes,
  buildBranchListItems,
  buildCommitListItems,
  clampIndex,
  DEFAULT_BRANCH_LIST_FILTERS,
  filterCommitListItems,
  findInitialBranchListSelection,
  getDiffPaneWidth,
  getDiffViewLabel,
  getFileTreeSidebarWidth,
  getTopIntersectingFileIndex,
  getVisibleFileTreeNodes,
  MIN_SIDE_BY_SIDE_DIFF_WIDTH,
  resolveDiffView,
} from "../view-model.ts";
import { copyTextToClipboard } from "../clipboard.ts";
import { copySelection } from "../selection-copy.ts";
import {
  getStartupTraceNow,
  summarizeStartupInstrumentation,
  type StartupInstrumentation,
} from "../startup-tracing.ts";

interface DiffdiffAppProps {
  addReviewThread?: (
    reviewSession: GitHubReviewSession,
    anchor: GitHubReviewLineAnchor,
    body: string,
  ) => Promise<void>;
  addPullRequestComment?: (reviewSession: GitHubReviewSession, body: string) => Promise<void>;
  initialGitHubPreferences?: GitHubUserPreferences;
  initialReviewCache?: ReviewCacheState;
  initialSession: PreparedReviewSession;
  initialOptions: LaunchOptions;
  loadSession: (options: LaunchOptions) => Promise<PreparedReviewSession>;
  logFilePath?: string;
  mergePullRequest?: (
    reviewSession: GitHubReviewSession,
    input: GitHubPullRequestMergeRequest,
  ) => Promise<GitHubPullRequestMergeResult>;
  onExit: () => void;
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

type MergeModalField = "method" | "title" | "body";
type AppCommand = CommandDefinition & {
  run: () => void;
};
type SessionActivityUpdate = Parameters<typeof updateDiffdiffSessionActivity>[0];

interface RenderSurfaceMetrics {
  collapsedFileCount: number;
  deferredPreviewCount: number;
  expandedFileCount: number;
  fileCount: number;
  renderedPreviewFileCount: number;
  renderedSplitRowCount: number;
  renderedThreadCount: number;
  renderedUnifiedLineCount: number;
}

interface DiffViewportMetrics {
  height: number;
  scrollTop: number;
}

interface PendingInteraction {
  details?: Record<string, unknown>;
  expectedDiffView?: "split" | "unified";
  expectedPane?: AppPane;
  expectedSelectedFilePath?: string;
  expectedSelectedTreePath?: string;
  kind: string;
  startedAt: number;
  token: number;
}

type ReviewComposerTarget =
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

const LIST_FILTER_KEYS = ["workingTree", "localBranch", "openPr", "remoteBranch"] as const;
const LOADING_INDICATOR_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const TERMINAL_FOCUS_EVENT = "focus";
const TERMINAL_BLUR_EVENT = "blur";
const LEADER_KEYBIND = "ctrl+x";
const COMMAND_LIST_KEYBIND = "ctrl+p";
const EMPTY_REVIEW_THREADS: readonly import("@diffdiff/core").GitHubPullRequestReviewThread[] = [];
const EMPTY_CONVERSATION_ITEMS: readonly GitHubPullRequestConversationItem[] = [];
const REVIEWED_NEXT_FILE_SCROLL_OFFSET = 3;
const LIVE_REFRESH_INTERVAL_MS = 5_000;
const GITHUB_DIALOGS = new Set<AppDialog>([
  "cleanup",
  "comment-composer",
  "comments",
  "merge",
  "submit-review",
]);

function getMonotonicNow(): number {
  const now = globalThis.performance?.now?.();
  return typeof now === "number" ? now : Date.now();
}

function haveSamePaths(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const path of left) {
    if (!right.has(path)) {
      return false;
    }
  }

  return true;
}

function reconcileCollapsedPaths(
  currentPaths: ReadonlySet<string>,
  files: PreparedReviewSession["files"],
): Set<string> {
  const availablePaths = new Set(files.map((file) => file.path));
  const nextPaths = new Set<string>();

  for (const path of currentPaths) {
    if (availablePaths.has(path)) {
      nextPaths.add(path);
    }
  }

  for (const file of files) {
    if (file.status === "deleted") {
      nextPaths.add(file.path);
    }
  }

  return nextPaths;
}

function getAncestorDirectoryPaths(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const ancestors: string[] = [];

  for (let index = 0; index < parts.length - 1; index += 1) {
    const ancestorPath = index === 0 ? parts[index]! : `${ancestors[index - 1]}/${parts[index]}`;
    ancestors.push(ancestorPath);
  }

  return ancestors;
}

function reconcileCollapsedDirectories(
  currentPaths: ReadonlySet<string>,
  nodes: readonly FileTreeNode[],
): Set<string> {
  const availablePaths = new Set(
    nodes.filter((node) => node.kind === "directory").map((node) => node.path),
  );
  const nextPaths = new Set<string>();

  for (const path of currentPaths) {
    if (availablePaths.has(path)) {
      nextPaths.add(path);
    }
  }

  return nextPaths;
}

function getBranchFilterLabel(key: keyof BranchListFilters): string {
  switch (key) {
    case "workingTree":
      return "Working tree";
    case "localBranch":
      return "Local branches";
    case "openPr":
      return "Open PRs";
    case "remoteBranch":
      return "Remote branches";
  }
}

function normalizeInlineMessage(message: string): string {
  return message.replace(/\s+/gu, " ").trim();
}

function truncateInlineMessage(message: string, maxWidth: number): string {
  const normalizedMessage = normalizeInlineMessage(message);
  if (maxWidth <= 0) {
    return "";
  }

  if (normalizedMessage.length <= maxWidth) {
    return normalizedMessage;
  }

  if (maxWidth <= 3) {
    return normalizedMessage.slice(0, maxWidth);
  }

  return `${normalizedMessage.slice(0, maxWidth - 3)}...`;
}

function getRefreshIndicatorLabel(result: ReviewSessionFreshnessResult): string | null {
  if (result.hasComparisonUpdates && result.comparisonSummary != null) {
    const { filesChanged } = result.comparisonSummary;
    const changedLabel = `${filesChanged} ${filesChanged === 1 ? "file" : "files"} changed`;
    return result.hasGitHubUpdates ? `${changedLabel} + PR` : changedLabel;
  }

  if (result.hasComparisonUpdates) {
    return result.hasGitHubUpdates ? "updates + PR" : "updates available";
  }

  if (result.hasGitHubUpdates) {
    return "PR updated";
  }

  return null;
}

function buildReviewedFiles(
  files: PreparedReviewSession["files"],
  reviewedPaths: ReadonlySet<string>,
): ReviewedFileState[] {
  return files.flatMap((file) =>
    reviewedPaths.has(file.path)
      ? [{ fingerprint: buildReviewedFileFingerprint(file), path: file.path }]
      : [],
  );
}

function restoreReviewedPaths(
  files: PreparedReviewSession["files"],
  cacheState?: Pick<ReviewCacheState, "reviewedFiles" | "reviewedPaths">,
): Set<string> {
  if (cacheState?.reviewedFiles != null) {
    const reviewedFingerprintsByPath = new Map<string, Set<string>>();

    for (const reviewedFile of cacheState.reviewedFiles) {
      const fingerprints = reviewedFingerprintsByPath.get(reviewedFile.path) ?? new Set<string>();
      fingerprints.add(reviewedFile.fingerprint);
      reviewedFingerprintsByPath.set(reviewedFile.path, fingerprints);
    }

    return new Set(
      files.flatMap((file) => {
        const fingerprints = reviewedFingerprintsByPath.get(file.path);
        if (fingerprints?.has(buildReviewedFileFingerprint(file)) !== true) {
          return [];
        }

        return [file.path];
      }),
    );
  }

  if (cacheState?.reviewedPaths != null) {
    const availablePaths = new Set(files.map((file) => file.path));
    return new Set(cacheState.reviewedPaths.filter((path) => availablePaths.has(path)));
  }

  return new Set();
}

function getTreeSummaryLabels({
  additions,
  deletions,
  reviewedCount,
  sidebarWidth,
  totalFiles,
}: {
  additions: number;
  deletions: number;
  reviewedCount: number;
  sidebarWidth: number;
  totalFiles: number;
}) {
  const contentWidth = Math.max(sidebarWidth - 6, 0);
  const variants = [
    {
      reviewed: `${reviewedCount} / ${totalFiles} reviewed`,
      diffAdditions: `+${additions}`,
      diffSeparator: " / ",
      diffDeletions: `-${deletions}`,
    },
    {
      reviewed: `${reviewedCount}/${totalFiles} rev`,
      diffAdditions: `+${additions}`,
      diffSeparator: "/",
      diffDeletions: `-${deletions}`,
    },
    {
      reviewed: `${reviewedCount}/${totalFiles}`,
      diffAdditions: `+${additions}`,
      diffSeparator: "/",
      diffDeletions: `-${deletions}`,
    },
  ];

  return (
    variants.find(
      ({ reviewed, diffAdditions, diffSeparator, diffDeletions }) =>
        reviewed.length + diffAdditions.length + diffSeparator.length + diffDeletions.length + 1 <=
        contentWidth,
    ) ?? variants[variants.length - 1]!
  );
}

export function DiffdiffApp({
  addPullRequestComment,
  addReviewThread,
  initialGitHubPreferences,
  initialReviewCache,
  initialSession,
  initialOptions,
  loadSession,
  logFilePath,
  mergePullRequest,
  onExit,
  probeFreshness = probeReviewSessionFreshness,
  replyToReviewComment,
  removeCleanupRefs,
  startupInstrumentation,
  submitPendingReview,
  syncRemotes = syncGitRemotes,
  syntaxStyle,
  theme,
}: DiffdiffAppProps) {
  const launchInPullRequestList = initialOptions.initialListMode === "pull-requests";
  const [session, setSession] = useState(initialSession);
  const [startupOptions, setStartupOptions] = useState<LaunchOptions>({ ...initialOptions });
  const [selectedFileIndex, setSelectedFileIndex] = useState(() => {
    if (initialReviewCache?.selectedFilePath != null) {
      const cachedIndex = initialSession.files.findIndex(
        (file) => file.path === initialReviewCache.selectedFilePath,
      );
      if (cachedIndex >= 0) {
        return cachedIndex;
      }
    }
    return 0;
  });
  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(() => {
    return restoreReviewedPaths(initialSession.files, initialReviewCache);
  });
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => {
    const baseline = reconcileCollapsedPaths(new Set<string>(), initialSession.files);
    if (initialReviewCache != null) {
      const availablePaths = new Set(initialSession.files.map((file) => file.path));
      for (const path of initialReviewCache.collapsedPaths) {
        if (availablePaths.has(path)) {
          baseline.add(path);
        }
      }
    }
    return baseline;
  });
  const [statusMessage, setStatusMessage] = useState<string>(
    launchInPullRequestList ? "Opened list modal." : "Ready.",
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorToastMessage, setErrorToastMessage] = useState<string | null>(null);
  const [baseBranchLoadingMessage, setBaseBranchLoadingMessage] = useState<string | null>(null);
  const [cleanupCandidateIndex, setCleanupCandidateIndex] = useState(0);
  const [cleanupCandidates, setCleanupCandidates] = useState<GitHubRefCleanupCandidate[]>([]);
  const [cleanupSelection, setCleanupSelection] = useState<GitHubCleanupPreferences>(
    () => initialGitHubPreferences?.cleanup ?? getDefaultGitHubPreferences().cleanup,
  );
  const [gitHubPreferences, setGitHubPreferences] = useState<GitHubUserPreferences>(
    () => initialGitHubPreferences ?? getDefaultGitHubPreferences(),
  );
  const gitHubPreferencesRef = useRef<GitHubUserPreferences>(
    initialGitHubPreferences ?? getDefaultGitHubPreferences(),
  );
  const leaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSessionLoadIdRef = useRef(0);
  const [dialogStack, setDialogStack] = useState<readonly AppDialog[]>(() =>
    launchInPullRequestList ? ["branch"] : [],
  );
  const [commentCollapseStates, setCommentCollapseStates] = useState<Record<string, boolean>>(
    () => initialReviewCache?.commentCollapseStates ?? {},
  );
  const [showKeyLegend, setShowKeyLegend] = useState(true);
  const showHelp = hasOpenDialog(dialogStack, "help");
  const showBranchModal = hasOpenDialog(dialogStack, "branch");
  const showCleanupModal = hasOpenDialog(dialogStack, "cleanup");
  const showCommentComposer = hasOpenDialog(dialogStack, "comment-composer");
  const showCommandModal = hasOpenDialog(dialogStack, "command-palette");
  const showCommentsModal = hasOpenDialog(dialogStack, "comments");
  const showListFilterModal = hasOpenDialog(dialogStack, "list-filter");
  const showMergeModal = hasOpenDialog(dialogStack, "merge");
  const showSubmitReviewModal = hasOpenDialog(dialogStack, "submit-review");
  const [activeListView, setActiveListView] = useState<ListModalView>("branch");
  const [branchListFilters, setBranchListFilters] = useState<BranchListFilters>({
    ...(launchInPullRequestList
      ? {
          workingTree: false,
          localBranch: false,
          openPr: true,
          remoteBranch: false,
        }
      : DEFAULT_BRANCH_LIST_FILTERS),
  });
  const [branchListIndex, setBranchListIndex] = useState(0);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [commitListIndex, setCommitListIndex] = useState(0);
  const [commitSearchQuery, setCommitSearchQuery] = useState("");
  const [commitSearchActive, setCommitSearchActive] = useState(false);
  const [filterIndex, setFilterIndex] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isSubmittingReviewAction, setIsSubmittingReviewAction] = useState(false);
  const [leaderActive, setLeaderActive] = useState(false);
  const [refreshIndicatorLabel, setRefreshIndicatorLabel] = useState<string | null>(null);
  const [diffViewPreference, setDiffViewPreference] = useState<DiffViewPreference>("unified");
  const [mergeCommitMessage, setMergeCommitMessage] = useState("");
  const [mergeCommitTitle, setMergeCommitTitle] = useState("");
  const [mergeMethod, setMergeMethod] = useState<GitHubMergeMethod | undefined>(
    initialGitHubPreferences?.defaultMergeMethod,
  );
  const [mergeModalField, setMergeModalField] = useState<MergeModalField>(
    initialGitHubPreferences?.defaultMergeMethod == null ? "method" : "title",
  );
  const [reviewComposerTarget, setReviewComposerTarget] = useState<ReviewComposerTarget | null>(
    null,
  );
  const [reviewComposerBody, setReviewComposerBody] = useState("");
  const [pullRequestConversationIndex, setPullRequestConversationIndex] = useState(0);
  const [selectedReviewCommentIndexByThreadId, setSelectedReviewCommentIndexByThreadId] = useState<
    Record<string, number>
  >({});
  const [selectedReviewThreadIndexByFilePath, setSelectedReviewThreadIndexByFilePath] = useState<
    Record<string, number>
  >({});
  const [reviewSubmissionBody, setReviewSubmissionBody] = useState("");
  const [reviewSubmissionEventIndex, setReviewSubmissionEventIndex] = useState(0);
  const [selectedReviewAnchorIndex, setSelectedReviewAnchorIndex] = useState(0);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [activePane, setActivePane] = useState<AppPane>("diff");
  const [collapsedDirectories, setCollapsedDirectories] = useState<Set<string>>(new Set());
  const [diffViewportMetrics, setDiffViewportMetrics] = useState<DiffViewportMetrics>({
    height: 0,
    scrollTop: 0,
  });
  const [selectedTreePath, setSelectedTreePath] = useState(initialSession.files[0]?.path ?? "");
  const [loadingIndicatorFrame, setLoadingIndicatorFrame] = useState(0);
  const treeScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const treeRowRefs = useRef<(BoxRenderable | null)[]>([]);
  const mergeBodyScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const fileCardRefs = useRef<(BoxRenderable | null)[]>([]);
  const pendingSelectedFileScrollOffsetRef = useRef(0);
  const pendingInteractionRef = useRef<PendingInteraction | null>(null);
  const pendingReviewCacheRef = useRef<{ key: ReviewCacheKey; state: ReviewCacheState } | null>(
    null,
  );
  const pendingSessionActivityRef = useRef<SessionActivityUpdate | null>(null);
  const pendingInteractionTokenRef = useRef(0);
  const reviewCacheTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionActivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalFocusedRef = useRef(true);
  const renderer = useRenderer();
  const terminalDimensions = useTerminalDimensions();
  const sidebarWidth = useMemo(
    () => getFileTreeSidebarWidth(terminalDimensions.width),
    [terminalDimensions.width],
  );
  const diffPaneWidth = useMemo(
    () => getDiffPaneWidth(terminalDimensions.width, sidebarWidth),
    [sidebarWidth, terminalDimensions.width],
  );
  const fileTreeNodes = useMemo(() => buildFileTreeNodes(session.files), [session.files]);
  const fileTreeNodeByPath = useMemo(
    () => new Map(fileTreeNodes.map((node) => [node.path, node])),
    [fileTreeNodes],
  );
  const fileTreeNodePaths = useMemo(() => new Set(fileTreeNodeByPath.keys()), [fileTreeNodeByPath]);
  const totalDiff = useMemo(
    () =>
      session.files.reduce(
        (sum, file) => ({
          additions: sum.additions + file.additions,
          deletions: sum.deletions + file.deletions,
        }),
        { additions: 0, deletions: 0 },
      ),
    [session.files],
  );
  const visibleTreeNodes = useMemo(
    () => getVisibleFileTreeNodes(fileTreeNodes, collapsedDirectories),
    [collapsedDirectories, fileTreeNodes],
  );
  const visibleTreeNodeIndexByPath = useMemo(
    () => new Map(visibleTreeNodes.map((node, index) => [node.path, index])),
    [visibleTreeNodes],
  );
  const reviewThreadsByPath = useMemo(() => {
    const threadsByPath = new Map<
      string,
      import("@diffdiff/core").GitHubPullRequestReviewThread[]
    >();

    for (const thread of session.github?.pullRequest.reviewThreads ?? EMPTY_REVIEW_THREADS) {
      const pathThreads = threadsByPath.get(thread.path);
      if (pathThreads == null) {
        threadsByPath.set(thread.path, [thread]);
        continue;
      }

      pathThreads.push(thread);
    }

    return threadsByPath;
  }, [session.github?.pullRequest.reviewThreads]);
  const pullRequestConversationItems =
    session.github?.pullRequest.conversationItems ?? EMPTY_CONVERSATION_ITEMS;
  const fileCardRootRefs = useMemo(
    () =>
      session.files.map((_, index) => (node: BoxRenderable | null) => {
        fileCardRefs.current[index] = node;
      }),
    [session.files],
  );
  const treeRowRefCallbacks = useMemo(
    () =>
      visibleTreeNodes.map((_, index) => (node: BoxRenderable | null) => {
        treeRowRefs.current[index] = node;
      }),
    [visibleTreeNodes],
  );
  const treeSummaryLabels = useMemo(
    () =>
      getTreeSummaryLabels({
        additions: totalDiff.additions,
        deletions: totalDiff.deletions,
        reviewedCount: reviewedPaths.size,
        sidebarWidth,
        totalFiles: session.files.length,
      }),
    [
      reviewedPaths.size,
      session.files.length,
      sidebarWidth,
      totalDiff.additions,
      totalDiff.deletions,
    ],
  );
  const diffView = useMemo(
    () => resolveDiffView(diffViewPreference, diffPaneWidth),
    [diffPaneWidth, diffViewPreference],
  );
  const selectedFileHasReviewAnchors = useMemo(
    () => getReviewAnchors(session.files[selectedFileIndex], diffView).length > 0,
    [diffView, selectedFileIndex, session.files],
  );
  const fileCardPreviewViewports = useMemo<(FileCardPreviewViewport | undefined)[]>(() => {
    const scrollBox = scrollRef.current;
    if (scrollBox == null || diffViewportMetrics.height <= 0) {
      return session.files.map(() => undefined);
    }

    const contentTop = scrollBox.content.y;

    return session.files.map((_, index) => {
      const fileCard = fileCardRefs.current[index];
      if (fileCard == null) {
        return undefined;
      }

      const fileTop = fileCard.y - contentTop;

      return {
        bottom: diffViewportMetrics.scrollTop + diffViewportMetrics.height - fileTop,
        overscan: 6,
        top: diffViewportMetrics.scrollTop - fileTop,
      };
    });
  }, [diffViewportMetrics.height, diffViewportMetrics.scrollTop, session.files]);
  const diffRenderSurface = useMemo<RenderSurfaceMetrics>(() => {
    let collapsedFileCount = 0;
    let expandedFileCount = 0;
    let renderedPreviewFileCount = 0;
    let renderedUnifiedLineCount = 0;
    let renderedSplitRowCount = 0;
    let renderedThreadCount = 0;

    for (const [index, file] of session.files.entries()) {
      if (collapsedPaths.has(file.path)) {
        collapsedFileCount += 1;
        continue;
      }

      expandedFileCount += 1;
      const reviewThreads = reviewThreadsByPath.get(file.path) ?? EMPTY_REVIEW_THREADS;
      const previewViewport = fileCardPreviewViewports[index];
      const hasSelectedReviewAnchor = index === selectedFileIndex && selectedFileHasReviewAnchors;

      if (diffView === "split") {
        renderedPreviewFileCount += 1;
        renderedThreadCount += reviewThreads.length;
        renderedSplitRowCount += file.sideBySideRows.length;
        continue;
      }

      if (
        shouldVirtualizeUnifiedPreview({
          hasSelectedReviewAnchor,
          previewViewport,
          reviewThreadCount: reviewThreads.length,
        })
      ) {
        const virtualWindow = getUnifiedVirtualWindow({
          file,
          previewViewport: previewViewport!,
          terminalWidth: diffPaneWidth,
        });
        const renderedLineCount =
          virtualWindow == null
            ? file.unifiedLines.length
            : Math.max(virtualWindow.endIndex - virtualWindow.startIndex + 1, 0);

        if (renderedLineCount > 0) {
          renderedPreviewFileCount += 1;
        }

        renderedUnifiedLineCount += renderedLineCount;
        continue;
      }

      renderedPreviewFileCount += 1;
      renderedThreadCount += reviewThreads.length;
      renderedUnifiedLineCount += file.unifiedLines.length;
    }

    return {
      collapsedFileCount,
      deferredPreviewCount: 0,
      expandedFileCount,
      fileCount: session.files.length,
      renderedPreviewFileCount,
      renderedSplitRowCount,
      renderedThreadCount,
      renderedUnifiedLineCount,
    };
  }, [
    collapsedPaths,
    diffPaneWidth,
    diffView,
    fileCardPreviewViewports,
    reviewThreadsByPath,
    selectedFileHasReviewAnchors,
    selectedFileIndex,
    session.files,
  ]);
  const branchItems = useMemo(
    () =>
      buildBranchListItems({
        filters: branchListFilters,
        localBranches: session.branches.local,
        remoteBranches: session.branches.remote,
        workingTreeSummary: session.workingTreeSummary,
      }),
    [
      branchListFilters,
      session.branches.local,
      session.branches.remote,
      session.workingTreeSummary,
    ],
  );
  const commitItems = useMemo(() => buildCommitListItems(session.commits), [session.commits]);
  const filteredCommitItems = useMemo(
    () => filterCommitListItems(commitItems, commitSearchQuery),
    [commitItems, commitSearchQuery],
  );
  const stickyFile = session.files[activeFileIndex];
  const selectedBranchItem = branchItems[clampIndex(branchListIndex, branchItems.length)];
  const selectedCommitItem =
    filteredCommitItems[clampIndex(commitListIndex, filteredCommitItems.length)];
  const selectedTreeNode =
    selectedTreePath === "" ? undefined : fileTreeNodeByPath.get(selectedTreePath);
  const selectedFilePath = session.files[selectedFileIndex]?.path;
  const selectedFileReviewThreads = useMemo(
    () =>
      selectedFilePath == null
        ? EMPTY_REVIEW_THREADS
        : (reviewThreadsByPath.get(selectedFilePath) ?? EMPTY_REVIEW_THREADS),
    [reviewThreadsByPath, selectedFilePath],
  );
  const selectedReviewThreadIndex =
    selectedFilePath == null
      ? 0
      : clampIndex(
          selectedReviewThreadIndexByFilePath[selectedFilePath] ?? 0,
          selectedFileReviewThreads.length,
        );
  const selectedReviewThread = selectedFileReviewThreads[selectedReviewThreadIndex];
  const selectedReviewCommentIndex =
    selectedReviewThread == null
      ? 0
      : clampIndex(
          selectedReviewCommentIndexByThreadId[selectedReviewThread.id] ?? 0,
          selectedReviewThread.comments.length,
        );
  const selectedReviewComment = selectedReviewThread?.comments[selectedReviewCommentIndex];
  const selectedPullRequestConversationItem =
    pullRequestConversationItems[
      clampIndex(pullRequestConversationIndex, pullRequestConversationItems.length)
    ];
  const reviewComposerContext =
    reviewComposerTarget == null ? null : getReviewComposerContext(reviewComposerTarget);
  const selectedReviewAnchors = useMemo(
    () => getReviewAnchors(session.files[selectedFileIndex], diffView),
    [diffView, selectedFileIndex, session.files],
  );
  const selectedReviewAnchor =
    selectedReviewAnchors[clampIndex(selectedReviewAnchorIndex, selectedReviewAnchors.length)];
  const hasSelectedReviewThread = selectedReviewThread != null && selectedReviewComment != null;
  const openPrCount = session.branches.remote.filter((branch) => branch.pullRequest != null).length;
  const remoteBranchCount = session.branches.remote.length - openPrCount;
  const commandListLabel = formatCommandKeybind(COMMAND_LIST_KEYBIND, LEADER_KEYBIND) ?? "ctrl+p";
  const leaderKeyLabel = formatCommandKeybind(LEADER_KEYBIND, LEADER_KEYBIND) ?? "ctrl+x";
  const keyLegendToggleLabel = showKeyLegend ? "hide keys" : "show keys";
  const commands = useMemo<AppCommand[]>(
    () => [
      {
        category: "System",
        description: "Open the searchable command palette.",
        keybind: COMMAND_LIST_KEYBIND,
        suggested: true,
        title: "Open command palette",
        value: "system.command-palette",
        run: () => openCommandModal(),
      },
      {
        category: "System",
        description: "Show keyboard shortcuts and usage help.",
        keybind: "<leader>h",
        suggested: true,
        title: "Open help",
        value: "system.help",
        run: () => {
          openHelp();
        },
      },
      {
        category: "System",
        description: "Show or hide the shortcut legend in the sidebar.",
        keybind: "<leader>z,z",
        title: showKeyLegend ? "Hide key legend" : "Show key legend",
        value: "system.key-legend",
        run: () => toggleKeyLegend(),
      },
      {
        category: "System",
        description: "Close diffdiff.",
        keybind: "<leader>q,q",
        title: "Quit",
        value: "system.quit",
        run: () => onExit(),
      },
      {
        category: "View",
        description: "Move focus between the file tree and diff panes.",
        keybind: "<leader>p,tab",
        suggested: true,
        title: "Switch active pane",
        value: "view.pane-toggle",
        run: () => toggleActivePane(),
      },
      {
        category: "View",
        description: "Toggle between unified and side-by-side diffs.",
        keybind: "<leader>v,v",
        suggested: true,
        title: "Toggle diff view",
        value: "view.diff-toggle",
        run: () => toggleDiffView(),
      },
      {
        category: "Comparison",
        description: "Browse the working tree, branches, PRs, and commits.",
        keybind: "<leader>l,l",
        suggested: true,
        title: "Open comparison list",
        value: "comparison.list",
        run: () => openBranchModal(),
      },
      {
        category: "Review",
        description: "Mark the selected file as reviewed or not reviewed.",
        keybind: "<leader>r,r",
        suggested: true,
        title: "Toggle reviewed",
        value: "review.toggle-reviewed",
        run: () => toggleReviewed(selectedFileIndex),
      },
      {
        category: "Review",
        description: "Mark every file in the current comparison as reviewed.",
        keybind: "shift+r",
        title: "Mark all reviewed",
        value: "review.mark-all-reviewed",
        run: () => markAllReviewed(),
      },
      {
        category: "Review",
        description: "Clear the reviewed state from every file in the current comparison.",
        keybind: "alt+r",
        title: "Unmark all reviewed",
        value: "review.clear-reviewed",
        run: () => clearReviewed(),
      },
      {
        category: "Review",
        description: "Collapse or expand the selected file diff.",
        keybind: "<leader>c,c,return",
        title: "Toggle collapsed",
        value: "review.toggle-collapsed",
        run: () => toggleCollapsed(selectedFileIndex),
      },
      {
        category: "GitHub",
        description: "Show the pull request conversation timeline.",
        enabled: session.github != null,
        keybind: "<leader>t,t",
        suggested: session.github != null,
        title: "Open PR comments",
        value: "github.comments",
        run: () => {
          openPullRequestCommentsModal();
        },
      },
      {
        category: "GitHub",
        description: "Copy the current pull request URL to the clipboard.",
        enabled: session.github != null,
        keybind: "<leader>y,y",
        title: "Copy PR URL",
        value: "github.copy-url",
        run: () => {
          void copyPullRequestUrl();
        },
      },
      {
        category: "GitHub",
        description: "Reply to the focused inline review thread.",
        enabled: hasSelectedReviewThread,
        keybind: "r",
        title: "Reply to focused thread",
        value: "github.reply-thread",
        run: () => openFocusedReviewThreadReplyComposer(),
      },
      {
        category: "GitHub",
        description: "Collapse or expand the focused inline review thread.",
        enabled: selectedReviewThread != null,
        keybind: "c",
        title: "Toggle focused thread",
        value: "github.toggle-thread",
        run: () => toggleFocusedReviewThreadCollapsed(),
      },
      {
        category: "GitHub",
        description: "Copy the URL for the focused inline review comment.",
        enabled: hasSelectedReviewThread,
        keybind: "y",
        title: "Copy focused comment URL",
        value: "github.copy-comment-url",
        run: () => {
          void copyFocusedReviewCommentUrl();
        },
      },
      {
        category: "GitHub",
        description: "Create a review comment on the selected diff line.",
        enabled: session.github != null,
        keybind: "<leader>a,a",
        suggested: session.github != null,
        title: "Add review comment",
        value: "github.add-comment",
        run: () => openCommentComposer(),
      },
      {
        category: "GitHub",
        description: "Submit the pending review to GitHub.",
        enabled: session.github != null,
        keybind: "<leader>s,s",
        suggested: session.github != null,
        title: "Submit review",
        value: "github.submit-review",
        run: () => openSubmitReviewModal(),
      },
      {
        category: "GitHub",
        description: "Merge the pull request with the selected merge strategy.",
        enabled: session.github != null,
        keybind: "<leader>m,m",
        suggested: session.github != null,
        title: "Merge pull request",
        value: "github.merge",
        run: () => openMergeModal(),
      },
    ],
    [
      copyPullRequestUrl,
      openBranchModal,
      openCommandModal,
      onExit,
      openCommentComposer,
      hasSelectedReviewThread,
      openMergeModal,
      openFocusedReviewThreadReplyComposer,
      openHelp,
      openPullRequestCommentsModal,
      openSubmitReviewModal,
      selectedFileIndex,
      selectedReviewThread,
      session.github,
      showKeyLegend,
      clearReviewed,
      copyFocusedReviewCommentUrl,
      markAllReviewed,
      toggleCollapsed,
      toggleFocusedReviewThreadCollapsed,
      toggleActivePane,
      toggleDiffView,
      toggleKeyLegend,
      toggleReviewed,
    ],
  );
  const visibleCommands = useMemo(
    () => commands.filter((command) => command.enabled !== false && command.hidden !== true),
    [commands],
  );
  const filteredCommands = useMemo(
    () => filterCommands(visibleCommands, commandQuery),
    [commandQuery, visibleCommands],
  );
  const footerEvent = useMemo(() => {
    if (errorToastMessage != null) {
      return {
        color: theme.danger,
        message: errorToastMessage,
      };
    }

    if (toastMessage != null) {
      return {
        color: theme.success,
        message: `✓ ${toastMessage}`,
      };
    }

    if (baseBranchLoadingMessage != null) {
      return {
        color: theme.accent,
        message: `${LOADING_INDICATOR_FRAMES[loadingIndicatorFrame]} ${baseBranchLoadingMessage}`,
      };
    }

    return {
      color: isReloading || leaderActive ? theme.accent : theme.textMuted,
      message: statusMessage,
    };
  }, [
    baseBranchLoadingMessage,
    errorToastMessage,
    isReloading,
    leaderActive,
    loadingIndicatorFrame,
    statusMessage,
    theme.accent,
    theme.danger,
    theme.success,
    theme.textMuted,
    toastMessage,
  ]);
  const footerEventMessage = useMemo(() => {
    const reservedWidth = commandListLabel.length + keyLegendToggleLabel.length + 28;
    return truncateInlineMessage(
      footerEvent.message,
      Math.max(terminalDimensions.width - reservedWidth, 0),
    );
  }, [commandListLabel, footerEvent.message, keyLegendToggleLabel, terminalDimensions.width]);
  const canApplyCleanup =
    (cleanupCandidates.some((candidate) => candidate.kind === "local-branch") &&
      cleanupSelection.removeLocal) ||
    (cleanupCandidates.some((candidate) => candidate.kind === "remote-tracking") &&
      cleanupSelection.removeRemote);
  const activeOverlay = getActiveDialog(dialogStack);
  const keyboardHandlerRef = useRef<(key: KeyboardInput) => void>(() => undefined);
  const resolvedLogFilePath =
    logFilePath ?? getDiffdiffLogSession()?.logFilePath ?? "~/.diffdiff/logs/log-unknown.jsonl";

  const flushPendingSessionActivity = useCallback(() => {
    const pendingActivity = pendingSessionActivityRef.current;
    pendingSessionActivityRef.current = null;

    if (pendingActivity == null) {
      return Promise.resolve();
    }

    return updateDiffdiffSessionActivity(pendingActivity);
  }, []);

  const scheduleSessionActivity = useCallback(
    (activity: SessionActivityUpdate, delayMs = 120) => {
      pendingSessionActivityRef.current = {
        ...pendingSessionActivityRef.current,
        ...activity,
      };

      if (sessionActivityTimeoutRef.current != null) {
        clearTimeout(sessionActivityTimeoutRef.current);
      }

      sessionActivityTimeoutRef.current = setTimeout(() => {
        sessionActivityTimeoutRef.current = null;
        void flushPendingSessionActivity();
      }, delayMs);
    },
    [flushPendingSessionActivity],
  );

  const flushPendingReviewCache = useCallback(() => {
    const pendingCache = pendingReviewCacheRef.current;
    pendingReviewCacheRef.current = null;

    if (pendingCache == null) {
      return Promise.resolve();
    }

    return saveReviewCache(pendingCache.key, pendingCache.state);
  }, []);

  const scheduleReviewCacheSave = useCallback(
    (key: ReviewCacheKey, state: ReviewCacheState, delayMs = 200) => {
      pendingReviewCacheRef.current = { key, state };

      if (reviewCacheTimeoutRef.current != null) {
        clearTimeout(reviewCacheTimeoutRef.current);
      }

      reviewCacheTimeoutRef.current = setTimeout(() => {
        reviewCacheTimeoutRef.current = null;
        void flushPendingReviewCache();
      }, delayMs);
    },
    [flushPendingReviewCache],
  );

  const startInteraction = useCallback(
    (
      kind: string,
      options: {
        details?: Record<string, unknown>;
        expectedDiffView?: "split" | "unified";
        expectedPane?: AppPane;
        expectedSelectedFilePath?: string;
        expectedSelectedTreePath?: string;
      } = {},
    ) => {
      pendingInteractionTokenRef.current += 1;
      pendingInteractionRef.current = {
        details: options.details,
        expectedDiffView: options.expectedDiffView,
        expectedPane: options.expectedPane,
        expectedSelectedFilePath: options.expectedSelectedFilePath,
        expectedSelectedTreePath: options.expectedSelectedTreePath,
        kind,
        startedAt: getMonotonicNow(),
        token: pendingInteractionTokenRef.current,
      };
    },
    [],
  );

  const dismissErrorToast = useCallback(() => {
    setErrorToastMessage((currentMessage) => {
      if (currentMessage != null) {
        logDiffdiffInfo("app", "error_toast_dismissed", {
          logFilePath: resolvedLogFilePath,
          message: currentMessage,
        });
      }

      return null;
    });
  }, [resolvedLogFilePath]);

  useEffect(() => {
    setCommandIndex((currentIndex) => clampIndex(currentIndex, filteredCommands.length));
  }, [filteredCommands.length]);

  useEffect(() => {
    return () => {
      if (leaderTimeoutRef.current != null) {
        clearTimeout(leaderTimeoutRef.current);
      }

      if (reviewCacheTimeoutRef.current != null) {
        clearTimeout(reviewCacheTimeoutRef.current);
      }

      if (sessionActivityTimeoutRef.current != null) {
        clearTimeout(sessionActivityTimeoutRef.current);
      }

      void flushPendingReviewCache();
      void flushPendingSessionActivity();
    };
  }, [flushPendingReviewCache, flushPendingSessionActivity]);

  const showErrorToast = useCallback(
    (contextMessage?: string) => {
      const message =
        contextMessage == null
          ? `View error logs at ${resolvedLogFilePath}`
          : `${contextMessage}  View error logs at ${resolvedLogFilePath}`;

      setErrorToastMessage(message);
      logDiffdiffWarn("app", "error_toast_shown", {
        logFilePath: resolvedLogFilePath,
        message,
      });
    },
    [resolvedLogFilePath],
  );

  const handleAppError = useCallback(
    (error: unknown, fallbackMessage: string, context: Record<string, unknown>) => {
      const message = error instanceof Error ? error.message : fallbackMessage;
      logDiffdiffError("app", "ui_action_failed", error, {
        ...context,
        fallbackMessage,
        logFilePath: resolvedLogFilePath,
        message,
      });
      void updateDiffdiffSessionActivity({
        lastErrorMessage: message,
        statusMessage: message,
      });
      setStatusMessage(message);
      showErrorToast(message);
    },
    [resolvedLogFilePath, showErrorToast],
  );

  const handleAppFailure = useCallback(
    (message: string, context: Record<string, unknown>) => {
      logDiffdiffWarn("app", "ui_action_failed_without_exception", {
        ...context,
        logFilePath: resolvedLogFilePath,
        message,
      });
      void updateDiffdiffSessionActivity({
        lastErrorMessage: message,
        statusMessage: message,
      });
      setStatusMessage(message);
      showErrorToast(message);
    },
    [resolvedLogFilePath, showErrorToast],
  );

  const persistGitHubPreferences = useCallback(
    async (nextPreferences: GitHubUserPreferences) => {
      setGitHubPreferences(nextPreferences);
      try {
        await saveDiffdiffPreferences({ github: nextPreferences });
      } catch (error) {
        handleAppError(error, "Unable to save diffdiff preferences.", {
          action: "save-preferences",
          preferences: nextPreferences,
        });
      }
    },
    [handleAppError],
  );

  const updateCleanupSelection = useCallback(
    (updater: (currentSelection: GitHubCleanupPreferences) => GitHubCleanupPreferences) => {
      setCleanupSelection((currentSelection) => {
        const nextSelection = updater(currentSelection);
        void persistGitHubPreferences({
          ...gitHubPreferencesRef.current,
          cleanup: nextSelection,
        });
        return nextSelection;
      });
    },
    [persistGitHubPreferences],
  );

  useEffect(() => {
    gitHubPreferencesRef.current = gitHubPreferences;
  }, [gitHubPreferences]);

  useEffect(() => {
    if (session.github == null) {
      setCleanupCandidates([]);
      setReviewComposerTarget(null);
      setReviewComposerBody("");
      setDialogStack((currentStack) => {
        const nextStack = currentStack.filter((dialog) => !GITHUB_DIALOGS.has(dialog));
        return nextStack.length === currentStack.length ? currentStack : nextStack;
      });
    }
  }, [session.github]);

  useEffect(() => {
    setSelectedReviewAnchorIndex((currentIndex) =>
      clampIndex(currentIndex, selectedReviewAnchors.length),
    );
  }, [selectedReviewAnchors.length]);

  useEffect(() => {
    if (selectedFilePath == null || selectedFileReviewThreads.length === 0) {
      return;
    }

    setSelectedReviewThreadIndexByFilePath((currentIndexes) => {
      const nextIndex = clampIndex(
        currentIndexes[selectedFilePath] ?? 0,
        selectedFileReviewThreads.length,
      );
      return currentIndexes[selectedFilePath] === nextIndex
        ? currentIndexes
        : {
            ...currentIndexes,
            [selectedFilePath]: nextIndex,
          };
    });
  }, [selectedFilePath, selectedFileReviewThreads.length]);

  useEffect(() => {
    if (selectedReviewThread == null) {
      return;
    }

    setSelectedReviewCommentIndexByThreadId((currentIndexes) => {
      const nextIndex = clampIndex(
        currentIndexes[selectedReviewThread.id] ?? 0,
        selectedReviewThread.comments.length,
      );
      return currentIndexes[selectedReviewThread.id] === nextIndex
        ? currentIndexes
        : {
            ...currentIndexes,
            [selectedReviewThread.id]: nextIndex,
          };
    });
  }, [selectedReviewThread]);

  useEffect(() => {
    setPullRequestConversationIndex((currentIndex) =>
      clampIndex(currentIndex, pullRequestConversationItems.length),
    );
  }, [pullRequestConversationItems.length]);

  useEffect(() => {
    setSelectedFileIndex((currentIndex) => clampIndex(currentIndex, session.files.length));
  }, [session.files.length]);

  useEffect(() => {
    setActiveFileIndex((currentIndex) => clampIndex(currentIndex, session.files.length));
  }, [session.files.length]);

  useEffect(() => {
    fileCardRefs.current.length = session.files.length;
  }, [session.files.length]);

  useEffect(() => {
    treeRowRefs.current.length = visibleTreeNodes.length;
  }, [visibleTreeNodes.length]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current != null) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (baseBranchLoadingMessage == null) {
      setLoadingIndicatorFrame(0);
      return;
    }

    const intervalId = setInterval(() => {
      setLoadingIndicatorFrame(
        (currentFrame) => (currentFrame + 1) % LOADING_INDICATOR_FRAMES.length,
      );
    }, 80);

    return () => {
      clearInterval(intervalId);
    };
  }, [baseBranchLoadingMessage]);

  useEffect(() => {
    setCollapsedPaths((currentPaths) => {
      const nextPaths = reconcileCollapsedPaths(currentPaths, session.files);
      return haveSamePaths(currentPaths, nextPaths) ? currentPaths : nextPaths;
    });
  }, [session.files]);

  useEffect(() => {
    setCollapsedDirectories((currentPaths) => {
      const nextPaths = reconcileCollapsedDirectories(currentPaths, fileTreeNodes);
      return haveSamePaths(currentPaths, nextPaths) ? currentPaths : nextPaths;
    });
  }, [fileTreeNodes]);

  useEffect(() => {
    if (fileTreeNodes.length === 0) {
      setSelectedTreePath("");
      return;
    }

    const selectedFilePath = session.files[selectedFileIndex]?.path;
    setSelectedTreePath((currentPath) => {
      if (currentPath !== "" && fileTreeNodePaths.has(currentPath)) {
        return currentPath;
      }

      if (selectedFilePath != null && fileTreeNodePaths.has(selectedFilePath)) {
        return selectedFilePath;
      }

      return fileTreeNodes[0]?.path ?? "";
    });
  }, [fileTreeNodePaths, fileTreeNodes, selectedFileIndex, session.files]);

  useEffect(() => {
    const selectedFilePath = session.files[selectedFileIndex]?.path;
    if (activePane !== "diff" || selectedFilePath == null) {
      return;
    }

    setCollapsedDirectories((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      let changed = false;

      for (const path of getAncestorDirectoryPaths(selectedFilePath)) {
        if (nextPaths.delete(path)) {
          changed = true;
        }
      }

      return changed ? nextPaths : currentPaths;
    });
    setSelectedTreePath(selectedFilePath);
  }, [activePane, selectedFileIndex, session.files]);

  const getFileTopOffsets = useCallback((): number[] => {
    const scrollBox = scrollRef.current;
    if (scrollBox == null) {
      return [];
    }

    const contentTop = scrollBox.content.y;

    return session.files.map((_, index) => {
      const fileCard = fileCardRefs.current[index];
      return fileCard == null ? Number.POSITIVE_INFINITY : fileCard.y - contentTop;
    });
  }, [session.files]);

  const getTreeTopOffsets = useCallback((): number[] => {
    const scrollBox = treeScrollRef.current;
    if (scrollBox == null) {
      return [];
    }

    const contentTop = scrollBox.content.y;

    return visibleTreeNodes.map((_, index) => {
      const row = treeRowRefs.current[index];
      return row == null ? Number.POSITIVE_INFINITY : row.y - contentTop;
    });
  }, [visibleTreeNodes]);

  useEffect(() => {
    setBranchListIndex((currentIndex) => clampIndex(currentIndex, branchItems.length));
  }, [branchItems.length]);

  useEffect(() => {
    setCommitListIndex((currentIndex) => clampIndex(currentIndex, commitItems.length));
  }, [commitItems.length]);

  useEffect(() => {
    const scrollBox = scrollRef.current;
    const offset = getFileTopOffsets()[selectedFileIndex];
    if (scrollBox == null || offset == null || !Number.isFinite(offset)) {
      return;
    }

    const scrollOffset = pendingSelectedFileScrollOffsetRef.current;
    pendingSelectedFileScrollOffsetRef.current = 0;
    scrollBox.scrollTo({ x: 0, y: Math.max(offset + scrollOffset, 0) });
    setActiveFileIndex(selectedFileIndex);
  }, [getFileTopOffsets, selectedFileIndex]);

  useEffect(() => {
    const selectedTreeIndex = visibleTreeNodeIndexByPath.get(selectedTreePath) ?? -1;
    const offset = getTreeTopOffsets()[selectedTreeIndex];
    const scrollBox = treeScrollRef.current;
    if (scrollBox == null || offset == null || !Number.isFinite(offset)) {
      return;
    }

    scrollBox.scrollTo({ x: 0, y: Math.max(offset - 2, 0) });
  }, [getTreeTopOffsets, selectedTreePath, visibleTreeNodeIndexByPath]);

  useEffect(() => {
    if (!showMergeModal || mergeModalField !== "body") {
      return;
    }

    mergeBodyScrollRef.current?.scrollTo({ x: 0, y: Number.MAX_SAFE_INTEGER });
  }, [mergeCommitMessage, mergeModalField, showMergeModal]);

  const syncActiveFileIndex = useCallback(() => {
    const scrollBox = scrollRef.current;
    if (scrollBox == null) {
      return;
    }

    const fileTopOffsets = getFileTopOffsets();
    const nextIndex = getTopIntersectingFileIndex(fileTopOffsets, scrollBox.scrollTop);
    const viewportHeight = scrollBox.viewport?.height ?? scrollBox.height ?? 0;

    setActiveFileIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
    setDiffViewportMetrics((currentMetrics) =>
      currentMetrics.scrollTop === scrollBox.scrollTop && currentMetrics.height === viewportHeight
        ? currentMetrics
        : { height: viewportHeight, scrollTop: scrollBox.scrollTop },
    );
  }, [getFileTopOffsets]);

  useEffect(() => {
    const scrollBox = scrollRef.current;
    if (scrollBox == null) {
      return;
    }

    syncActiveFileIndex();
    scrollBox.verticalScrollBar.on("change", syncActiveFileIndex);

    return () => {
      scrollBox.verticalScrollBar.off("change", syncActiveFileIndex);
    };
  }, [syncActiveFileIndex]);

  useEffect(() => {
    syncActiveFileIndex();
  }, [collapsedPaths, diffView, session.files, syncActiveFileIndex, terminalDimensions.width]);

  useEffect(() => {
    if (refreshIndicatorLabel == null) {
      return;
    }

    setRefreshIndicatorLabel(null);
  }, [session]);

  const syncRemoteState = useCallback(async () => {
    await syncRemotes(session.repository.rootPath);
  }, [session.repository.rootPath, syncRemotes]);

  const applyLoadedSession = useCallback(
    (nextSession: PreparedReviewSession) => {
      const scrollBox = scrollRef.current;
      const currentSelectedFilePath = session.files[selectedFileIndex]?.path;
      const currentSelectedFileOffset = getFileTopOffsets()[selectedFileIndex];

      if (
        scrollBox != null &&
        currentSelectedFilePath != null &&
        Number.isFinite(currentSelectedFileOffset) &&
        nextSession.files.some((file) => file.path === currentSelectedFilePath)
      ) {
        // Preserve the user's in-file viewport so refreshes don't jump the selected file back to
        // its header and hide the currently focused thread.
        pendingSelectedFileScrollOffsetRef.current =
          scrollBox.scrollTop - currentSelectedFileOffset;
      }

      setReviewedPaths(
        restoreReviewedPaths(nextSession.files, {
          reviewedFiles: buildReviewedFiles(session.files, reviewedPaths),
        }),
      );
      setSession(nextSession);
    },
    [getFileTopOffsets, reviewedPaths, selectedFileIndex, session.files],
  );

  const beginSessionLoad = useCallback(() => {
    const nextLoadId = latestSessionLoadIdRef.current + 1;
    latestSessionLoadIdRef.current = nextLoadId;
    return nextLoadId;
  }, []);

  const isLatestSessionLoad = useCallback((loadId: number, action: string) => {
    const isLatest = loadId === latestSessionLoadIdRef.current;

    if (!isLatest) {
      logDiffdiffInfo("app", "stale_session_load_dropped", {
        action,
        latestSessionLoadId: latestSessionLoadIdRef.current,
        loadId,
      });
    }

    return isLatest;
  }, []);

  const refreshGitState = useCallback(async () => {
    if (isReloading || isCheckingForUpdates) {
      return;
    }

    const selectedFilePath = session.files[selectedFileIndex]?.path;

    setIsReloading(true);
    setRefreshIndicatorLabel(null);
    setStatusMessage("Refreshing branches and GitHub data...");
    const sessionLoadId = beginSessionLoad();

    try {
      await syncRemoteState();
      const nextSession = await loadSession(startupOptions);
      if (!isLatestSessionLoad(sessionLoadId, "refresh-git-state")) {
        return;
      }
      const nextSelectedFileIndex =
        selectedFilePath == null
          ? -1
          : nextSession.files.findIndex((file) => file.path === selectedFilePath);

      applyLoadedSession(nextSession);
      if (nextSelectedFileIndex >= 0) {
        setSelectedFileIndex(nextSelectedFileIndex);
      }
      setStatusMessage("Refreshed branches and GitHub data.");
    } catch (error) {
      if (!isLatestSessionLoad(sessionLoadId, "refresh-git-state")) {
        return;
      }
      handleAppError(error, "Unable to refresh git state.", {
        action: "refresh-git-state",
        startupOptions,
      });
    } finally {
      setIsReloading(false);
    }
  }, [
    handleAppError,
    isCheckingForUpdates,
    isReloading,
    loadSession,
    applyLoadedSession,
    selectedFileIndex,
    session.files,
    startupOptions,
    syncRemoteState,
  ]);

  const checkForUpdates = useCallback(async () => {
    if (isReloading || isCheckingForUpdates) {
      return;
    }

    setIsCheckingForUpdates(true);

    try {
      const freshness = await probeFreshness(session);

      if (
        session.comparison.mode === "working-tree" &&
        (freshness.hasComparisonUpdates || freshness.hasGitHubUpdates)
      ) {
        const selectedFilePath = session.files[selectedFileIndex]?.path;

        setIsReloading(true);
        setRefreshIndicatorLabel(null);
        setStatusMessage("Updating working tree view...");
        const sessionLoadId = beginSessionLoad();

        try {
          const nextSession = await loadSession(startupOptions);
          if (!isLatestSessionLoad(sessionLoadId, "auto-refresh-working-tree-session")) {
            return;
          }
          const nextSelectedFileIndex =
            selectedFilePath == null
              ? -1
              : nextSession.files.findIndex((file) => file.path === selectedFilePath);

          applyLoadedSession(nextSession);
          if (nextSelectedFileIndex >= 0) {
            setSelectedFileIndex(nextSelectedFileIndex);
          }
          setStatusMessage("Updated working tree view.");
        } catch (error) {
          if (!isLatestSessionLoad(sessionLoadId, "auto-refresh-working-tree-session")) {
            return;
          }
          handleAppError(error, "Unable to refresh the working tree view.", {
            action: "auto-refresh-working-tree-session",
            startupOptions,
          });
        } finally {
          setIsReloading(false);
        }

        return;
      }

      const nextRefreshIndicatorLabel = getRefreshIndicatorLabel(freshness);

      setRefreshIndicatorLabel(nextRefreshIndicatorLabel);

      if (
        nextRefreshIndicatorLabel != null &&
        nextRefreshIndicatorLabel !== refreshIndicatorLabel
      ) {
        setStatusMessage(`${nextRefreshIndicatorLabel}. Press Shift+F to refresh.`);
      } else if (refreshIndicatorLabel != null) {
        setStatusMessage("Current comparison is up to date.");
      }
    } catch (error) {
      handleAppError(error, "Unable to refresh git state.", {
        action: "check-for-updates",
        comparison: session.comparison,
      });
    } finally {
      setIsCheckingForUpdates(false);
    }
  }, [
    handleAppError,
    isCheckingForUpdates,
    isReloading,
    probeFreshness,
    refreshIndicatorLabel,
    loadSession,
    applyLoadedSession,
    selectedFileIndex,
    session,
    startupOptions,
  ]);

  const syncGitStateOnFocus = useCallback(async () => {
    if (isReloading || isCheckingForUpdates) {
      return;
    }

    try {
      await syncRemoteState();
    } catch (error) {
      handleAppError(error, "Unable to refresh git state.", {
        action: "sync-remotes-on-focus",
        startupOptions,
      });
      return;
    }

    await checkForUpdates();
  }, [
    checkForUpdates,
    handleAppError,
    isCheckingForUpdates,
    isReloading,
    startupOptions,
    syncRemoteState,
  ]);

  useEffect(() => {
    const handleBlur = () => {
      terminalFocusedRef.current = false;
    };

    const handleFocus = () => {
      terminalFocusedRef.current = true;
      void syncGitStateOnFocus();
    };

    const intervalId = setInterval(() => {
      if (!terminalFocusedRef.current) {
        return;
      }

      void checkForUpdates();
    }, LIVE_REFRESH_INTERVAL_MS);

    renderer.on(TERMINAL_BLUR_EVENT, handleBlur);
    renderer.on(TERMINAL_FOCUS_EVENT, handleFocus);

    return () => {
      clearInterval(intervalId);
      renderer.off(TERMINAL_BLUR_EVENT, handleBlur);
      renderer.off(TERMINAL_FOCUS_EVENT, handleFocus);
    };
  }, [renderer, syncGitStateOnFocus]);

  keyboardHandlerRef.current = (key) => {
    logDiffdiffVerbose("app", "key_pressed", {
      activeOverlay,
      errorToastVisible: errorToastMessage != null,
      key,
      leaderActive,
      selectedFilePath: session.files[selectedFileIndex]?.path,
    });

    if (
      activeOverlay == null &&
      !leaderActive &&
      errorToastMessage != null &&
      (key.name === "escape" || key.name === "x")
    ) {
      dismissErrorToast();
      return;
    }

    if (activeOverlay === "command-palette") {
      handleCommandModalKey(key);
      return;
    }

    if (activeOverlay === "help") {
      if (key.name === "escape" || key.name === "q" || key.sequence === "?") {
        setDialogStack((currentStack) => closeAppDialog(currentStack, "help"));
      }
      return;
    }

    if (activeOverlay === "comment-composer") {
      handleCommentComposerKey(key);
      return;
    }

    if (activeOverlay === "comments") {
      handlePullRequestCommentsModalKey(key);
      return;
    }

    if (activeOverlay === "submit-review") {
      handleSubmitReviewModalKey(key);
      return;
    }

    if (activeOverlay === "merge") {
      handleMergeModalKey(key);
      return;
    }

    if (activeOverlay === "cleanup") {
      handleCleanupModalKey(key);
      return;
    }

    if (activeOverlay === "list-filter") {
      handleListFilterModalKey(key);
      return;
    }

    if (activeOverlay === "branch") {
      handleBranchModalKey(key);
      return;
    }

    if (activeOverlay == null && !leaderActive && key.name === "f" && key.shift) {
      void refreshGitState();
      return;
    }

    if (leaderActive) {
      if (key.name === "escape") {
        clearLeaderMode("Canceled leader key.");
        return;
      }

      const command = findCommandByKey(key, true);
      if (command != null) {
        runCommand(command);
      } else {
        clearLeaderMode(`No command is bound to ${leaderKeyLabel} ${key.name}.`);
      }
      return;
    }

    if (matchCommandKeybind(COMMAND_LIST_KEYBIND, key)) {
      openCommandModal();
      return;
    }

    if (matchCommandKeybind(LEADER_KEYBIND, key)) {
      enterLeaderMode();
      return;
    }

    if (key.sequence === "?") {
      openHelp();
      return;
    }

    if (
      session.github != null &&
      activePane === "diff" &&
      selectedReviewThread != null &&
      key.sequence === "["
    ) {
      moveSelectedReviewComment(-1);
      return;
    }

    if (
      session.github != null &&
      activePane === "diff" &&
      selectedReviewThread != null &&
      key.sequence === "]"
    ) {
      moveSelectedReviewComment(1);
      return;
    }

    if (session.github != null && activePane === "diff" && key.name === "i") {
      moveSelectedReviewThread(-1);
      return;
    }

    if (session.github != null && activePane === "diff" && key.name === "o") {
      moveSelectedReviewThread(1);
      return;
    }

    if (
      session.github != null &&
      activePane === "diff" &&
      key.name === "r" &&
      hasSelectedReviewThread
    ) {
      openFocusedReviewThreadReplyComposer();
      return;
    }

    if (
      session.github != null &&
      activePane === "diff" &&
      key.name === "c" &&
      selectedReviewThread != null
    ) {
      toggleFocusedReviewThreadCollapsed();
      return;
    }

    if (
      session.github != null &&
      activePane === "diff" &&
      key.name === "y" &&
      hasSelectedReviewThread
    ) {
      void copyFocusedReviewCommentUrl();
      return;
    }

    if (activePane === "tree") {
      const treeCommand = findCommandByKey(key);
      if (
        treeCommand != null &&
        treeCommand.value !== "review.toggle-collapsed" &&
        treeCommand.value !== "review.toggle-reviewed"
      ) {
        runCommand(treeCommand);
        return;
      }

      handleTreePaneKey(key);
      return;
    }

    const command = findCommandByKey(key);
    if (command != null) {
      runCommand(command);
      return;
    }

    if (key.name === "j" || key.name === "down" || key.name === "n") {
      moveSelectedFile(1);
      return;
    }

    if (key.name === "k" || key.name === "up" || key.name === "p") {
      moveSelectedFile(-1);
      return;
    }

    if (key.name === "g" && !key.shift) {
      const firstFilePath = session.files[0]?.path;
      if (firstFilePath != null) {
        startInteraction("file_selection", {
          details: {
            fromFilePath: selectedFilePath,
            toFilePath: firstFilePath,
            trigger: "first-file",
          },
          expectedSelectedFilePath: firstFilePath,
        });
      }

      setSelectedFileIndex(0);
      setStatusMessage("Jumped to the first file.");
      return;
    }

    if (key.name === "g" && key.shift) {
      const lastFileIndex = Math.max(session.files.length - 1, 0);
      const lastFilePath = session.files[lastFileIndex]?.path;
      if (lastFilePath != null) {
        startInteraction("file_selection", {
          details: {
            fromFilePath: selectedFilePath,
            toFilePath: lastFilePath,
            trigger: "last-file",
          },
          expectedSelectedFilePath: lastFilePath,
        });
      }

      setSelectedFileIndex(lastFileIndex);
      setStatusMessage("Jumped to the last file.");
      return;
    }

    if (key.name === "return") {
      toggleCollapsed(selectedFileIndex);
      return;
    }
  };

  useKeyboard(
    useCallback((key: KeyboardInput) => {
      keyboardHandlerRef.current(key);
    }, []),
  );

  const selectedFile = session.files[selectedFileIndex];
  const currentBranchLabel = session.repository.currentBranch ?? "detached";

  useEffect(() => {
    const pendingInteraction = pendingInteractionRef.current;
    if (pendingInteraction == null) {
      return;
    }

    if (
      (pendingInteraction.expectedPane != null && pendingInteraction.expectedPane !== activePane) ||
      (pendingInteraction.expectedDiffView != null &&
        pendingInteraction.expectedDiffView !== diffView) ||
      (pendingInteraction.expectedSelectedFilePath != null &&
        pendingInteraction.expectedSelectedFilePath !== selectedFilePath) ||
      (pendingInteraction.expectedSelectedTreePath != null &&
        pendingInteraction.expectedSelectedTreePath !== selectedTreePath)
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (pendingInteractionRef.current?.token !== pendingInteraction.token) {
        return;
      }

      logDiffdiffInfo("perf", "interaction_completed", {
        activePane,
        diffView,
        durationMs: Math.round((getMonotonicNow() - pendingInteraction.startedAt) * 100) / 100,
        interaction: pendingInteraction.kind,
        renderSurface: diffRenderSurface,
        selectedFilePath,
        selectedTreePath,
        visibleTreeNodeCount: visibleTreeNodes.length,
        ...pendingInteraction.details,
      });
      pendingInteractionRef.current = null;
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    activePane,
    diffRenderSurface,
    diffView,
    selectedFilePath,
    selectedTreePath,
    visibleTreeNodes,
  ]);

  function showToast(message: string): void {
    if (toastTimeoutRef.current != null) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      toastTimeoutRef.current = null;
      setToastMessage(null);
    }, 5000);
  }

  async function copyPullRequestUrl(): Promise<void> {
    if (session.github == null) {
      setStatusMessage("Open a GitHub pull request first.");
      return;
    }

    const { number, url } = session.github.pullRequest;
    const copied = await copyTextToClipboard(url);

    if (copied) {
      logDiffdiffInfo("app", "pull_request_url_copied", {
        pullRequestNumber: number,
        url,
      });
      showToast("Copied PR URL to clipboard");
      return;
    }

    handleAppFailure("Unable to copy the PR URL.", {
      action: "copy-pr-url",
      pullRequestNumber: number,
      url,
    });
  }
  const handleMouseUp = useCallback(() => {
    copySelection(renderer, {
      onSuccess: () => {
        logDiffdiffInfo("app", "selection_copied", {
          selectedFilePath: selectedFile?.path,
        });
        showToast("Copied to clipboard");
      },
      onError: () => {
        handleAppFailure("Unable to copy selection.", {
          action: "copy-selection",
          selectedFilePath: selectedFile?.path,
        });
      },
    });
  }, [handleAppFailure, renderer, selectedFile?.path, showToast]);

  useEffect(() => {
    logDiffdiffInfo("app", "app_loaded", {
      comparison: session.comparison,
      logFilePath: resolvedLogFilePath,
      repository: {
        name: session.repository.name,
        rootPath: session.repository.rootPath,
      },
      startup:
        startupInstrumentation == null
          ? undefined
          : summarizeStartupInstrumentation(startupInstrumentation, getStartupTraceNow()),
    });
  }, [
    resolvedLogFilePath,
    session.comparison,
    session.repository.name,
    session.repository.rootPath,
    startupInstrumentation,
  ]);

  useEffect(() => {
    logDiffdiffInfo("app", "session_updated", {
      comparison: session.comparison,
      fileCount: session.files.length,
      hasGitHubReview: session.github != null,
      warningCount: session.warnings.length,
    });
    void updateDiffdiffSessionActivity({
      comparison: session.comparison,
      currentBranch: session.repository.currentBranch,
      repoPath: startupOptions.repoPath ?? session.repository.rootPath,
      repositoryName: session.repository.name,
      repositoryRootPath: session.repository.rootPath,
    });
  }, [session]);

  useEffect(() => {
    logDiffdiffVerbose("app", "selection_updated", {
      activeFileIndex,
      activePane,
      diffView,
      selectedFileIndex,
      selectedFilePath,
    });
    scheduleSessionActivity({
      selectedFilePath,
    });
  }, [
    activeFileIndex,
    activePane,
    diffView,
    scheduleSessionActivity,
    selectedFileIndex,
    selectedFilePath,
  ]);

  useEffect(() => {
    const selectedFile = session.files[selectedFileIndex];
    if (selectedFile == null) {
      return;
    }

    logDiffdiffVerbose("app", "selected_file_profile", {
      diffView,
      isCollapsed: collapsedPaths.has(selectedFile.path),
      patchBytes: Buffer.byteLength(selectedFile.patch, "utf8"),
      path: selectedFile.path,
      reviewThreadCount: (reviewThreadsByPath.get(selectedFile.path) ?? EMPTY_REVIEW_THREADS)
        .length,
      splitRowCount: selectedFile.sideBySideRows.length,
      unifiedLineCount: selectedFile.unifiedLines.length,
    });
  }, [collapsedPaths, diffView, reviewThreadsByPath, selectedFileIndex, session.files]);

  useEffect(() => {
    const cacheKey: ReviewCacheKey = {
      repositoryRootPath: session.repository.rootPath,
      base: session.comparison.base,
      head: session.comparison.head,
    };
    const cacheState: ReviewCacheState = {
      reviewedFiles: buildReviewedFiles(session.files, reviewedPaths),
      collapsedPaths: [...collapsedPaths],
      commentCollapseStates,
      selectedFilePath: session.files[selectedFileIndex]?.path,
    };

    scheduleReviewCacheSave(cacheKey, cacheState);
  }, [
    collapsedPaths,
    commentCollapseStates,
    reviewedPaths,
    scheduleReviewCacheSave,
    selectedFileIndex,
    session.comparison.base,
    session.comparison.head,
    session.files,
    session.repository.rootPath,
  ]);

  useEffect(() => {
    logDiffdiffVerbose("app", "overlay_updated", {
      activeOverlay,
    });
    scheduleSessionActivity({
      activeOverlay: activeOverlay ?? undefined,
    });
  }, [activeOverlay, scheduleSessionActivity]);

  useEffect(() => {
    logDiffdiffVerbose("app", "status_message_updated", {
      message: statusMessage,
    });
    scheduleSessionActivity({
      statusMessage,
    });
  }, [scheduleSessionActivity, statusMessage]);

  useEffect(() => {
    if (toastMessage == null) {
      return;
    }

    logDiffdiffInfo("app", "toast_shown", {
      kind: "success",
      message: toastMessage,
    });
  }, [toastMessage]);

  useEffect(() => {
    if (errorToastMessage == null) {
      return;
    }

    logDiffdiffWarn("app", "toast_shown", {
      kind: "error",
      message: errorToastMessage,
    });
  }, [errorToastMessage]);

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.appBackground}
      onMouseUp={handleMouseUp}
    >
      <box
        flexShrink={0}
        width="100%"
        backgroundColor={theme.chromeBackground}
        paddingX={2}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={0}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <text fg={theme.text} wrapMode="none">
            <span fg={theme.accent}>diffdiff</span>
            <span fg={theme.border}>{" / "}</span>
            <span>{session.repository.name}</span>
            <span fg={theme.border}>{"  \u2502  "}</span>
            <Tag
              label={`base ← ${session.comparison.base}`}
              fg={theme.inverseText}
              bg={theme.warning}
            />
            <span>{"  "}</span>
            <Tag
              label={`head → ${session.comparison.head}`}
              fg={theme.inverseText}
              bg={theme.accent}
            />
            {refreshIndicatorLabel != null ? (
              <>
                <span>{"  "}</span>
                <Tag label={refreshIndicatorLabel} fg={theme.inverseText} bg={theme.danger} />
              </>
            ) : null}
          </text>
          <text fg={theme.textMuted} wrapMode="none">
            <span>{session.repository.rootPath}</span>
            <span>{"  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>{` ${currentBranchLabel} `}</span>
          </text>
        </box>
        {session.warnings[0] != null ? (
          <text fg={theme.warning} wrapMode="none">
            <span>{"warning "}</span>
            <span>{session.warnings[0].message}</span>
          </text>
        ) : null}
        {session.github != null ? (
          <PullRequestBanner pullRequest={session.github.pullRequest} theme={theme} />
        ) : null}
      </box>

      <box width="100%" flexGrow={1} flexDirection="row">
        <box
          flexShrink={0}
          width={sidebarWidth}
          backgroundColor={theme.appBackground}
          paddingLeft={2}
          paddingRight={1}
          paddingY={1}
          flexDirection="column"
          gap={1}
        >
          <box width="100%">
            <box
              width="100%"
              border={["left"]}
              borderColor={activePane === "tree" ? theme.borderActive : theme.border}
              backgroundColor={activePane === "tree" ? theme.surfaceMuted : theme.surface}
              paddingLeft={1}
              paddingRight={1}
              paddingY={1}
              flexDirection="column"
              gap={0}
            >
              <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={reviewedPaths.size > 0 ? theme.success : theme.textMuted}>
                    {reviewedPaths.size}
                  </span>
                  <span>{treeSummaryLabels.reviewed.slice(String(reviewedPaths.size).length)}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.success}>{treeSummaryLabels.diffAdditions}</span>
                  <span fg={theme.border}>{treeSummaryLabels.diffSeparator}</span>
                  <span fg={theme.danger}>{treeSummaryLabels.diffDeletions}</span>
                </text>
              </box>
            </box>
          </box>

          <scrollbox
            ref={treeScrollRef}
            width="100%"
            flexGrow={1}
            focused={activeOverlay == null && activePane === "tree"}
            viewportOptions={{ backgroundColor: theme.appBackground }}
            contentOptions={{ backgroundColor: theme.appBackground }}
            verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
          >
            <FileTreeSidebar
              activePane={activePane}
              collapsedDirectories={collapsedDirectories}
              collapsedPaths={collapsedPaths}
              nodes={visibleTreeNodes}
              onNodeMouseUp={handleFileTreeMouseUp}
              onRowRef={(index, node) => {
                treeRowRefCallbacks[index]?.(node);
              }}
              reviewedPaths={reviewedPaths}
              selectedFilePath={selectedFilePath}
              selectedPath={selectedTreePath}
              theme={theme}
            />
          </scrollbox>

          {showKeyLegend ? (
            <box width="100%" flexShrink={0} paddingRight={1}>
              <box
                width="100%"
                border={["left"]}
                borderColor={theme.border}
                paddingLeft={2}
                paddingRight={1}
                flexDirection="column"
                gap={0}
              >
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" j/k "}
                  </span>
                  <span>{" move  "}</span>
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" <-> "}
                  </span>
                  <span>{" tree"}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" tab "}
                  </span>
                  <span>{" pane  "}</span>
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {"  c  "}
                  </span>
                  <span>{" fold"}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {"  r  "}
                  </span>
                  <span>{" mark  "}</span>
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {"  v  "}
                  </span>
                  <span>{" view"}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {"  l  "}
                  </span>
                  <span>{" list  "}</span>
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {"  ?  "}
                  </span>
                  <span>{" help"}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {"  q  "}
                  </span>
                  <span>{" quit"}</span>
                </text>
                {session.github != null ? (
                  <>
                    <text fg={theme.textMuted} wrapMode="none">
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {" i/o "}
                      </span>
                      <span>{" thread  "}</span>
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {" [/] "}
                      </span>
                      <span>{" cmt"}</span>
                    </text>
                    <text fg={theme.textMuted} wrapMode="none">
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {"  a  "}
                      </span>
                      <span>{" note  "}</span>
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {"  r  "}
                      </span>
                      <span>{" reply"}</span>
                    </text>
                    <text fg={theme.textMuted} wrapMode="none">
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {"  c  "}
                      </span>
                      <span>{" fold  "}</span>
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {"  y  "}
                      </span>
                      <span>{" link"}</span>
                    </text>
                    <text fg={theme.textMuted} wrapMode="none">
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {"  m  "}
                      </span>
                      <span>{" merge"}</span>
                    </text>
                  </>
                ) : null}
              </box>
            </box>
          ) : null}
        </box>

        <box flexGrow={1} flexDirection="column">
          {stickyFile != null ? (
            <box
              flexShrink={0}
              width="100%"
              paddingLeft={1}
              paddingRight={0}
              backgroundColor={theme.appBackground}
            >
              <StickyFileHeader
                file={stickyFile}
                isCollapsed={collapsedPaths.has(stickyFile.path)}
                isReviewed={reviewedPaths.has(stickyFile.path)}
                isSelected={activePane === "diff" && activeFileIndex === selectedFileIndex}
                theme={theme}
              />
            </box>
          ) : null}

          <scrollbox
            ref={scrollRef}
            width="100%"
            flexGrow={1}
            focused={activeOverlay == null && activePane === "diff"}
            viewportOptions={{ backgroundColor: theme.appBackground }}
            contentOptions={{ backgroundColor: theme.appBackground }}
            verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
          >
            <box
              width="100%"
              flexDirection="column"
              paddingLeft={1}
              paddingRight={0}
              paddingBottom={1}
              gap={1}
            >
              {session.files.length === 0 ? (
                <box
                  border={["left"]}
                  borderColor={theme.border}
                  backgroundColor={theme.surface}
                  paddingLeft={2}
                  paddingRight={0}
                  paddingTop={1}
                  paddingBottom={1}
                >
                  <text fg={theme.textMuted}>No changed files found for this comparison.</text>
                </box>
              ) : null}

              {session.files.map((file, index) => {
                const isSelected = index === selectedFileIndex;
                const isReviewed = reviewedPaths.has(file.path);
                const isCollapsed = collapsedPaths.has(file.path);

                return (
                  <FileCard
                    collapsedCommentStates={commentCollapseStates}
                    key={file.path}
                    file={file}
                    diffView={diffView}
                    headerVariant={index === 0 ? "sticky-compact" : undefined}
                    isCollapsed={isCollapsed}
                    removeTopPadding={index === 0}
                    isReviewed={isReviewed}
                    isSelected={isSelected}
                    onToggleReviewThreadCollapsed={toggleReviewThreadCollapsed}
                    previewViewport={fileCardPreviewViewports[index]}
                    reviewThreads={reviewThreadsByPath.get(file.path) ?? EMPTY_REVIEW_THREADS}
                    rootRef={fileCardRootRefs[index]}
                    selectedReviewCommentId={isSelected ? selectedReviewComment?.id : undefined}
                    selectedReviewThreadId={isSelected ? selectedReviewThread?.id : undefined}
                    selectedReviewAnchor={
                      isSelected && session.github != null ? selectedReviewAnchor : undefined
                    }
                    syntaxStyle={syntaxStyle}
                    terminalWidth={diffPaneWidth}
                    theme={theme}
                  />
                );
              })}
            </box>
          </scrollbox>
        </box>
      </box>

      <box
        flexShrink={0}
        width="100%"
        backgroundColor={theme.chromeBackground}
        paddingX={2}
        paddingTop={0}
        paddingBottom={0}
        flexDirection="row"
        alignItems="center"
        gap={2}
      >
        <box flexShrink={0}>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {` ${commandListLabel} `}
            </span>
            <span>{" commands  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" z "}
            </span>
            <span>{` ${keyLegendToggleLabel}`}</span>
          </text>
        </box>
        <box flexGrow={1} flexDirection="row" justifyContent="flex-end">
          <text fg={footerEvent.color} wrapMode="none">
            <span>{footerEventMessage}</span>
          </text>
        </box>
      </box>

      <DiffdiffAppDialogs
        activeListView={activeListView}
        branchItems={branchItems}
        branchListFilters={branchListFilters}
        branchListIndex={branchListIndex}
        canApplyCleanup={canApplyCleanup}
        cleanupCandidateIndex={cleanupCandidateIndex}
        cleanupCandidates={cleanupCandidates}
        cleanupSelection={cleanupSelection}
        commandIndex={commandIndex}
        commandQuery={commandQuery}
        commitListIndex={commitListIndex}
        commitSearchActive={commitSearchActive}
        commitSearchQuery={commitSearchQuery}
        filteredCommands={filteredCommands}
        filteredCommitItems={filteredCommitItems}
        filterIndex={filterIndex}
        isSubmittingReviewAction={isSubmittingReviewAction}
        leaderKeybind={LEADER_KEYBIND}
        mergeBodyScrollRef={mergeBodyScrollRef}
        mergeCommitMessage={mergeCommitMessage}
        mergeCommitTitle={mergeCommitTitle}
        mergeMethod={mergeMethod}
        mergeModalField={mergeModalField}
        openPrCount={openPrCount}
        remoteBranchCount={remoteBranchCount}
        reviewComposerBody={reviewComposerBody}
        reviewComposerContext={reviewComposerContext}
        reviewSubmissionBody={reviewSubmissionBody}
        reviewSubmissionEventIndex={reviewSubmissionEventIndex}
        selectedPullRequestConversationItemId={
          selectedPullRequestConversationItem?.id == null
            ? undefined
            : String(selectedPullRequestConversationItem.id)
        }
        session={session}
        showBranchModal={showBranchModal}
        showCleanupModal={showCleanupModal}
        showCommandModal={showCommandModal}
        showCommentComposer={showCommentComposer}
        showCommentsModal={showCommentsModal}
        showHelp={showHelp}
        showListFilterModal={showListFilterModal}
        showMergeModal={showMergeModal}
        showSubmitReviewModal={showSubmitReviewModal}
        theme={theme}
      />
    </box>
  );

  function moveSelectedFile(delta: number): void {
    const nextIndex = clampIndex(selectedFileIndex + delta, session.files.length);
    if (nextIndex === selectedFileIndex) {
      return;
    }

    const nextFilePath = session.files[nextIndex]?.path;
    if (nextFilePath != null) {
      startInteraction("file_selection", {
        details: {
          delta,
          fromFilePath: selectedFilePath,
          toFilePath: nextFilePath,
          trigger: "diff-navigation",
        },
        expectedSelectedFilePath: nextFilePath,
      });
    }

    setSelectedFileIndex(nextIndex);
    setStatusMessage(`Selected ${nextFilePath ?? "file"}.`);
  }

  function moveSelectedReviewThread(delta: number): void {
    if (selectedFilePath == null || selectedFileReviewThreads.length === 0) {
      setStatusMessage("No review threads are available in the selected file.");
      return;
    }

    setSelectedReviewThreadIndexByFilePath((currentIndexes) => {
      const nextIndex = clampIndex(
        (currentIndexes[selectedFilePath] ?? 0) + delta,
        selectedFileReviewThreads.length,
      );
      const nextThread = selectedFileReviewThreads[nextIndex];

      if (nextThread != null) {
        setStatusMessage(`Focused thread ${formatThreadAnchor(nextThread)}.`);
      }

      return {
        ...currentIndexes,
        [selectedFilePath]: nextIndex,
      };
    });
  }

  function moveSelectedReviewComment(delta: number): void {
    if (selectedReviewThread == null) {
      setStatusMessage("No focused review thread is available in the selected file.");
      return;
    }

    setSelectedReviewCommentIndexByThreadId((currentIndexes) => {
      const nextIndex = clampIndex(
        (currentIndexes[selectedReviewThread.id] ?? 0) + delta,
        selectedReviewThread.comments.length,
      );
      const nextComment = selectedReviewThread.comments[nextIndex];

      if (nextComment != null) {
        setStatusMessage(`Focused comment from ${nextComment.author.login}.`);
      }

      return {
        ...currentIndexes,
        [selectedReviewThread.id]: nextIndex,
      };
    });
  }

  function toggleFocusedReviewThreadCollapsed(): void {
    if (selectedReviewThread == null) {
      setStatusMessage("No focused review thread is available in the selected file.");
      return;
    }

    toggleReviewThreadCollapsed(selectedReviewThread);
  }

  async function copyFocusedReviewCommentUrl(): Promise<void> {
    if (selectedReviewComment == null) {
      setStatusMessage("No focused review comment is available.");
      return;
    }

    const copied = await copyTextToClipboard(selectedReviewComment.url);
    setStatusMessage(
      copied
        ? "Copied focused comment URL to clipboard."
        : "Unable to copy the focused comment URL.",
    );
  }

  async function copySelectedPullRequestConversationItemUrl(): Promise<void> {
    if (selectedPullRequestConversationItem == null) {
      setStatusMessage("No focused PR conversation item is available.");
      return;
    }

    const copied = await copyTextToClipboard(selectedPullRequestConversationItem.url);
    setStatusMessage(
      copied
        ? "Copied PR conversation URL to clipboard."
        : "Unable to copy the PR conversation URL.",
    );
  }

  function toggleReviewed(fileIndex: number): void {
    const file = session.files[fileIndex];
    if (file == null) {
      return;
    }

    const wasReviewed = reviewedPaths.has(file.path);

    if (wasReviewed) {
      setReviewedPaths((currentPaths) => {
        const nextPaths = new Set(currentPaths);
        nextPaths.delete(file.path);
        return nextPaths;
      });
      setStatusMessage(`Marked ${file.path} as not reviewed.`);
    } else {
      setReviewedPaths((currentPaths) => new Set(currentPaths).add(file.path));
      setCollapsedPaths((currentPaths) => new Set(currentPaths).add(file.path));

      // Move focus to the next unreviewed file, searching forward then wrapping around.
      const files = session.files;
      let nextIndex: number | null = null;

      for (let i = 1; i < files.length; i++) {
        const candidateIndex = (fileIndex + i) % files.length;
        const candidatePath = files[candidateIndex]?.path;
        if (candidatePath != null && !reviewedPaths.has(candidatePath)) {
          nextIndex = candidateIndex;
          break;
        }
      }

      if (nextIndex != null) {
        const nextFilePath = files[nextIndex]?.path;
        if (nextFilePath != null) {
          startInteraction("file_selection", {
            details: {
              fromFilePath: file.path,
              toFilePath: nextFilePath,
              trigger: "reviewed-next-file",
            },
            expectedSelectedFilePath: nextFilePath,
          });
        }

        pendingSelectedFileScrollOffsetRef.current = REVIEWED_NEXT_FILE_SCROLL_OFFSET;
        setSelectedFileIndex(nextIndex);
        setStatusMessage(
          `Reviewed ${file.path}. Jumped to ${files[nextIndex]?.path ?? "next file"}.`,
        );
      } else {
        setStatusMessage(`Reviewed ${file.path}. All files reviewed!`);
      }
    }
  }

  function markAllReviewed(): void {
    if (session.files.length === 0) {
      setStatusMessage("No files are available to review.");
      return;
    }

    const allPaths = new Set(session.files.map((file) => file.path));
    if (haveSamePaths(reviewedPaths, allPaths)) {
      setStatusMessage("All files are already reviewed.");
      return;
    }

    setReviewedPaths(allPaths);
    setCollapsedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      for (const path of allPaths) {
        nextPaths.add(path);
      }
      return nextPaths;
    });
    setStatusMessage(`Reviewed all ${session.files.length} files.`);
  }

  function clearReviewed(): void {
    if (reviewedPaths.size === 0) {
      setStatusMessage("No files are marked reviewed.");
      return;
    }

    setReviewedPaths(new Set());
    setStatusMessage(`Cleared review marks from ${reviewedPaths.size} files.`);
  }

  function toggleCollapsed(fileIndex: number): void {
    const file = session.files[fileIndex];
    if (file == null) {
      return;
    }

    startInteraction("file_collapse_toggle", {
      details: {
        filePath: file.path,
        isCollapsed: !collapsedPaths.has(file.path),
      },
      expectedSelectedFilePath: file.path,
    });

    setCollapsedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      if (nextPaths.has(file.path)) {
        nextPaths.delete(file.path);
        setStatusMessage(`Expanded ${file.path}.`);
      } else {
        nextPaths.add(file.path);
        setStatusMessage(`Collapsed ${file.path}.`);
      }
      return nextPaths;
    });
  }

  function toggleReviewThreadCollapsed(
    thread: import("@diffdiff/core").GitHubPullRequestReviewThread,
  ): void {
    const collapseKey = getReviewThreadCollapseKey(thread);
    const defaultCollapsed = getReviewThreadDefaultCollapsed(thread);
    const nextCollapsed = !getCommentCollapsed(
      commentCollapseStates,
      collapseKey,
      defaultCollapsed,
    );

    setCommentCollapseStates((currentStates) =>
      toggleCommentCollapseState(currentStates, collapseKey, defaultCollapsed),
    );
    setStatusMessage(nextCollapsed ? "Collapsed comment thread." : "Expanded comment thread.");
  }

  function toggleDiffView(): void {
    const nextPreference = diffViewPreference === "unified" ? "side-by-side" : "unified";
    const nextView = resolveDiffView(nextPreference, diffPaneWidth);

    startInteraction("diff_view_toggle", {
      details: {
        fromView: diffView,
        preferredView: nextPreference,
        toView: nextView,
      },
      expectedDiffView: nextView,
    });

    setDiffViewPreference(nextPreference);

    if (nextPreference === "side-by-side" && nextView !== "split") {
      setStatusMessage(
        `Need at least ${MIN_SIDE_BY_SIDE_DIFF_WIDTH} columns in the diff pane for side-by-side diffs; showing unified.`,
      );
    } else {
      setStatusMessage(`Showing ${getDiffViewLabel(nextView)} diffs.`);
    }
  }

  function clearLeaderMode(status?: string): void {
    if (leaderTimeoutRef.current != null) {
      clearTimeout(leaderTimeoutRef.current);
      leaderTimeoutRef.current = null;
    }

    setLeaderActive(false);

    if (status != null) {
      setStatusMessage(status);
    }
  }

  function enterLeaderMode(): void {
    if (leaderTimeoutRef.current != null) {
      clearTimeout(leaderTimeoutRef.current);
    }

    setLeaderActive(true);
    setStatusMessage(`Leader key active. Awaiting a ${leaderKeyLabel} command.`);
    leaderTimeoutRef.current = setTimeout(() => {
      leaderTimeoutRef.current = null;
      setLeaderActive(false);
      setStatusMessage("Leader key timed out.");
    }, 2000);
  }

  function openCommandModal(): void {
    clearLeaderMode();
    setCommandQuery("");
    setCommandIndex(0);
    setDialogStack((currentStack) =>
      openAppDialog(currentStack, "command-palette", { clear: true }),
    );
    setStatusMessage("Opened command palette.");
  }

  function closeCommandModal(): void {
    setDialogStack((currentStack) => closeAppDialog(currentStack, "command-palette"));
    setCommandQuery("");
    setCommandIndex(0);
    setStatusMessage("Closed command palette.");
  }

  function runCommand(command: AppCommand): void {
    clearLeaderMode();
    setDialogStack((currentStack) => closeAppDialog(currentStack, "command-palette"));
    setCommandQuery("");
    setCommandIndex(0);
    command.run();
  }

  function toggleKeyLegend(): void {
    setShowKeyLegend((currentValue) => {
      const nextValue = !currentValue;
      setStatusMessage(nextValue ? "Key legend shown." : "Key legend hidden.");
      return nextValue;
    });
  }

  function toggleActivePane(): void {
    const nextPane = activePane === "diff" ? "tree" : "diff";
    startInteraction("pane_toggle", {
      details: {
        fromPane: activePane,
        toPane: nextPane,
      },
      expectedPane: nextPane,
    });
    setActivePane(nextPane);
    setStatusMessage(nextPane === "tree" ? "File tree active." : "Diff view active.");
  }

  function expandFileTreeAncestors(path: string): void {
    setCollapsedDirectories((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      let changed = false;

      for (const ancestorPath of getAncestorDirectoryPaths(path)) {
        if (nextPaths.delete(ancestorPath)) {
          changed = true;
        }
      }

      return changed ? nextPaths : currentPaths;
    });
  }

  function setFileTreeDirectoryCollapsed(path: string, isCollapsed: boolean): void {
    setCollapsedDirectories((currentPaths) => {
      const nextPaths = new Set(currentPaths);

      if (isCollapsed) {
        if (nextPaths.has(path)) {
          return currentPaths;
        }

        nextPaths.add(path);
        setStatusMessage(`Collapsed ${path}/ in the file tree.`);
        return nextPaths;
      }

      if (!nextPaths.delete(path)) {
        return currentPaths;
      }

      setStatusMessage(`Expanded ${path}/ in the file tree.`);
      return nextPaths;
    });
  }

  function selectTreeNode(node: FileTreeNode, options?: { openDiff?: boolean }): void {
    startInteraction(node.kind === "directory" ? "tree_selection" : "file_selection", {
      details:
        node.kind === "directory"
          ? {
              path: node.path,
              trigger: options?.openDiff ? "tree-open" : "tree-navigation",
            }
          : {
              fromFilePath: selectedFilePath,
              toFilePath: node.path,
              trigger: options?.openDiff ? "tree-open" : "tree-selection",
            },
      expectedPane: node.kind === "file" && options?.openDiff ? "diff" : undefined,
      expectedSelectedFilePath: node.kind === "file" ? node.path : undefined,
      expectedSelectedTreePath: node.path,
    });

    setSelectedTreePath(node.path);

    if (node.kind === "directory") {
      setStatusMessage(`Selected ${node.path}/ in the file tree.`);
      return;
    }

    expandFileTreeAncestors(node.path);
    setSelectedFileIndex(node.fileIndex);
    setStatusMessage(options?.openDiff ? `Opened ${node.path}.` : `Selected ${node.path}.`);

    if (options?.openDiff) {
      setActivePane("diff");
    }
  }

  function moveTreeSelection(delta: number): void {
    if (visibleTreeNodes.length === 0) {
      return;
    }

    const currentIndex = visibleTreeNodeIndexByPath.get(selectedTreePath) ?? -1;
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = clampIndex(startIndex + delta, visibleTreeNodes.length);
    const nextNode = visibleTreeNodes[nextIndex];
    if (nextNode != null) {
      selectTreeNode(nextNode);
    }
  }

  function handleTreePaneKey(key: KeyboardInput): void {
    if (key.name === "j" || key.name === "down" || key.name === "n") {
      moveTreeSelection(1);
      return;
    }

    if (key.name === "k" || key.name === "up" || key.name === "p") {
      moveTreeSelection(-1);
      return;
    }

    if (key.name === "g" && !key.shift) {
      const firstNode = visibleTreeNodes[0];
      if (firstNode != null) {
        selectTreeNode(firstNode);
      }
      return;
    }

    if (key.name === "g" && key.shift) {
      const lastNode = visibleTreeNodes[Math.max(visibleTreeNodes.length - 1, 0)];
      if (lastNode != null) {
        selectTreeNode(lastNode);
      }
      return;
    }

    const currentNode =
      selectedTreeNode ??
      visibleTreeNodes.find((node) => node.kind === "file") ??
      visibleTreeNodes[0];
    if (currentNode == null) {
      return;
    }

    if (key.name === "left") {
      if (currentNode.kind === "directory" && !collapsedDirectories.has(currentNode.path)) {
        setFileTreeDirectoryCollapsed(currentNode.path, true);
        return;
      }

      if (currentNode.parentPath != null) {
        const parentNode = fileTreeNodeByPath.get(currentNode.parentPath);
        if (parentNode != null) {
          selectTreeNode(parentNode);
        }
      }
      return;
    }

    if (key.name === "right") {
      if (currentNode.kind === "directory") {
        if (collapsedDirectories.has(currentNode.path)) {
          setFileTreeDirectoryCollapsed(currentNode.path, false);
          return;
        }

        const childNode = visibleTreeNodes.find((node) => node.parentPath === currentNode.path);
        if (childNode != null) {
          selectTreeNode(childNode);
        }
        return;
      }

      selectTreeNode(currentNode, { openDiff: true });
      return;
    }

    if (key.name === "return" || key.name === "space") {
      if (currentNode.kind === "directory") {
        setFileTreeDirectoryCollapsed(
          currentNode.path,
          !collapsedDirectories.has(currentNode.path),
        );
      } else {
        selectTreeNode(currentNode, { openDiff: true });
      }
    }
  }

  function handleFileTreeMouseUp(node: FileTreeNode): void {
    if (node.kind === "directory") {
      setActivePane("tree");
      setSelectedTreePath(node.path);
      setFileTreeDirectoryCollapsed(node.path, !collapsedDirectories.has(node.path));
      return;
    }

    selectTreeNode(node, { openDiff: true });
  }

  function openBranchModal(): void {
    setBranchListIndex(
      findInitialBranchListSelection({
        comparison: session.comparison,
        currentBranch: session.repository.currentBranch,
        items: branchItems,
      }),
    );
    setCommitListIndex(0);
    setCommitSearchQuery("");
    setCommitSearchActive(false);
    setActiveListView("branch");
    setDialogStack(["branch"]);
    setStatusMessage("Opened list modal.");
  }

  function handleBranchModalKey(key: KeyboardInput): void {
    // When commit search is active, intercept typing keys first.
    if (commitSearchActive && activeListView === "commit") {
      if (key.name === "escape") {
        setCommitSearchActive(false);
        return;
      }

      if (key.name === "return") {
        setCommitSearchActive(false);
        return;
      }

      if (key.name === "backspace") {
        setCommitSearchQuery((q) => q.slice(0, -1));
        setCommitListIndex(0);
        return;
      }

      // Navigation still works while searching.
      if (key.name === "up") {
        setCommitListIndex((currentIndex) =>
          clampIndex(currentIndex - 1, filteredCommitItems.length),
        );
        return;
      }

      if (key.name === "down") {
        setCommitListIndex((currentIndex) =>
          clampIndex(currentIndex + 1, filteredCommitItems.length),
        );
        return;
      }

      // Printable character: append to search query.
      if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
        setCommitSearchQuery((q) => q + key.sequence);
        setCommitListIndex(0);
        return;
      }

      return;
    }

    if (key.name === "escape" || key.name === "q" || key.name === "l") {
      setDialogStack((currentStack) => closeAppDialog(currentStack, "branch"));
      setCommitSearchQuery("");
      setCommitSearchActive(false);
      setStatusMessage("Closed list modal.");
      return;
    }

    if (key.name === "tab" || key.name === "left" || key.name === "right") {
      setActiveListView((currentView) => (currentView === "branch" ? "commit" : "branch"));
      setCommitSearchActive(false);
      return;
    }

    if (activeListView === "branch" && key.name === "f") {
      setFilterIndex(0);
      setDialogStack((currentStack) => openAppDialog(currentStack, "list-filter"));
      setStatusMessage("Opened list filters.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      if (activeListView === "branch") {
        setBranchListIndex((currentIndex) => clampIndex(currentIndex + 1, branchItems.length));
      } else {
        setCommitListIndex((currentIndex) =>
          clampIndex(currentIndex + 1, filteredCommitItems.length),
        );
      }
      return;
    }

    if (key.name === "k" || key.name === "up") {
      if (activeListView === "branch") {
        setBranchListIndex((currentIndex) => clampIndex(currentIndex - 1, branchItems.length));
      } else {
        setCommitListIndex((currentIndex) =>
          clampIndex(currentIndex - 1, filteredCommitItems.length),
        );
      }
      return;
    }

    if (key.name === "g" && !key.shift) {
      if (activeListView === "branch") {
        setBranchListIndex(0);
      } else {
        setCommitListIndex(0);
      }
      return;
    }

    if (key.name === "g" && key.shift) {
      if (activeListView === "branch") {
        setBranchListIndex(Math.max(branchItems.length - 1, 0));
      } else {
        setCommitListIndex(Math.max(filteredCommitItems.length - 1, 0));
      }
      return;
    }

    if (activeListView === "branch") {
      if (key.name === "o") {
        toggleBranchFilter("remoteBranch");
        return;
      }

      if (key.name === "return" || key.name === "b") {
        if (key.name === "return" && selectedBranchItem?.kind === "open-pr") {
          if (selectedBranchItem.branch != null) {
            void applyPullRequestSelection(selectedBranchItem.branch);
          }
        } else if (selectedBranchItem?.kind === "working-tree") {
          void applyWorkingTreeSelection();
        } else if (selectedBranchItem?.branch != null) {
          void applyBranchSelection("base", selectedBranchItem.branch);
        }
        return;
      }

      if (key.name === "h") {
        if (selectedBranchItem?.branch != null) {
          void applyBranchSelection("head", selectedBranchItem.branch);
        }
        return;
      }

      if (key.name === "w") {
        void applyWorkingTreeSelection();
      }

      return;
    }

    // Commit view: activate search with '/'.
    if (key.sequence === "/") {
      setCommitSearchActive(true);
      return;
    }

    if (key.name === "return" || key.name === "h") {
      if (selectedCommitItem != null) {
        void applyCommitSelection(
          "head",
          selectedCommitItem.commit.sha,
          selectedCommitItem.commit.shortSha,
        );
      }
      return;
    }

    if (key.name === "b") {
      if (selectedCommitItem != null) {
        void applyCommitSelection(
          "base",
          selectedCommitItem.commit.sha,
          selectedCommitItem.commit.shortSha,
        );
      }
    }
  }

  function handleListFilterModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q" || key.name === "f") {
      setDialogStack((currentStack) => closeAppDialog(currentStack, "list-filter"));
      setStatusMessage("Closed list filters.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      setFilterIndex((currentIndex) => clampIndex(currentIndex + 1, LIST_FILTER_KEYS.length));
      return;
    }

    if (key.name === "k" || key.name === "up") {
      setFilterIndex((currentIndex) => clampIndex(currentIndex - 1, LIST_FILTER_KEYS.length));
      return;
    }

    if (key.name === "g" && !key.shift) {
      setFilterIndex(0);
      return;
    }

    if (key.name === "g" && key.shift) {
      setFilterIndex(Math.max(LIST_FILTER_KEYS.length - 1, 0));
      return;
    }

    if (key.name === "return" || key.name === "space") {
      const filterKey = LIST_FILTER_KEYS[filterIndex];
      if (filterKey != null) {
        toggleBranchFilter(filterKey);
      }
      return;
    }

    if (key.name === "a") {
      setBranchListFilters({
        workingTree: true,
        localBranch: true,
        openPr: true,
        remoteBranch: true,
      });
      setStatusMessage("Enabled all list filters.");
      return;
    }

    if (key.name === "n") {
      setBranchListFilters({
        workingTree: false,
        localBranch: false,
        openPr: false,
        remoteBranch: false,
      });
      setStatusMessage("Disabled all list filters.");
    }
  }

  function findCommandByKey(key: KeyboardInput, leader = false): AppCommand | undefined {
    return visibleCommands.find((command) => matchCommandKeybind(command.keybind, key, leader));
  }

  function handleCommandModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q") {
      closeCommandModal();
      return;
    }

    if (key.name === "j" || key.name === "down" || (key.ctrl && key.name === "n")) {
      setCommandIndex((currentIndex) => clampIndex(currentIndex + 1, filteredCommands.length));
      return;
    }

    if (key.name === "k" || key.name === "up" || (key.ctrl && key.name === "p")) {
      setCommandIndex((currentIndex) => clampIndex(currentIndex - 1, filteredCommands.length));
      return;
    }

    if (key.name === "pageup") {
      setCommandIndex((currentIndex) => clampIndex(currentIndex - 10, filteredCommands.length));
      return;
    }

    if (key.name === "pagedown") {
      setCommandIndex((currentIndex) => clampIndex(currentIndex + 10, filteredCommands.length));
      return;
    }

    if (key.name === "home") {
      setCommandIndex(0);
      return;
    }

    if (key.name === "end") {
      setCommandIndex(Math.max(filteredCommands.length - 1, 0));
      return;
    }

    if (key.name === "backspace") {
      setCommandQuery((currentQuery) => currentQuery.slice(0, -1));
      setCommandIndex(0);
      return;
    }

    if (key.name === "return") {
      const command = filteredCommands[clampIndex(commandIndex, filteredCommands.length)];
      if (command != null) {
        runCommand(command);
      }
      return;
    }

    if (isPrintableKey(key)) {
      setCommandQuery((currentQuery) => currentQuery + key.sequence);
      setCommandIndex(0);
    }
  }

  function handleCommentComposerKey(key: KeyboardInput): void {
    if (key.name === "escape") {
      setDialogStack((currentStack) => closeAppDialog(currentStack, "comment-composer"));
      setReviewComposerTarget(null);
      setReviewComposerBody("");
      setStatusMessage("Closed comment composer.");
      return;
    }

    if (key.name === "backspace") {
      setReviewComposerBody((currentBody) => currentBody.slice(0, -1));
      return;
    }

    if (key.name === "return" && key.shift) {
      setReviewComposerBody((currentBody) => `${currentBody}\n`);
      return;
    }

    if (key.name === "return") {
      void submitCommentComposer();
      return;
    }

    if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
      setReviewComposerBody((currentBody) => currentBody + key.sequence);
    }
  }

  function handlePullRequestCommentsModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q" || key.name === "t") {
      setDialogStack((currentStack) => closeAppDialog(currentStack, "comments"));
      setStatusMessage("Closed PR conversation.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      setPullRequestConversationIndex((currentIndex) =>
        clampIndex(currentIndex + 1, pullRequestConversationItems.length),
      );
      return;
    }

    if (key.name === "k" || key.name === "up") {
      setPullRequestConversationIndex((currentIndex) =>
        clampIndex(currentIndex - 1, pullRequestConversationItems.length),
      );
      return;
    }

    if (key.name === "r") {
      openPullRequestConversationReplyComposer();
      return;
    }

    if (key.name === "y") {
      void copySelectedPullRequestConversationItemUrl();
    }
  }

  function handleSubmitReviewModalKey(key: KeyboardInput): void {
    if (key.name === "escape") {
      setDialogStack((currentStack) => closeAppDialog(currentStack, "submit-review"));
      setReviewSubmissionBody("");
      setStatusMessage("Closed submit review modal.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex + 1, 3));
      return;
    }

    if (key.name === "k" || key.name === "up") {
      setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex - 1, 3));
      return;
    }

    if (key.name === "backspace") {
      setReviewSubmissionBody((currentBody) => currentBody.slice(0, -1));
      return;
    }

    if (key.name === "return" && key.shift) {
      setReviewSubmissionBody((currentBody) => `${currentBody}\n`);
      return;
    }

    if (key.name === "return") {
      void submitReviewFromModal();
      return;
    }

    if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
      setReviewSubmissionBody((currentBody) => currentBody + key.sequence);
    }
  }

  function handleMergeModalKey(key: KeyboardInput): void {
    if (key.name === "escape") {
      setDialogStack((currentStack) => closeAppDialog(currentStack, "merge"));
      setStatusMessage("Closed merge modal.");
      return;
    }

    if (key.name === "tab") {
      setMergeModalField((currentField) => {
        switch (currentField) {
          case "method":
            return "title";
          case "title":
            return "body";
          case "body":
            return "method";
        }
      });
      return;
    }

    if (mergeModalField === "method") {
      if (key.name === "j" || key.name === "down" || key.name === "k" || key.name === "up") {
        const delta = key.name === "j" || key.name === "down" ? 1 : -1;
        const nextMethod = getMergeMethod(getMergeMethodIndex(mergeMethod) + delta);
        setMergeMethod(nextMethod);
        void persistGitHubPreferences({
          ...gitHubPreferencesRef.current,
          defaultMergeMethod: nextMethod,
        });
        setStatusMessage(`Default merge method set to ${nextMethod}.`);
      }
      if (key.name === "return") {
        void submitMergeFromModal();
      }
      return;
    }

    if (mergeModalField === "title") {
      if (key.name === "backspace") {
        setMergeCommitTitle((currentTitle) => currentTitle.slice(0, -1));
        return;
      }

      if (key.name === "return") {
        void submitMergeFromModal();
        return;
      }

      if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
        setMergeCommitTitle((currentTitle) => currentTitle + key.sequence);
      }
      return;
    }

    if (key.name === "backspace") {
      setMergeCommitMessage((currentBody) => currentBody.slice(0, -1));
      return;
    }

    if (key.name === "return" && key.shift) {
      setMergeCommitMessage((currentBody) => `${currentBody}\n`);
      return;
    }

    if (key.name === "return") {
      void submitMergeFromModal();
      return;
    }

    if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
      setMergeCommitMessage((currentBody) => currentBody + key.sequence);
    }
  }

  function handleCleanupModalKey(key: KeyboardInput): void {
    const entryCount = 2;

    if (key.name === "escape") {
      setDialogStack((currentStack) => closeAppDialog(currentStack, "cleanup"));
      setCleanupCandidates([]);
      setStatusMessage("Skipped post-merge cleanup.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      setCleanupCandidateIndex((currentIndex) => clampIndex(currentIndex + 1, entryCount));
      return;
    }

    if (key.name === "k" || key.name === "up") {
      setCleanupCandidateIndex((currentIndex) => clampIndex(currentIndex - 1, entryCount));
      return;
    }

    if (key.name === "space") {
      const nextKey = cleanupCandidateIndex === 0 ? "removeLocal" : "removeRemote";
      const hasCandidate = cleanupCandidates.some((candidate) =>
        nextKey === "removeLocal"
          ? candidate.kind === "local-branch"
          : candidate.kind === "remote-tracking",
      );

      if (!hasCandidate) {
        return;
      }

      updateCleanupSelection((currentSelection) => ({
        ...currentSelection,
        [nextKey]: !currentSelection[nextKey],
      }));
      return;
    }

    if (key.name === "return") {
      void applyCleanupSelection();
    }
  }

  function openCommentComposer(): void {
    if (session.github == null) {
      setStatusMessage("Open a GitHub pull request first.");
      return;
    }

    if (!session.github.auth.isAuthenticated) {
      setStatusMessage("GitHub auth is required. Run `diffdiff auth login --token-stdin` first.");
      return;
    }

    if (selectedReviewAnchor == null) {
      setStatusMessage("No commentable line is selected.");
      return;
    }

    setReviewComposerTarget({
      anchor: selectedReviewAnchor,
      kind: "review-thread",
    });
    setReviewComposerBody("");
    setDialogStack((currentStack) => openAppDialog(currentStack, "comment-composer"));
    setStatusMessage(`Commenting on ${selectedReviewAnchor.path}:${selectedReviewAnchor.line}.`);
  }

  function openFocusedReviewThreadReplyComposer(): void {
    if (session.github == null) {
      setStatusMessage("Open a GitHub pull request first.");
      return;
    }

    if (!session.github.auth.isAuthenticated) {
      setStatusMessage("GitHub auth is required. Run `diffdiff auth login --token-stdin` first.");
      return;
    }

    if (selectedReviewThread == null || selectedReviewComment == null) {
      setStatusMessage("No focused review thread is available in the selected file.");
      return;
    }

    const rootComment =
      selectedReviewThread.comments.find((comment) => comment.replyToId == null) ??
      selectedReviewThread.comments[0];
    if (rootComment == null) {
      setStatusMessage("No reply target is available for the focused thread.");
      return;
    }

    setReviewComposerTarget({
      comment: selectedReviewComment,
      kind: "review-thread-reply",
      rootCommentId: rootComment.id,
      thread: selectedReviewThread,
    });
    setReviewComposerBody("");
    setDialogStack((currentStack) => openAppDialog(currentStack, "comment-composer"));
    setStatusMessage(`Replying in ${formatThreadAnchor(selectedReviewThread)}.`);
  }

  function openPullRequestConversationReplyComposer(): void {
    if (session.github == null) {
      setStatusMessage("Open a GitHub pull request first.");
      return;
    }

    if (!session.github.auth.isAuthenticated) {
      setStatusMessage("GitHub auth is required. Run `diffdiff auth login --token-stdin` first.");
      return;
    }

    if (selectedPullRequestConversationItem == null) {
      setStatusMessage("No focused PR conversation item is available.");
      return;
    }

    setReviewComposerTarget({
      item: selectedPullRequestConversationItem,
      kind: "pull-request-comment-reply",
      quotedBody: selectedPullRequestConversationItem.body,
    });
    setReviewComposerBody("");
    setDialogStack((currentStack) => openAppDialog(currentStack, "comment-composer"));
    setStatusMessage(`Replying to ${selectedPullRequestConversationItem.author.login}.`);
  }

  function openPullRequestCommentsModal(): void {
    setPullRequestConversationIndex(0);
    setDialogStack((currentStack) => openAppDialog(currentStack, "comments"));
    setStatusMessage("Opened PR comments.");
  }

  function openHelp(): void {
    setDialogStack((currentStack) => openAppDialog(currentStack, "help", { clear: true }));
  }

  function openSubmitReviewModal(): void {
    if (session.github == null) {
      setStatusMessage("Open a GitHub pull request first.");
      return;
    }

    if (!session.github.auth.isAuthenticated) {
      setStatusMessage("GitHub auth is required. Run `diffdiff auth login --token-stdin` first.");
      return;
    }

    setReviewSubmissionBody(session.github.pullRequest.pendingReview?.body ?? "");
    setReviewSubmissionEventIndex(0);
    setDialogStack((currentStack) => openAppDialog(currentStack, "submit-review"));
    setStatusMessage("Preparing review submission.");
  }

  function openMergeModal(): void {
    if (session.github == null) {
      setStatusMessage("Open a GitHub pull request first.");
      return;
    }

    if (!session.github.auth.isAuthenticated) {
      setStatusMessage("GitHub auth is required. Run `diffdiff auth login --token-stdin` first.");
      return;
    }

    setMergeCommitTitle(session.github.pullRequest.title);
    setMergeCommitMessage(session.github.pullRequest.body ?? "");
    setMergeMethod(gitHubPreferencesRef.current.defaultMergeMethod);
    setMergeModalField(
      gitHubPreferencesRef.current.defaultMergeMethod == null ? "method" : "title",
    );
    setDialogStack((currentStack) => openAppDialog(currentStack, "merge"));
    setStatusMessage("Preparing merge modal.");
  }

  async function submitCommentComposer(): Promise<void> {
    if (
      session.github == null ||
      reviewComposerTarget == null ||
      reviewComposerBody.trim() === ""
    ) {
      return;
    }

    const nextBody = reviewComposerBody.trim();
    let sessionLoadId: number | undefined;

    setIsSubmittingReviewAction(true);

    try {
      if (reviewComposerTarget.kind === "review-thread") {
        if (addReviewThread == null) {
          return;
        }

        setStatusMessage(
          `Adding review comment on ${reviewComposerTarget.anchor.path}:${reviewComposerTarget.anchor.line}...`,
        );
        await addReviewThread(session.github, reviewComposerTarget.anchor, nextBody);
      } else if (reviewComposerTarget.kind === "review-thread-reply") {
        if (replyToReviewComment == null) {
          return;
        }

        setStatusMessage(`Replying in ${formatThreadAnchor(reviewComposerTarget.thread)}...`);
        await replyToReviewComment(session.github, reviewComposerTarget.rootCommentId, nextBody);
      } else {
        if (addPullRequestComment == null) {
          return;
        }

        setStatusMessage(`Replying to ${reviewComposerTarget.item.author.login}...`);
        await addPullRequestComment(
          session.github,
          buildQuotedPullRequestReply(reviewComposerTarget.item, nextBody),
        );
      }

      sessionLoadId = beginSessionLoad();
      const nextSession = await loadSession(startupOptions);
      if (isLatestSessionLoad(sessionLoadId, reviewComposerTarget.kind)) {
        applyLoadedSession(nextSession);
      }
      setDialogStack((currentStack) => closeAppDialog(currentStack, "comment-composer"));
      setReviewComposerTarget(null);
      setReviewComposerBody("");
      setStatusMessage(
        reviewComposerTarget.kind === "review-thread"
          ? "Added review comment."
          : reviewComposerTarget.kind === "review-thread-reply"
            ? "Added review reply."
            : "Added PR reply comment.",
      );
    } catch (error) {
      if (sessionLoadId != null && !isLatestSessionLoad(sessionLoadId, reviewComposerTarget.kind)) {
        return;
      }
      handleAppError(error, "Unable to submit the comment.", {
        action: reviewComposerTarget.kind,
        target:
          reviewComposerTarget.kind === "review-thread"
            ? reviewComposerTarget.anchor
            : reviewComposerTarget.kind === "review-thread-reply"
              ? reviewComposerTarget.comment
              : reviewComposerTarget.item,
      });
    } finally {
      setIsSubmittingReviewAction(false);
    }
  }

  async function submitReviewFromModal(): Promise<void> {
    if (session.github == null || submitPendingReview == null) {
      return;
    }

    setIsSubmittingReviewAction(true);
    setStatusMessage("Submitting review...");
    const sessionLoadId = beginSessionLoad();

    try {
      await submitPendingReview(
        session.github,
        getReviewSubmissionEvent(reviewSubmissionEventIndex),
        reviewSubmissionBody.trim() === "" ? undefined : reviewSubmissionBody.trim(),
      );
      const nextSession = await loadSession(startupOptions);
      if (!isLatestSessionLoad(sessionLoadId, "submit-review")) {
        return;
      }
      applyLoadedSession(nextSession);
      setDialogStack((currentStack) => closeAppDialog(currentStack, "submit-review"));
      setReviewSubmissionBody("");
      setStatusMessage("Submitted review.");
    } catch (error) {
      if (!isLatestSessionLoad(sessionLoadId, "submit-review")) {
        return;
      }
      handleAppError(error, "Unable to submit the review.", {
        action: "submit-review",
        event: getReviewSubmissionEvent(reviewSubmissionEventIndex),
      });
    } finally {
      setIsSubmittingReviewAction(false);
    }
  }

  async function submitMergeFromModal(): Promise<void> {
    if (session.github == null || mergePullRequest == null || mergeMethod == null) {
      return;
    }

    setIsSubmittingReviewAction(true);
    setStatusMessage(`Merging pull request with ${mergeMethod}...`);
    const sessionLoadId = beginSessionLoad();

    try {
      const mergeResult = await mergePullRequest(session.github, {
        commitMessage: mergeCommitMessage.trim() === "" ? undefined : mergeCommitMessage.trim(),
        commitTitle: mergeCommitTitle.trim() === "" ? undefined : mergeCommitTitle.trim(),
        comparison: session.comparison,
        method: mergeMethod,
      });
      const nextSession = await loadSession(startupOptions);
      if (!isLatestSessionLoad(sessionLoadId, "merge-pull-request")) {
        return;
      }
      applyLoadedSession(nextSession);
      setDialogStack((currentStack) => closeAppDialog(currentStack, "merge"));
      setStatusMessage("Merged the pull request and refreshed local refs.");

      if (mergeResult.cleanupCandidates.length > 0) {
        setCleanupCandidateIndex(0);
        setCleanupCandidates(mergeResult.cleanupCandidates);
        setCleanupSelection(gitHubPreferencesRef.current.cleanup);
        setDialogStack((currentStack) => openAppDialog(currentStack, "cleanup", { replace: true }));
        setStatusMessage("Merged the pull request. Choose any stale refs to remove.");
      }
    } catch (error) {
      if (!isLatestSessionLoad(sessionLoadId, "merge-pull-request")) {
        return;
      }
      handleAppError(error, "Unable to merge the pull request.", {
        action: "merge-pull-request",
        mergeMethod,
        pullRequestNumber: session.github.pullRequest.number,
      });
    } finally {
      setIsSubmittingReviewAction(false);
    }
  }

  async function applyCleanupSelection(): Promise<void> {
    if (session.github == null || removeCleanupRefs == null) {
      return;
    }

    const refsToRemove = cleanupCandidates.filter((candidate) =>
      candidate.kind === "local-branch"
        ? cleanupSelection.removeLocal
        : cleanupSelection.removeRemote,
    );
    if (refsToRemove.length === 0) {
      return;
    }

    setIsSubmittingReviewAction(true);
    setStatusMessage("Removing selected refs...");
    const sessionLoadId = beginSessionLoad();

    try {
      await removeCleanupRefs(session.repository.rootPath, refsToRemove);
      const nextSession = await loadSession(startupOptions);
      if (!isLatestSessionLoad(sessionLoadId, "remove-cleanup-refs")) {
        return;
      }
      applyLoadedSession(nextSession);
      setCleanupCandidates([]);
      setDialogStack((currentStack) => closeAppDialog(currentStack, "cleanup"));
      setStatusMessage("Removed selected refs and reloaded the current session.");
    } catch (error) {
      if (!isLatestSessionLoad(sessionLoadId, "remove-cleanup-refs")) {
        return;
      }
      handleAppError(error, "Unable to remove the selected refs.", {
        action: "remove-cleanup-refs",
        refsToRemove,
      });
    } finally {
      setIsSubmittingReviewAction(false);
    }
  }

  function toggleBranchFilter(key: keyof BranchListFilters): void {
    setBranchListFilters((currentFilters) => {
      const nextFilters = {
        ...currentFilters,
        [key]: !currentFilters[key],
      } satisfies BranchListFilters;

      setStatusMessage(
        `${nextFilters[key] ? "Showing" : "Hiding"} ${getBranchFilterLabel(key).toLowerCase()}.`,
      );

      return nextFilters;
    });
  }

  async function applyBranchSelection(target: "base" | "head", branch: BranchInfo): Promise<void> {
    const nextOptions = {
      ...startupOptions,
      [target]: branch.name,
    } satisfies LaunchOptions;
    const shouldShowEventLogLoading = target === "base";

    setIsReloading(true);
    setStatusMessage(`Updating ${target} to ${branch.name}...`);
    if (shouldShowEventLogLoading) {
      setBaseBranchLoadingMessage(`Updating base to ${branch.name}...`);
    }
    const sessionLoadId = beginSessionLoad();

    try {
      const nextSession = await loadSession(nextOptions);
      if (!isLatestSessionLoad(sessionLoadId, "apply-branch-selection")) {
        return;
      }
      applyLoadedSession(nextSession);
      setStartupOptions(nextOptions);
      setDialogStack([]);
      setSelectedFileIndex(0);
      setStatusMessage(`Updated ${target} to ${branch.name}.`);
    } catch (error) {
      if (!isLatestSessionLoad(sessionLoadId, "apply-branch-selection")) {
        return;
      }
      handleAppError(error, `Unable to update ${target}.`, {
        action: "apply-branch-selection",
        branch: branch.name,
        target,
      });
    } finally {
      if (shouldShowEventLogLoading) {
        setBaseBranchLoadingMessage(null);
      }
      setIsReloading(false);
    }
  }

  async function applyCommitSelection(
    target: "base" | "head",
    sha: string,
    shortSha: string,
  ): Promise<void> {
    const nextOptions = {
      ...startupOptions,
      [target]: sha,
    } satisfies LaunchOptions;

    setIsReloading(true);
    setStatusMessage(`Updating ${target} to commit ${shortSha}...`);
    const sessionLoadId = beginSessionLoad();

    try {
      const nextSession = await loadSession(nextOptions);
      if (!isLatestSessionLoad(sessionLoadId, "apply-commit-selection")) {
        return;
      }
      applyLoadedSession(nextSession);
      setStartupOptions(nextOptions);
      setDialogStack([]);
      setSelectedFileIndex(0);
      setStatusMessage(`Updated ${target} to commit ${shortSha}.`);
    } catch (error) {
      if (!isLatestSessionLoad(sessionLoadId, "apply-commit-selection")) {
        return;
      }
      handleAppError(error, `Unable to update ${target}.`, {
        action: "apply-commit-selection",
        sha,
        shortSha,
        target,
      });
    } finally {
      setIsReloading(false);
    }
  }

  async function applyWorkingTreeSelection(): Promise<void> {
    const { base: _base, head: _head, ...remainingOptions } = startupOptions;
    const nextOptions = { ...remainingOptions } satisfies LaunchOptions;

    setIsReloading(true);
    setStatusMessage("Reviewing working tree changes against HEAD...");
    const sessionLoadId = beginSessionLoad();

    try {
      const nextSession = await loadSession(nextOptions);
      if (!isLatestSessionLoad(sessionLoadId, "apply-working-tree-selection")) {
        return;
      }
      applyLoadedSession(nextSession);
      setStartupOptions(nextOptions);
      setDialogStack([]);
      setSelectedFileIndex(0);
      setStatusMessage("Showing working tree changes against HEAD.");
    } catch (error) {
      if (!isLatestSessionLoad(sessionLoadId, "apply-working-tree-selection")) {
        return;
      }
      handleAppError(error, "Unable to review working tree changes.", {
        action: "apply-working-tree-selection",
      });
    } finally {
      setIsReloading(false);
    }
  }

  async function applyPullRequestSelection(branch: BranchInfo): Promise<void> {
    if (branch.pullRequest == null) {
      return;
    }

    const baseRemoteBranch = session.branches.remote.find(
      (candidateBranch) =>
        candidateBranch.remoteName === branch.remoteName &&
        candidateBranch.name.endsWith(`/${branch.pullRequest!.baseRefName}`),
    );
    const baseLocalBranch = session.branches.local.find(
      (candidateBranch) => candidateBranch.name === branch.pullRequest?.baseRefName,
    );
    const nextOptions = {
      ...startupOptions,
      base: baseRemoteBranch?.name ?? baseLocalBranch?.name ?? branch.pullRequest.baseRefName,
      head: branch.name,
    } satisfies LaunchOptions;

    setIsReloading(true);
    setStatusMessage(`Opening PR #${branch.pullRequest.number}...`);
    const sessionLoadId = beginSessionLoad();

    try {
      const nextSession = await loadSession(nextOptions);
      if (!isLatestSessionLoad(sessionLoadId, "apply-pull-request-selection")) {
        return;
      }
      applyLoadedSession(nextSession);
      setStartupOptions(nextOptions);
      setDialogStack([]);
      setSelectedFileIndex(0);
      setStatusMessage(`Opened PR #${branch.pullRequest.number}.`);
    } catch (error) {
      if (!isLatestSessionLoad(sessionLoadId, "apply-pull-request-selection")) {
        return;
      }
      handleAppError(error, "Unable to open the selected pull request.", {
        action: "apply-pull-request-selection",
        pullRequestNumber: branch.pullRequest.number,
      });
    } finally {
      setIsReloading(false);
    }
  }
}

function getReviewComposerContext(target: ReviewComposerTarget): {
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

function buildQuotedPullRequestReply(
  item: GitHubPullRequestConversationItem,
  body: string,
): string {
  const quotedBody = item.body
    .split(/\r?\n/u)
    .map((line) => `> ${line}`)
    .join("\n");

  return [`Replying to ${item.author.login}:`, quotedBody, "", body].join("\n");
}
