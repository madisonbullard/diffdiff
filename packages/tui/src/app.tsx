import type {
  BranchInfo,
  GitHubCleanupPreferences,
  GitHubMergeMethod,
  GitHubReviewLineAnchor,
  GitHubRefCleanupCandidate,
  GitHubPullRequestMergeRequest,
  GitHubPullRequestMergeResult,
  GitHubReviewSession,
  GitHubReviewSubmissionEvent,
  GitHubUserPreferences,
  ReviewCacheKey,
  ReviewCacheState,
  StartupOptions,
} from "@diffdiff/core";
import {
  getDefaultGitHubPreferences,
  getDiffdiffLogSession,
  logDiffdiffError,
  logDiffdiffInfo,
  logDiffdiffWarn,
  saveReviewCache,
  saveDiffdiffPreferences,
  updateDiffdiffSessionActivity,
} from "@diffdiff/core";
import type { BoxRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BranchModal,
  CommandPaletteModal,
  FileCard,
  FileTreeSidebar,
  HelpModal,
  ListFilterModal,
  StickyFileHeader,
} from "./components.tsx";
import {
  getMergeMethod,
  getMergeMethodIndex,
  MergePullRequestModal,
  PostMergeCleanupModal,
  getReviewSubmissionEvent,
  PullRequestBanner,
  PullRequestCommentsModal,
  ReviewComposerModal,
  SubmitReviewModal,
} from "./github-review.tsx";
import { getReviewAnchors } from "./review-anchors.ts";
import type { UiTheme } from "./theme.ts";
import type {
  AppPane,
  BranchListFilters,
  DiffViewPreference,
  FileTreeNode,
  ListModalView,
  PreparedReviewSession,
} from "./types.ts";
import {
  filterCommands,
  formatCommandKeybind,
  isPrintableKey,
  matchCommandKeybind,
  type CommandDefinition,
  type KeyboardInput,
} from "./commands.ts";
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
} from "./view-model.ts";
import { copyTextToClipboard } from "./clipboard.ts";
import { copySelection } from "./selection-copy.ts";

interface DiffdiffAppProps {
  addReviewThread?: (
    reviewSession: GitHubReviewSession,
    anchor: GitHubReviewLineAnchor,
    body: string,
  ) => Promise<void>;
  initialGitHubPreferences?: GitHubUserPreferences;
  initialReviewCache?: ReviewCacheState;
  initialSession: PreparedReviewSession;
  initialOptions: StartupOptions;
  loadSession: (options: StartupOptions) => Promise<PreparedReviewSession>;
  logFilePath?: string;
  mergePullRequest?: (
    reviewSession: GitHubReviewSession,
    input: GitHubPullRequestMergeRequest,
  ) => Promise<GitHubPullRequestMergeResult>;
  onExit: () => void;
  removeCleanupRefs?: (
    repositoryRootPath: string,
    refs: readonly GitHubRefCleanupCandidate[],
  ) => Promise<void>;
  submitPendingReview?: (
    reviewSession: GitHubReviewSession,
    event: GitHubReviewSubmissionEvent,
    body?: string,
  ) => Promise<void>;
  syntaxStyle: SyntaxStyle;
  theme: UiTheme;
}

type MergeModalField = "method" | "title" | "body";
type AppCommand = CommandDefinition & {
  run: () => void;
};

const LIST_FILTER_KEYS = ["workingTree", "localBranch", "openPr", "remoteBranch"] as const;
const LOADING_INDICATOR_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const TERMINAL_FOCUS_EVENT = "focus";
const TERMINAL_BLUR_EVENT = "blur";
const LEADER_KEYBIND = "ctrl+x";
const COMMAND_LIST_KEYBIND = "ctrl+p";

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
  addReviewThread,
  initialGitHubPreferences,
  initialReviewCache,
  initialSession,
  initialOptions,
  loadSession,
  logFilePath,
  mergePullRequest,
  onExit,
  removeCleanupRefs,
  submitPendingReview,
  syntaxStyle,
  theme,
}: DiffdiffAppProps) {
  const [session, setSession] = useState(initialSession);
  const [startupOptions, setStartupOptions] = useState<StartupOptions>({ ...initialOptions });
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
    if (initialReviewCache != null) {
      const availablePaths = new Set(initialSession.files.map((file) => file.path));
      return new Set(initialReviewCache.reviewedPaths.filter((path) => availablePaths.has(path)));
    }
    return new Set();
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
  const [statusMessage, setStatusMessage] = useState<string>("Ready.");
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
  const [showHelp, setShowHelp] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showCommentComposer, setShowCommentComposer] = useState(false);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showKeyLegend, setShowKeyLegend] = useState(true);
  const [showListFilterModal, setShowListFilterModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showOutdatedReviewThreads, setShowOutdatedReviewThreads] = useState(false);
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false);
  const [activeListView, setActiveListView] = useState<ListModalView>("branch");
  const [branchListFilters, setBranchListFilters] = useState<BranchListFilters>({
    ...DEFAULT_BRANCH_LIST_FILTERS,
  });
  const [branchListIndex, setBranchListIndex] = useState(0);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [commitListIndex, setCommitListIndex] = useState(0);
  const [commitSearchQuery, setCommitSearchQuery] = useState("");
  const [commitSearchActive, setCommitSearchActive] = useState(false);
  const [filterIndex, setFilterIndex] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [isSubmittingReviewAction, setIsSubmittingReviewAction] = useState(false);
  const [leaderActive, setLeaderActive] = useState(false);
  const [diffViewPreference, setDiffViewPreference] = useState<DiffViewPreference>("unified");
  const [mergeCommitMessage, setMergeCommitMessage] = useState("");
  const [mergeCommitTitle, setMergeCommitTitle] = useState("");
  const [mergeMethod, setMergeMethod] = useState<GitHubMergeMethod | undefined>(
    initialGitHubPreferences?.defaultMergeMethod,
  );
  const [mergeModalField, setMergeModalField] = useState<MergeModalField>(
    initialGitHubPreferences?.defaultMergeMethod == null ? "method" : "title",
  );
  const [reviewComposerBody, setReviewComposerBody] = useState("");
  const [reviewSubmissionBody, setReviewSubmissionBody] = useState("");
  const [reviewSubmissionEventIndex, setReviewSubmissionEventIndex] = useState(0);
  const [selectedReviewAnchorIndex, setSelectedReviewAnchorIndex] = useState(0);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [activePane, setActivePane] = useState<AppPane>("diff");
  const [collapsedDirectories, setCollapsedDirectories] = useState<Set<string>>(new Set());
  const [selectedTreePath, setSelectedTreePath] = useState(initialSession.files[0]?.path ?? "");
  const [loadingIndicatorFrame, setLoadingIndicatorFrame] = useState(0);
  const treeScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const treeRowRefs = useRef<(BoxRenderable | null)[]>([]);
  const mergeBodyScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const fileCardRefs = useRef<(BoxRenderable | null)[]>([]);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldRefreshOnFocusRef = useRef(false);
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
  const selectedTreeNode = fileTreeNodes.find((node) => node.path === selectedTreePath);
  const selectedReviewAnchors = useMemo(
    () => getReviewAnchors(session.files[selectedFileIndex], diffView),
    [diffView, selectedFileIndex, session.files],
  );
  const selectedReviewAnchor =
    selectedReviewAnchors[clampIndex(selectedReviewAnchorIndex, selectedReviewAnchors.length)];
  const openPrCount = session.branches.remote.filter((branch) => branch.pullRequest != null).length;
  const remoteBranchCount = session.branches.remote.length - openPrCount;
  const commandListLabel = formatCommandKeybind(COMMAND_LIST_KEYBIND, LEADER_KEYBIND) ?? "ctrl+p";
  const leaderKeyLabel = formatCommandKeybind(LEADER_KEYBIND, LEADER_KEYBIND) ?? "ctrl+x";
  const keyLegendToggleLabel = showKeyLegend ? "hide keys" : "show keys";
  const outdatedThreadToggleLabel = showOutdatedReviewThreads ? "hide outdated" : "show outdated";
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
          setShowHelp(true);
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
          setShowCommentsModal(true);
          setStatusMessage("Opened PR comments.");
        },
      },
      {
        category: "GitHub",
        description: "Show or hide outdated review threads in the diff.",
        enabled: session.github != null,
        keybind: "<leader>u,u",
        title: showOutdatedReviewThreads ? "Hide outdated PR threads" : "Show outdated PR threads",
        value: "github.outdated-threads",
        run: () => {
          setShowOutdatedReviewThreads((currentValue) => {
            const nextValue = !currentValue;
            setStatusMessage(
              nextValue ? "Showing outdated PR threads." : "Hiding outdated PR threads.",
            );
            return nextValue;
          });
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
      openMergeModal,
      openSubmitReviewModal,
      selectedFileIndex,
      session.github,
      showKeyLegend,
      showOutdatedReviewThreads,
      toggleCollapsed,
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
  const activeOverlay = showCommandModal
    ? "command-palette"
    : showHelp
      ? "help"
      : showCommentComposer
        ? "comment-composer"
        : showCommentsModal
          ? "comments"
          : showSubmitReviewModal
            ? "submit-review"
            : showMergeModal
              ? "merge"
              : showCleanupModal
                ? "cleanup"
                : showListFilterModal
                  ? "list-filter"
                  : showBranchModal
                    ? "branch"
                    : null;
  const keyboardHandlerRef = useRef<(key: KeyboardInput) => void>(() => undefined);
  const resolvedLogFilePath =
    logFilePath ?? getDiffdiffLogSession()?.logFilePath ?? "~/.diffdiff/logs/log-unknown.jsonl";

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
    };
  }, []);

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
      setShowCleanupModal(false);
      setShowCommentComposer(false);
      setShowCommentsModal(false);
      setShowMergeModal(false);
      setShowOutdatedReviewThreads(false);
      setShowSubmitReviewModal(false);
    }
  }, [session.github]);

  useEffect(() => {
    setSelectedReviewAnchorIndex((currentIndex) =>
      clampIndex(currentIndex, selectedReviewAnchors.length),
    );
  }, [selectedReviewAnchors.length]);

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
      if (currentPath !== "" && fileTreeNodes.some((node) => node.path === currentPath)) {
        return currentPath;
      }

      if (
        selectedFilePath != null &&
        fileTreeNodes.some((node) => node.path === selectedFilePath)
      ) {
        return selectedFilePath;
      }

      return fileTreeNodes[0]?.path ?? "";
    });
  }, [fileTreeNodes, selectedFileIndex, session.files]);

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

    scrollBox.scrollTo({ x: 0, y: offset });
    setActiveFileIndex(selectedFileIndex);
  }, [getFileTopOffsets, selectedFileIndex]);

  useEffect(() => {
    const selectedTreeIndex = visibleTreeNodes.findIndex((node) => node.path === selectedTreePath);
    const offset = getTreeTopOffsets()[selectedTreeIndex];
    const scrollBox = treeScrollRef.current;
    if (scrollBox == null || offset == null || !Number.isFinite(offset)) {
      return;
    }

    scrollBox.scrollTo({ x: 0, y: Math.max(offset - 2, 0) });
  }, [getTreeTopOffsets, selectedTreePath, visibleTreeNodes]);

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

    setActiveFileIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
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

  const refreshGitState = useCallback(async () => {
    if (isReloading) {
      return;
    }

    const selectedFilePath = session.files[selectedFileIndex]?.path;

    setIsReloading(true);
    setStatusMessage("Refreshing git state...");

    try {
      const nextSession = await loadSession(startupOptions);
      const nextSelectedFileIndex =
        selectedFilePath == null
          ? -1
          : nextSession.files.findIndex((file) => file.path === selectedFilePath);

      setSession(nextSession);
      if (nextSelectedFileIndex >= 0) {
        setSelectedFileIndex(nextSelectedFileIndex);
      }
      setStatusMessage("Refreshed git state.");
    } catch (error) {
      handleAppError(error, "Unable to refresh git state.", {
        action: "refresh-git-state",
        startupOptions,
      });
    } finally {
      setIsReloading(false);
    }
  }, [handleAppError, isReloading, loadSession, selectedFileIndex, session.files, startupOptions]);

  useEffect(() => {
    const handleBlur = () => {
      shouldRefreshOnFocusRef.current = true;
    };
    const handleFocus = () => {
      if (!shouldRefreshOnFocusRef.current) {
        return;
      }

      shouldRefreshOnFocusRef.current = false;
      void refreshGitState();
    };

    renderer.on(TERMINAL_BLUR_EVENT, handleBlur);
    renderer.on(TERMINAL_FOCUS_EVENT, handleFocus);

    return () => {
      renderer.off(TERMINAL_BLUR_EVENT, handleBlur);
      renderer.off(TERMINAL_FOCUS_EVENT, handleFocus);
    };
  }, [refreshGitState, renderer]);

  keyboardHandlerRef.current = (key) => {
    logDiffdiffInfo("app", "key_pressed", {
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
        setShowHelp(false);
      }
      return;
    }

    if (activeOverlay === "comment-composer") {
      handleCommentComposerKey(key);
      return;
    }

    if (activeOverlay === "comments") {
      if (key.name === "escape" || key.name === "q" || key.name === "t") {
        setShowCommentsModal(false);
      }
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
      setShowHelp(true);
      return;
    }

    if (session.github != null && activePane === "diff" && key.sequence === "[") {
      moveSelectedReviewAnchor(-1);
      return;
    }

    if (session.github != null && activePane === "diff" && key.sequence === "]") {
      moveSelectedReviewAnchor(1);
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
      setSelectedFileIndex(0);
      setStatusMessage("Jumped to the first file.");
      return;
    }

    if (key.name === "g" && key.shift) {
      setSelectedFileIndex(Math.max(session.files.length - 1, 0));
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
  const comparisonModeLabel =
    session.comparison.mode === "working-tree" ? "working tree" : "branch range";
  const currentBranchLabel = session.repository.currentBranch ?? "detached";

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
    });
  }, [
    resolvedLogFilePath,
    session.comparison,
    session.repository.name,
    session.repository.rootPath,
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
    logDiffdiffInfo("app", "selection_updated", {
      activeFileIndex,
      activePane,
      diffView,
      selectedFileIndex,
      selectedFilePath: session.files[selectedFileIndex]?.path,
    });
    void updateDiffdiffSessionActivity({
      selectedFilePath: session.files[selectedFileIndex]?.path,
    });
  }, [activeFileIndex, activePane, diffView, selectedFileIndex, session.files]);

  useEffect(() => {
    if (session.github != null) {
      return;
    }

    const cacheKey: ReviewCacheKey = {
      repositoryRootPath: session.repository.rootPath,
      base: session.comparison.base,
      head: session.comparison.head,
    };
    const cacheState: ReviewCacheState = {
      reviewedPaths: [...reviewedPaths],
      collapsedPaths: [...collapsedPaths],
      selectedFilePath: session.files[selectedFileIndex]?.path,
    };

    void saveReviewCache(cacheKey, cacheState);
  }, [
    collapsedPaths,
    reviewedPaths,
    selectedFileIndex,
    session.comparison.base,
    session.comparison.head,
    session.files,
    session.github,
    session.repository.rootPath,
  ]);

  useEffect(() => {
    logDiffdiffInfo("app", "overlay_updated", {
      activeOverlay,
    });
    void updateDiffdiffSessionActivity({
      activeOverlay: activeOverlay ?? undefined,
    });
  }, [activeOverlay]);

  useEffect(() => {
    logDiffdiffInfo("app", "status_message_updated", {
      message: statusMessage,
    });
    void updateDiffdiffSessionActivity({
      statusMessage,
    });
  }, [statusMessage]);

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
            <span>{"  "}</span>
            <span fg={theme.inverseText} bg={theme.border}>{` ${comparisonModeLabel} `}</span>
            <span>{"  "}</span>
            <span fg={theme.warning}>base</span>
            <span fg={theme.textMuted}>{" \u2190 "}</span>
            <span fg={theme.text}>{session.comparison.base}</span>
            <span fg={theme.border}>{"  \u2502  "}</span>
            <span fg={theme.accent}>head</span>
            <span fg={theme.textMuted}>{" \u2192 "}</span>
            <span fg={theme.text}>{session.comparison.head}</span>
          </text>
          <text fg={theme.textMuted} wrapMode="none">
            <span>{session.repository.rootPath}</span>
            <span>{"  "}</span>
            <span fg={theme.inverseText} bg={theme.accent}>{` ${currentBranchLabel} `}</span>
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
                treeRowRefs.current[index] = node;
              }}
              reviewedPaths={reviewedPaths}
              selectedFilePath={selectedFile?.path}
              selectedPath={selectedTreePath}
              theme={theme}
            />
          </scrollbox>

          {showKeyLegend ? (
            <box
              width="100%"
              flexDirection="column"
              gap={0}
              paddingLeft={1}
              paddingRight={1}
              paddingBottom={1}
            >
              <box width="100%" paddingX={1} paddingBottom={1}>
                <text fg={theme.border} wrapMode="none">
                  {"─".repeat(Math.max(sidebarWidth - 4, 0))}
                </text>
              </box>
              <box width="100%" flexDirection="column" gap={0} paddingX={1}>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>{` ${commandListLabel} `}</span>
                  <span>{" commands "}</span>
                  <span fg={theme.accent} bg={theme.surfaceMuted}>{` ${leaderKeyLabel} `}</span>
                  <span>{" leader"}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" j/k "}
                  </span>
                  <span>{" move "}</span>
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" v "}
                  </span>
                  <span>{" view"}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" \u2190/\u2192 "}
                  </span>
                  <span>{" tree "}</span>
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" r "}
                  </span>
                  <span>{" review"}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" tab "}
                  </span>
                  <span>{" pane "}</span>
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" l "}
                  </span>
                  <span>{" list"}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" c "}
                  </span>
                  <span>{"   fold "}</span>
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" ? "}
                  </span>
                  <span>{" help"}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.accent} bg={theme.surfaceMuted}>
                    {" q "}
                  </span>
                  <span>{" quit"}</span>
                </text>
                {session.github != null ? (
                  <>
                    <text fg={theme.textMuted} wrapMode="none">
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {" [/] "}
                      </span>
                      <span>{" line "}</span>
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {" a "}
                      </span>
                      <span>{" comment"}</span>
                    </text>
                    <text fg={theme.textMuted} wrapMode="none">
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {" s "}
                      </span>
                      <span>{"   submit "}</span>
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {" t "}
                      </span>
                      <span>{" comments"}</span>
                    </text>
                    <text fg={theme.textMuted} wrapMode="none">
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {" u "}
                      </span>
                      <span>{`   ${outdatedThreadToggleLabel} `}</span>
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {" y "}
                      </span>
                      <span>{" PR URL"}</span>
                    </text>
                    <text fg={theme.textMuted} wrapMode="none">
                      <span fg={theme.accent} bg={theme.surfaceMuted}>
                        {" m "}
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
                    key={file.path}
                    file={file}
                    diffView={diffView}
                    headerVariant={index === activeFileIndex ? "sticky-compact" : undefined}
                    isCollapsed={isCollapsed}
                    removeTopPadding={index === 0}
                    isReviewed={isReviewed}
                    isSelected={isSelected}
                    reviewThreads={session.github?.pullRequest.reviewThreads.filter(
                      (thread) => thread.path === file.path,
                    )}
                    rootRef={(node) => {
                      fileCardRefs.current[index] = node;
                    }}
                    selectedReviewAnchor={
                      isSelected && session.github != null ? selectedReviewAnchor : undefined
                    }
                    showOutdatedReviewThreads={showOutdatedReviewThreads}
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

      {showBranchModal ? (
        <BranchModal
          activeView={activeListView}
          base={session.comparison.base}
          branchItems={branchItems}
          branchIndex={branchListIndex}
          commitItems={filteredCommitItems}
          commitIndex={commitListIndex}
          commitSearchQuery={commitSearchQuery}
          commitSearchActive={commitSearchActive}
          comparisonMode={session.comparison.mode}
          filters={branchListFilters}
          head={session.comparison.head}
          localBranchCount={session.branches.local.length}
          openPrCount={openPrCount}
          remoteBranchCount={remoteBranchCount}
          theme={theme}
        />
      ) : null}

      {showCommandModal ? (
        <CommandPaletteModal
          commands={filteredCommands}
          leaderKeybind={LEADER_KEYBIND}
          query={commandQuery}
          selectedIndex={commandIndex}
          theme={theme}
        />
      ) : null}

      {showBranchModal && showListFilterModal ? (
        <ListFilterModal filters={branchListFilters} selectedIndex={filterIndex} theme={theme} />
      ) : null}

      {showCommentComposer && selectedReviewAnchor != null ? (
        <ReviewComposerModal
          anchor={selectedReviewAnchor}
          body={reviewComposerBody}
          isSubmitting={isSubmittingReviewAction}
          theme={theme}
        />
      ) : null}

      {showCommentsModal && session.github != null ? (
        <PullRequestCommentsModal
          pullRequest={session.github.pullRequest}
          showOutdatedThreads={showOutdatedReviewThreads}
          theme={theme}
        />
      ) : null}

      {showSubmitReviewModal ? (
        <SubmitReviewModal
          body={reviewSubmissionBody}
          eventIndex={reviewSubmissionEventIndex}
          isSubmitting={isSubmittingReviewAction}
          theme={theme}
        />
      ) : null}

      {showMergeModal && session.github != null ? (
        <MergePullRequestModal
          body={mergeCommitMessage}
          bodyScrollRef={mergeBodyScrollRef}
          canSubmit={session.github.pullRequest.merge.canMerge && mergeMethod != null}
          field={mergeModalField}
          isSubmitting={isSubmittingReviewAction}
          method={mergeMethod}
          pullRequest={session.github.pullRequest}
          theme={theme}
          title={mergeCommitTitle}
        />
      ) : null}

      {showCleanupModal ? (
        <PostMergeCleanupModal
          canApply={canApplyCleanup}
          candidates={cleanupCandidates}
          isSubmitting={isSubmittingReviewAction}
          selectedIndex={cleanupCandidateIndex}
          selection={cleanupSelection}
          theme={theme}
        />
      ) : null}

      {showHelp ? <HelpModal theme={theme} /> : null}
    </box>
  );

  function moveSelectedFile(delta: number): void {
    setSelectedFileIndex((currentIndex) => {
      const nextIndex = clampIndex(currentIndex + delta, session.files.length);
      if (nextIndex !== currentIndex) {
        setStatusMessage(`Selected ${session.files[nextIndex]?.path ?? "file"}.`);
      }
      return nextIndex;
    });
  }

  function moveSelectedReviewAnchor(delta: number): void {
    if (selectedReviewAnchors.length === 0) {
      setStatusMessage("No commentable lines are available in the selected file.");
      return;
    }

    setSelectedReviewAnchorIndex((currentIndex) => {
      const nextIndex = clampIndex(currentIndex + delta, selectedReviewAnchors.length);
      const nextAnchor = selectedReviewAnchors[nextIndex];

      if (nextAnchor != null) {
        setStatusMessage(
          `Selected ${nextAnchor.path}:${nextAnchor.line} (${nextAnchor.side.toLowerCase()}).`,
        );
      }

      return nextIndex;
    });
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
        setSelectedFileIndex(nextIndex);
        setStatusMessage(
          `Reviewed ${file.path}. Jumped to ${files[nextIndex]?.path ?? "next file"}.`,
        );
      } else {
        setStatusMessage(`Reviewed ${file.path}. All files reviewed!`);
      }
    }
  }

  function toggleCollapsed(fileIndex: number): void {
    const file = session.files[fileIndex];
    if (file == null) {
      return;
    }

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

  function toggleDiffView(): void {
    setDiffViewPreference((currentView) => {
      const nextPreference = currentView === "unified" ? "side-by-side" : "unified";
      const nextView = resolveDiffView(nextPreference, diffPaneWidth);

      if (nextPreference === "side-by-side" && nextView !== "split") {
        setStatusMessage(
          `Need at least ${MIN_SIDE_BY_SIDE_DIFF_WIDTH} columns in the diff pane for side-by-side diffs; showing unified.`,
        );
      } else {
        setStatusMessage(`Showing ${getDiffViewLabel(nextView)} diffs.`);
      }

      return nextPreference;
    });
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
    setShowCommandModal(true);
    setStatusMessage("Opened command palette.");
  }

  function closeCommandModal(): void {
    setShowCommandModal(false);
    setCommandQuery("");
    setCommandIndex(0);
    setStatusMessage("Closed command palette.");
  }

  function runCommand(command: AppCommand): void {
    clearLeaderMode();
    setShowCommandModal(false);
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
    setActivePane((currentPane) => {
      const nextPane = currentPane === "diff" ? "tree" : "diff";
      if (nextPane === "tree") {
        setStatusMessage("File tree active.");
      } else {
        setStatusMessage("Diff view active.");
      }
      return nextPane;
    });
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

    const currentIndex = visibleTreeNodes.findIndex((node) => node.path === selectedTreePath);
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
        const parentNode = fileTreeNodes.find((node) => node.path === currentNode.parentPath);
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
    setShowListFilterModal(false);
    setShowBranchModal(true);
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
      setShowBranchModal(false);
      setShowListFilterModal(false);
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
      setShowListFilterModal(true);
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
      setShowListFilterModal(false);
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
      setShowCommentComposer(false);
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

  function handleSubmitReviewModalKey(key: KeyboardInput): void {
    if (key.name === "escape") {
      setShowSubmitReviewModal(false);
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
      setShowMergeModal(false);
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
      setShowCleanupModal(false);
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

    setReviewComposerBody("");
    setShowCommentComposer(true);
    setStatusMessage(`Commenting on ${selectedReviewAnchor.path}:${selectedReviewAnchor.line}.`);
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
    setShowSubmitReviewModal(true);
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
    setShowMergeModal(true);
    setStatusMessage("Preparing merge modal.");
  }

  async function submitCommentComposer(): Promise<void> {
    if (
      session.github == null ||
      addReviewThread == null ||
      selectedReviewAnchor == null ||
      reviewComposerBody.trim() === ""
    ) {
      return;
    }

    setIsSubmittingReviewAction(true);
    setStatusMessage(
      `Adding review comment on ${selectedReviewAnchor.path}:${selectedReviewAnchor.line}...`,
    );

    try {
      await addReviewThread(session.github, selectedReviewAnchor, reviewComposerBody.trim());
      const nextSession = await loadSession(startupOptions);
      setSession(nextSession);
      setShowCommentComposer(false);
      setReviewComposerBody("");
      setStatusMessage("Added review comment.");
    } catch (error) {
      handleAppError(error, "Unable to add the review comment.", {
        action: "add-review-thread",
        anchor: selectedReviewAnchor,
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

    try {
      await submitPendingReview(
        session.github,
        getReviewSubmissionEvent(reviewSubmissionEventIndex),
        reviewSubmissionBody.trim() === "" ? undefined : reviewSubmissionBody.trim(),
      );
      const nextSession = await loadSession(startupOptions);
      setSession(nextSession);
      setShowSubmitReviewModal(false);
      setReviewSubmissionBody("");
      setStatusMessage("Submitted review.");
    } catch (error) {
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

    try {
      const mergeResult = await mergePullRequest(session.github, {
        commitMessage: mergeCommitMessage.trim() === "" ? undefined : mergeCommitMessage.trim(),
        commitTitle: mergeCommitTitle.trim() === "" ? undefined : mergeCommitTitle.trim(),
        comparison: session.comparison,
        method: mergeMethod,
      });
      const nextSession = await loadSession(startupOptions);
      setSession(nextSession);
      setShowMergeModal(false);
      setStatusMessage("Merged the pull request and refreshed local refs.");

      if (mergeResult.cleanupCandidates.length > 0) {
        setCleanupCandidateIndex(0);
        setCleanupCandidates(mergeResult.cleanupCandidates);
        setCleanupSelection(gitHubPreferencesRef.current.cleanup);
        setShowCleanupModal(true);
        setStatusMessage("Merged the pull request. Choose any stale refs to remove.");
      }
    } catch (error) {
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

    try {
      await removeCleanupRefs(session.repository.rootPath, refsToRemove);
      const nextSession = await loadSession(startupOptions);
      setSession(nextSession);
      setCleanupCandidates([]);
      setShowCleanupModal(false);
      setStatusMessage("Removed selected refs and reloaded the current session.");
    } catch (error) {
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
    } satisfies StartupOptions;
    const shouldShowEventLogLoading = target === "base";

    setIsReloading(true);
    setStatusMessage(`Updating ${target} to ${branch.name}...`);
    if (shouldShowEventLogLoading) {
      setBaseBranchLoadingMessage(`Updating base to ${branch.name}...`);
    }

    try {
      const nextSession = await loadSession(nextOptions);
      setSession(nextSession);
      setStartupOptions(nextOptions);
      setShowBranchModal(false);
      setShowCommentComposer(false);
      setShowCommentsModal(false);
      setShowListFilterModal(false);
      setShowMergeModal(false);
      setShowSubmitReviewModal(false);
      setShowCleanupModal(false);
      setSelectedFileIndex(0);
      setStatusMessage(`Updated ${target} to ${branch.name}.`);
    } catch (error) {
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
    } satisfies StartupOptions;

    setIsReloading(true);
    setStatusMessage(`Updating ${target} to commit ${shortSha}...`);

    try {
      const nextSession = await loadSession(nextOptions);
      setSession(nextSession);
      setStartupOptions(nextOptions);
      setShowBranchModal(false);
      setShowCommentComposer(false);
      setShowCommentsModal(false);
      setShowListFilterModal(false);
      setShowMergeModal(false);
      setShowSubmitReviewModal(false);
      setShowCleanupModal(false);
      setSelectedFileIndex(0);
      setStatusMessage(`Updated ${target} to commit ${shortSha}.`);
    } catch (error) {
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
    const nextOptions = { ...remainingOptions } satisfies StartupOptions;

    setIsReloading(true);
    setStatusMessage("Reviewing working tree changes against HEAD...");

    try {
      const nextSession = await loadSession(nextOptions);
      setSession(nextSession);
      setStartupOptions(nextOptions);
      setShowBranchModal(false);
      setShowCommentComposer(false);
      setShowCommentsModal(false);
      setShowListFilterModal(false);
      setShowSubmitReviewModal(false);
      setSelectedFileIndex(0);
      setStatusMessage("Showing working tree changes against HEAD.");
    } catch (error) {
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
    } satisfies StartupOptions;

    setIsReloading(true);
    setStatusMessage(`Opening PR #${branch.pullRequest.number}...`);

    try {
      const nextSession = await loadSession(nextOptions);
      setSession(nextSession);
      setStartupOptions(nextOptions);
      setShowBranchModal(false);
      setShowCommentComposer(false);
      setShowCommentsModal(false);
      setShowListFilterModal(false);
      setShowSubmitReviewModal(false);
      setSelectedFileIndex(0);
      setStatusMessage(`Opened PR #${branch.pullRequest.number}.`);
    } catch (error) {
      handleAppError(error, "Unable to open the selected pull request.", {
        action: "apply-pull-request-selection",
        pullRequestNumber: branch.pullRequest.number,
      });
    } finally {
      setIsReloading(false);
    }
  }
}
