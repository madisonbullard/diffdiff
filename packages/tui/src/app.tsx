import type {
  BranchInfo,
  GitHubReviewLineAnchor,
  GitHubReviewSession,
  GitHubReviewSubmissionEvent,
  StartupOptions,
} from "@diffdiff/core";
import {
  getDiffdiffLogSession,
  logDiffdiffError,
  logDiffdiffInfo,
  logDiffdiffWarn,
  updateDiffdiffSessionActivity,
} from "@diffdiff/core";
import type { BoxRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BranchModal,
  FileCard,
  FileTreeSidebar,
  HelpModal,
  ListFilterModal,
  StickyFileHeader,
} from "./components.tsx";
import {
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
import { copySelection } from "./selection-copy.ts";

interface DiffdiffAppProps {
  addReviewThread?: (
    reviewSession: GitHubReviewSession,
    anchor: GitHubReviewLineAnchor,
    body: string,
  ) => Promise<void>;
  initialSession: PreparedReviewSession;
  initialOptions: StartupOptions;
  loadSession: (options: StartupOptions) => Promise<PreparedReviewSession>;
  logFilePath?: string;
  onExit: () => void;
  submitPendingReview?: (
    reviewSession: GitHubReviewSession,
    event: GitHubReviewSubmissionEvent,
    body?: string,
  ) => Promise<void>;
  syntaxStyle: SyntaxStyle;
  theme: UiTheme;
}

interface KeyboardInput {
  name: string;
  sequence?: string;
  shift?: boolean;
}

const LIST_FILTER_KEYS = ["workingTree", "localBranch", "openPr", "remoteBranch"] as const;
const LOADING_INDICATOR_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const TERMINAL_FOCUS_EVENT = "focus";
const TERMINAL_BLUR_EVENT = "blur";

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

export function DiffdiffApp({
  addReviewThread,
  initialSession,
  initialOptions,
  loadSession,
  logFilePath,
  onExit,
  submitPendingReview,
  syntaxStyle,
  theme,
}: DiffdiffAppProps) {
  const [session, setSession] = useState(initialSession);
  const [startupOptions, setStartupOptions] = useState<StartupOptions>({ ...initialOptions });
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(new Set());
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() =>
    reconcileCollapsedPaths(new Set<string>(), initialSession.files),
  );
  const [statusMessage, setStatusMessage] = useState<string>("Ready.");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorToastMessage, setErrorToastMessage] = useState<string | null>(null);
  const [baseBranchLoadingMessage, setBaseBranchLoadingMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCommentComposer, setShowCommentComposer] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showListFilterModal, setShowListFilterModal] = useState(false);
  const [showOutdatedReviewThreads, setShowOutdatedReviewThreads] = useState(false);
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false);
  const [activeListView, setActiveListView] = useState<ListModalView>("branch");
  const [branchListFilters, setBranchListFilters] = useState<BranchListFilters>({
    ...DEFAULT_BRANCH_LIST_FILTERS,
  });
  const [branchListIndex, setBranchListIndex] = useState(0);
  const [commitListIndex, setCommitListIndex] = useState(0);
  const [commitSearchQuery, setCommitSearchQuery] = useState("");
  const [commitSearchActive, setCommitSearchActive] = useState(false);
  const [filterIndex, setFilterIndex] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [isSubmittingReviewAction, setIsSubmittingReviewAction] = useState(false);
  const [diffViewPreference, setDiffViewPreference] = useState<DiffViewPreference>("unified");
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
  const activeOverlay = showHelp
    ? "help"
    : showCommentComposer
      ? "comment-composer"
      : showCommentsModal
        ? "comments"
        : showSubmitReviewModal
          ? "submit-review"
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

  const showErrorToast = useCallback(() => {
    const message = `View error logs at ${resolvedLogFilePath}`;
    setErrorToastMessage(message);
    logDiffdiffWarn("app", "error_toast_shown", {
      logFilePath: resolvedLogFilePath,
      message,
    });
  }, [resolvedLogFilePath]);

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
      showErrorToast();
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
      showErrorToast();
    },
    [resolvedLogFilePath, showErrorToast],
  );

  useEffect(() => {
    if (session.github == null) {
      setShowCommentComposer(false);
      setShowCommentsModal(false);
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
      selectedFilePath: session.files[selectedFileIndex]?.path,
    });

    if (
      activeOverlay == null &&
      errorToastMessage != null &&
      (key.name === "escape" || key.name === "x")
    ) {
      dismissErrorToast();
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

    if (activeOverlay === "list-filter") {
      handleListFilterModalKey(key);
      return;
    }

    if (activeOverlay === "branch") {
      handleBranchModalKey(key);
      return;
    }

    if (key.name === "q") {
      onExit();
      return;
    }

    if (key.sequence === "?") {
      setShowHelp(true);
      return;
    }

    if (key.name === "l") {
      openBranchModal();
      return;
    }

    if (key.name === "tab") {
      toggleActivePane();
      return;
    }

    if (key.name === "v") {
      toggleDiffView();
      return;
    }

    if (session.github != null && key.name === "t") {
      setShowCommentsModal(true);
      setStatusMessage("Opened PR comments.");
      return;
    }

    if (session.github != null && key.name === "u") {
      setShowOutdatedReviewThreads((currentValue) => {
        const nextValue = !currentValue;
        setStatusMessage(
          nextValue ? "Showing outdated PR threads." : "Hiding outdated PR threads.",
        );
        return nextValue;
      });
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

    if (session.github != null && activePane === "diff" && key.name === "a") {
      openCommentComposer();
      return;
    }

    if (session.github != null && key.name === "s") {
      openSubmitReviewModal();
      return;
    }

    if (activePane === "tree") {
      handleTreePaneKey(key);
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

    if (key.name === "c" || key.name === "return") {
      toggleCollapsed(selectedFileIndex);
      return;
    }

    if (key.name === "r") {
      toggleReviewed(selectedFileIndex);
      return;
    }

    if (key.name === "m") {
      reviewCollapseAndAdvance(selectedFileIndex);
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

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current != null) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      toastTimeoutRef.current = null;
      setToastMessage(null);
    }, 5000);
  }, []);
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
            <span fg={theme.inverseText} bg={theme.accent}>{` ${currentBranchLabel} `}</span>
          </text>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.text}>{session.files.length}</span>
            <span>{" files"}</span>
          </text>
        </box>
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <text fg={theme.textMuted} wrapMode="none">
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
            {session.repository.rootPath}
          </text>
        </box>
        {session.warnings[0] != null ? (
          <text fg={theme.warning} wrapMode="none">
            <span>{"warning "}</span>
            <span>{session.warnings[0].message}</span>
          </text>
        ) : null}
        {session.github != null ? (
          <PullRequestBanner
            pullRequest={session.github.pullRequest}
            showOutdatedThreads={showOutdatedReviewThreads}
            theme={theme}
          />
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
          <box
            width="100%"
            border={["left"]}
            borderColor={activePane === "tree" ? theme.borderActive : theme.border}
            backgroundColor={activePane === "tree" ? theme.surfaceMuted : theme.surface}
            paddingLeft={2}
            paddingRight={1}
            paddingY={1}
            flexDirection="column"
            gap={0}
          >
            <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
              <text fg={activePane === "tree" ? theme.accent : theme.textMuted} wrapMode="none">
                {`${session.files.length} ${session.files.length === 1 ? "file" : "files"}`}
              </text>
              <text fg={theme.textMuted} wrapMode="none">
                <span fg={theme.success}>{`+${totalDiff.additions}`}</span>
                <span fg={theme.border}>{" / "}</span>
                <span fg={theme.danger}>{`-${totalDiff.deletions}`}</span>
              </text>
            </box>
            <box width="100%" flexDirection="row" justifyContent="flex-end">
              <text fg={theme.textMuted} wrapMode="none">
                <span fg={reviewedPaths.size > 0 ? theme.success : theme.textMuted}>
                  {reviewedPaths.size}
                </span>
                <span>{` / ${session.files.length} reviewed`}</span>
              </text>
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
              paddingY={1}
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
                    isCollapsed={isCollapsed}
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
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={0}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <text fg={theme.textMuted} wrapMode="none">
            {selectedFile != null ? (
              <>
                <span fg={theme.text}>{selectedFile.path}</span>
                {selectedReviewAnchor != null && session.github != null ? (
                  <>
                    <span fg={theme.border}>{"  │  "}</span>
                    <span>{`${selectedReviewAnchor.side.toLowerCase()} ${selectedReviewAnchor.line}`}</span>
                  </>
                ) : null}
              </>
            ) : (
              <span>No file selected</span>
            )}
          </text>
          <text fg={isReloading ? theme.accent : theme.textMuted} wrapMode="none">
            <span>{statusMessage}</span>
          </text>
        </box>
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" j/k "}
          </span>
          <span>{" move "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" \u2190/\u2192 "}
          </span>
          <span>{" tree "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" tab "}
          </span>
          <span>{" pane "}</span>
          <span fg={theme.border}>{"│ "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" r "}
          </span>
          <span>{" review "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" m "}
          </span>
          <span>{" next "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" c "}
          </span>
          <span>{" collapse "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" v "}
          </span>
          <span>{" view "}</span>
          <span fg={theme.border}>{"│ "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" l "}
          </span>
          <span>{" list "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" ? "}
          </span>
          <span>{" help "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" q "}
          </span>
          <span>{" quit"}</span>
        </text>
        {session.github != null ? (
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" [/] "}
            </span>
            <span>{" line "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" a "}
            </span>
            <span>{" comment "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" s "}
            </span>
            <span>{" submit review "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" t "}
            </span>
            <span>{" comments "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" u "}
            </span>
            <span>{" outdated"}</span>
          </text>
        ) : null}
      </box>

      {baseBranchLoadingMessage != null || toastMessage != null || errorToastMessage != null ? (
        <box
          position="absolute"
          right={2}
          bottom={4}
          marginBottom={1}
          zIndex={40}
          flexDirection="column"
          gap={1}
        >
          {baseBranchLoadingMessage != null ? (
            <box
              backgroundColor={theme.surfaceMuted}
              border={["left"]}
              borderColor={theme.accent}
              paddingX={2}
              paddingY={1}
            >
              <text fg={theme.accent} wrapMode="none">
                {`${LOADING_INDICATOR_FRAMES[loadingIndicatorFrame]} `}
                <span fg={theme.text}>{baseBranchLoadingMessage}</span>
              </text>
            </box>
          ) : null}
          {toastMessage != null ? (
            <box
              backgroundColor={theme.surfaceMuted}
              border={["left"]}
              borderColor={theme.success}
              paddingX={2}
              paddingY={1}
            >
              <text fg={theme.success} wrapMode="none">
                {"\u2713 "}
                <span fg={theme.text}>{toastMessage}</span>
              </text>
            </box>
          ) : null}
          {errorToastMessage != null ? (
            <box
              backgroundColor={theme.surfaceMuted}
              border={["left"]}
              borderColor={theme.danger}
              paddingX={2}
              paddingY={1}
            >
              <box width="100%" flexDirection="column" gap={0}>
                <text fg={theme.danger} wrapMode="none">
                  {"! "}
                  <span fg={theme.text}>{errorToastMessage}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.inverseText} bg={theme.surface}>
                    {" x "}
                  </span>
                  <span>{" dismiss"}</span>
                </text>
              </box>
            </box>
          ) : null}
        </box>
      ) : null}

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

    setReviewedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      if (nextPaths.has(file.path)) {
        nextPaths.delete(file.path);
        setStatusMessage(`Marked ${file.path} as not reviewed.`);
      } else {
        nextPaths.add(file.path);
        setStatusMessage(`Marked ${file.path} as reviewed.`);
      }
      return nextPaths;
    });
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

  function reviewCollapseAndAdvance(fileIndex: number): void {
    const file = session.files[fileIndex];
    if (file == null) {
      return;
    }

    setReviewedPaths((currentPaths) => new Set(currentPaths).add(file.path));
    setCollapsedPaths((currentPaths) => new Set(currentPaths).add(file.path));
    setSelectedFileIndex((currentIndex) => clampIndex(currentIndex + 1, session.files.length));
    setStatusMessage(`Reviewed ${file.path} and moved on.`);
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
      `Adding a pending review thread on ${selectedReviewAnchor.path}:${selectedReviewAnchor.line}...`,
    );

    try {
      await addReviewThread(session.github, selectedReviewAnchor, reviewComposerBody.trim());
      const nextSession = await loadSession(startupOptions);
      setSession(nextSession);
      setShowCommentComposer(false);
      setReviewComposerBody("");
      setStatusMessage("Added the comment to the pending review.");
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
    setStatusMessage("Submitting pending review...");

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
      setStatusMessage("Submitted the pending review.");
    } catch (error) {
      handleAppError(error, "Unable to submit the review.", {
        action: "submit-review",
        event: getReviewSubmissionEvent(reviewSubmissionEventIndex),
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
      setShowSubmitReviewModal(false);
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
      setShowSubmitReviewModal(false);
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
