import type { BranchInfo, StartupOptions } from "@diffdiff/core";
import type { BoxRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BranchModal,
  FileCard,
  HelpModal,
  ListFilterModal,
  StickyFileHeader,
} from "./components.tsx";
import type { UiTheme } from "./theme.ts";
import type {
  BranchListFilters,
  DiffViewPreference,
  ListModalView,
  PreparedReviewSession,
} from "./types.ts";
import {
  buildBranchListItems,
  buildCommitListItems,
  clampIndex,
  DEFAULT_BRANCH_LIST_FILTERS,
  findInitialBranchListSelection,
  getDiffViewLabel,
  getTopIntersectingFileIndex,
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
  const [showHelp, setShowHelp] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showListFilterModal, setShowListFilterModal] = useState(false);
  const [activeListView, setActiveListView] = useState<ListModalView>("branch");
  const [branchListFilters, setBranchListFilters] = useState<BranchListFilters>({
    ...DEFAULT_BRANCH_LIST_FILTERS,
  });
  const [branchListIndex, setBranchListIndex] = useState(0);
  const [commitListIndex, setCommitListIndex] = useState(0);
  const [filterIndex, setFilterIndex] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [diffViewPreference, setDiffViewPreference] = useState<DiffViewPreference>("unified");
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const fileCardRefs = useRef<(BoxRenderable | null)[]>([]);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderer = useRenderer();
  const terminalDimensions = useTerminalDimensions();
  const diffView = useMemo(
    () => resolveDiffView(diffViewPreference, terminalDimensions.width),
    [diffViewPreference, terminalDimensions.width],
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
  const stickyFile = session.files[activeFileIndex];
  const selectedBranchItem = branchItems[clampIndex(branchListIndex, branchItems.length)];
  const selectedCommitItem = commitItems[clampIndex(commitListIndex, commitItems.length)];
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
    return () => {
      if (toastTimeoutRef.current != null) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCollapsedPaths((currentPaths) => {
      const nextPaths = reconcileCollapsedPaths(currentPaths, session.files);
      return haveSamePaths(currentPaths, nextPaths) ? currentPaths : nextPaths;
    });
  }, [session.files]);

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

    if (key.name === "v") {
      toggleDiffView();
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
        paddingY={1}
        flexDirection="column"
        gap={0}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <text fg={theme.text} wrapMode="none">
            <span fg={theme.accent}>diffdiff</span>
            <span fg={theme.textMuted}>{"  •  "}</span>
            <span>{session.repository.name}</span>
            <span> </span>
            <span fg={theme.text} bg={theme.surfaceMuted}>{` ${currentBranchLabel} `}</span>
          </text>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.text}>{session.files.length}</span>
            <span>{" files  •  "}</span>
            <span fg={theme.text}>{diffViewLabel}</span>
            <span>{" diff  •  "}</span>
            <span fg={theme.text}>{reviewedPaths.size}</span>
            <span>{" reviewed"}</span>
          </text>
        </box>
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.inverseText} bg={theme.accent}>{` ${comparisonModeLabel} `}</span>
          <span>{"  "}</span>
          <span fg={theme.warning}>base</span>
          <span>{` ${session.comparison.base}`}</span>
          <span>{"  •  "}</span>
          <span fg={theme.accent}>head</span>
          <span>{` ${session.comparison.head}`}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          {session.repository.rootPath}
        </text>
        {session.warnings[0] != null ? (
          <text fg={theme.warning} wrapMode="none">
            warning: {session.warnings[0].message}
          </text>
        ) : null}
      </box>

      {stickyFile != null ? (
        <box flexShrink={0} width="100%" paddingX={2} backgroundColor={theme.appBackground}>
          <StickyFileHeader
            file={stickyFile}
            isReviewed={reviewedPaths.has(stickyFile.path)}
            isSelected={activeFileIndex === selectedFileIndex}
            theme={theme}
          />
        </box>
      ) : null}

      <scrollbox
        ref={scrollRef}
        width="100%"
        flexGrow={1}
        focused={activeOverlay == null}
        viewportOptions={{ backgroundColor: theme.appBackground }}
        contentOptions={{ backgroundColor: theme.appBackground }}
        verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
      >
        <box width="100%" flexDirection="column" paddingX={2} paddingY={1} gap={1}>
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
              <text fg={theme.text}>No changed files found for this comparison.</text>
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
                terminalWidth={terminalDimensions.width}
                theme={theme}
              />
            );
          })}
        </box>
      </scrollbox>

      <box
        flexShrink={0}
        width="100%"
        backgroundColor={theme.chromeBackground}
        paddingX={2}
        paddingY={1}
        flexDirection="column"
        gap={0}
      >
        <text fg={isReloading ? theme.accent : theme.textMuted} wrapMode="none">
          {selectedFile != null ? `selected ${selectedFile.path}` : "No file selected."}
          <span>{"  •  "}</span>
          <span fg={isReloading ? theme.accent : theme.text}>
            {isReloading ? "Loading comparison..." : statusMessage}
          </span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.text} bg={theme.surfaceMuted}>
            {" "}
            q{" "}
          </span>
          <span>{" quit  "}</span>
          <span fg={theme.text} bg={theme.surfaceMuted}>
            {" "}
            j/k{" "}
          </span>
          <span>{" move  "}</span>
          <span fg={theme.text} bg={theme.surfaceMuted}>
            {" "}
            r{" "}
          </span>
          <span>{" reviewed  "}</span>
          <span fg={theme.text} bg={theme.surfaceMuted}>
            {" "}
            c{" "}
          </span>
          <span>{" collapse  "}</span>
          <span fg={theme.text} bg={theme.surfaceMuted}>
            {" "}
            v{" "}
          </span>
          <span>{" view  "}</span>
          <span fg={theme.text} bg={theme.surfaceMuted}>
            {" "}
            m{" "}
          </span>
          <span>{" review+next  "}</span>
          <span fg={theme.text} bg={theme.surfaceMuted}>
            {" "}
            l{" "}
          </span>
          <span>{" list  "}</span>
          <span fg={theme.text} bg={theme.surfaceMuted}>
            {" "}
            ?{" "}
          </span>
          <span>{" help"}</span>
        </text>
      </box>

      {toastMessage != null ? (
        <box position="absolute" right={2} bottom={4} marginBottom={1} zIndex={40}>
          <box
            backgroundColor={theme.modalBg}
            border={["left"]}
            borderColor={theme.success}
            padding={1}
          >
            <text fg={theme.text} wrapMode="none">
              {toastMessage}
            </text>
          </box>
        </box>
      ) : null}

      {showBranchModal ? (
        <BranchModal
          activeView={activeListView}
          base={session.comparison.base}
          branchItems={branchItems}
          branchIndex={branchListIndex}
          commitItems={commitItems}
          commitIndex={commitListIndex}
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
      const nextView = resolveDiffView(nextPreference, terminalDimensions.width);

      if (nextPreference === "side-by-side" && nextView !== "split") {
        setStatusMessage(
          `Need at least ${MIN_SIDE_BY_SIDE_DIFF_WIDTH} columns for side-by-side diffs; showing unified.`,
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

  function openBranchModal(): void {
    setBranchListIndex(
      findInitialBranchListSelection({
        comparison: session.comparison,
        currentBranch: session.repository.currentBranch,
        items: branchItems,
      }),
    );
    setCommitListIndex(Math.max(commitItems.length - 1, 0));
    setActiveListView("branch");
    setShowListFilterModal(false);
    setShowBranchModal(true);
    setStatusMessage("Opened list modal.");
  }

  function handleBranchModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q" || key.name === "l") {
      setShowBranchModal(false);
      setShowListFilterModal(false);
      setStatusMessage("Closed list modal.");
      return;
    }

    if (key.name === "tab" || key.name === "left" || key.name === "right") {
      setActiveListView((currentView) => (currentView === "branch" ? "commit" : "branch"));
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
        setCommitListIndex((currentIndex) => clampIndex(currentIndex + 1, commitItems.length));
      }
      return;
    }

    if (key.name === "k" || key.name === "up") {
      if (activeListView === "branch") {
        setBranchListIndex((currentIndex) => clampIndex(currentIndex - 1, branchItems.length));
      } else {
        setCommitListIndex((currentIndex) => clampIndex(currentIndex - 1, commitItems.length));
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
        setCommitListIndex(Math.max(commitItems.length - 1, 0));
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

    setIsReloading(true);
    setStatusMessage(`Updating ${target} to ${branch.name}...`);

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
