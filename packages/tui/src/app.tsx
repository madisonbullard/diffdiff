import type { BranchInfo, StartupOptions } from "@diffdiff/core";
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
  initialSession: PreparedReviewSession;
  initialOptions: StartupOptions;
  loadSession: (options: StartupOptions) => Promise<PreparedReviewSession>;
  onExit: () => void;
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
  initialSession,
  initialOptions,
  loadSession,
  onExit,
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
  const [baseBranchLoadingMessage, setBaseBranchLoadingMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showListFilterModal, setShowListFilterModal] = useState(false);
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
  const [diffViewPreference, setDiffViewPreference] = useState<DiffViewPreference>("unified");
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
  const visibleTreeNodes = useMemo(
    () => getVisibleFileTreeNodes(fileTreeNodes, collapsedDirectories),
    [collapsedDirectories, fileTreeNodes],
  );
  const diffView = useMemo(
    () => resolveDiffView(diffViewPreference, diffPaneWidth),
    [diffPaneWidth, diffViewPreference],
  );
  const diffViewLabel = useMemo(() => getDiffViewLabel(diffView), [diffView]);

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
  const openPrCount = session.branches.remote.filter((branch) => branch.pullRequest != null).length;
  const remoteBranchCount = session.branches.remote.length - openPrCount;
  const activeOverlay = showHelp
    ? "help"
    : showListFilterModal
      ? "list-filter"
      : showBranchModal
        ? "branch"
        : null;
  const keyboardHandlerRef = useRef<(key: KeyboardInput) => void>(() => undefined);

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

  keyboardHandlerRef.current = (key) => {
    if (activeOverlay === "help") {
      if (key.name === "escape" || key.name === "q" || key.sequence === "?") {
        setShowHelp(false);
      }
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
        showToast("Copied to clipboard");
      },
      onError: () => {
        setStatusMessage("Unable to copy selection.");
      },
    });
  }, [renderer, showToast]);

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
            <span fg={theme.border}>{"  \u2502  "}</span>
            <span>{diffViewLabel}</span>
            <span fg={theme.border}>{"  \u2502  "}</span>
            <span fg={reviewedPaths.size > 0 ? theme.success : theme.textMuted}>
              {reviewedPaths.size}
            </span>
            <span>{` / ${session.files.length} reviewed`}</span>
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
            paddingTop={1}
            paddingBottom={1}
            flexDirection="column"
            gap={0}
          >
            <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
              <text fg={activePane === "tree" ? theme.accent : theme.textMuted} wrapMode="none">
                Files
              </text>
              <text fg={theme.textMuted} wrapMode="none">
                {`${session.files.length}`}
              </text>
            </box>
            <text fg={theme.textMuted} wrapMode="none">
              <span
                fg={activePane === "tree" ? theme.inverseText : theme.textMuted}
                bg={activePane === "tree" ? theme.accent : theme.surface}
              >{` ${activePane === "tree" ? "tree" : "diff"} `}</span>
              <span>{"  "}</span>
              <span fg={theme.accent} bg={theme.surfaceMuted}>
                {" tab "}
              </span>
              <span>{" pane"}</span>
            </text>
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
              paddingRight={2}
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
              paddingRight={2}
              paddingY={1}
              gap={1}
            >
              {session.files.length === 0 ? (
                <box
                  border={["left"]}
                  borderColor={theme.border}
                  backgroundColor={theme.surface}
                  paddingLeft={2}
                  paddingRight={1}
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
                    rootRef={(node) => {
                      fileCardRefs.current[index] = node;
                    }}
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
          <span>{" pane"}</span>
          <span fg={theme.border}>{"  \u2502  "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" r "}
          </span>
          <span>{" review "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" m "}
          </span>
          <span>{" review+next "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" c "}
          </span>
          <span>{" collapse "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" v "}
          </span>
          <span>{" view"}</span>
          <span fg={theme.border}>{"  \u2502  "}</span>
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
      </box>

      {baseBranchLoadingMessage != null || toastMessage != null ? (
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
        if (selectedBranchItem?.kind === "working-tree") {
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
      setShowListFilterModal(false);
      setSelectedFileIndex(0);
      setStatusMessage(`Updated ${target} to ${branch.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to update ${target}.`;
      setStatusMessage(message);
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
      setShowListFilterModal(false);
      setSelectedFileIndex(0);
      setStatusMessage(`Updated ${target} to commit ${shortSha}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to update ${target}.`;
      setStatusMessage(message);
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
      setShowListFilterModal(false);
      setSelectedFileIndex(0);
      setStatusMessage("Showing working tree changes against HEAD.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to review working tree changes.";
      setStatusMessage(message);
    } finally {
      setIsReloading(false);
    }
  }
}
