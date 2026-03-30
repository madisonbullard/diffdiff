import type { BranchInfo, StartupOptions } from "@diffdiff/core";
import type { SyntaxStyle } from "@opentui/core";
import { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BranchModal, FileCard, HelpModal, type BranchColumn } from "./components.tsx";
import type { UiTheme } from "./theme.ts";
import type { DiffViewPreference, PreparedReviewSession } from "./types.ts";
import {
  clampIndex,
  estimateFileRows,
  getDiffViewLabel,
  getVisibleRemoteBranches,
  MIN_SIDE_BY_SIDE_DIFF_WIDTH,
  resolveDiffView,
} from "./view-model.ts";

interface DiffdiffAppProps {
  initialSession: PreparedReviewSession;
  initialOptions: StartupOptions;
  loadSession: (options: StartupOptions) => Promise<PreparedReviewSession>;
  onExit: () => void;
  syntaxStyle: SyntaxStyle;
  theme: UiTheme;
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
  const [startupOptions, setStartupOptions] = useState<StartupOptions>({
    ...initialOptions,
    base: initialSession.comparison.base,
    head: initialSession.comparison.head,
  });
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(new Set());
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string>("Ready.");
  const [showHelp, setShowHelp] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showAllRemoteBranches, setShowAllRemoteBranches] = useState(false);
  const [activeBranchColumn, setActiveBranchColumn] = useState<BranchColumn>("local");
  const [localBranchIndex, setLocalBranchIndex] = useState(0);
  const [remoteBranchIndex, setRemoteBranchIndex] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [diffViewPreference, setDiffViewPreference] = useState<DiffViewPreference>("unified");
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const terminalDimensions = useTerminalDimensions();
  const diffView = useMemo(
    () => resolveDiffView(diffViewPreference, terminalDimensions.width),
    [diffViewPreference, terminalDimensions.width],
  );
  const diffViewLabel = useMemo(() => getDiffViewLabel(diffView), [diffView]);

  const visibleRemoteBranches = useMemo(() => {
    return getVisibleRemoteBranches(
      session.branches.remote,
      session.comparison,
      showAllRemoteBranches,
    );
  }, [session.branches.remote, session.comparison, showAllRemoteBranches]);

  const selectedLocalBranch =
    session.branches.local[clampIndex(localBranchIndex, session.branches.local.length)];
  const selectedRemoteBranch =
    visibleRemoteBranches[clampIndex(remoteBranchIndex, visibleRemoteBranches.length)];
  const selectedBranch =
    activeBranchColumn === "local" ? selectedLocalBranch : selectedRemoteBranch;

  const fileOffsets = useMemo(() => {
    const offsets: number[] = [];
    let runningTotal = 0;

    for (const file of session.files) {
      offsets.push(runningTotal);
      runningTotal += estimateFileRows(file, collapsedPaths.has(file.path));
    }

    return offsets;
  }, [collapsedPaths, session.files]);

  useEffect(() => {
    setSelectedFileIndex((currentIndex) => clampIndex(currentIndex, session.files.length));
  }, [session.files.length]);

  useEffect(() => {
    setLocalBranchIndex((currentIndex) => clampIndex(currentIndex, session.branches.local.length));
  }, [session.branches.local.length]);

  useEffect(() => {
    setRemoteBranchIndex((currentIndex) => clampIndex(currentIndex, visibleRemoteBranches.length));
  }, [visibleRemoteBranches.length]);

  useEffect(() => {
    const offset = fileOffsets[selectedFileIndex];
    if (offset == null) {
      return;
    }

    scrollRef.current?.scrollTo({ x: 0, y: offset });
  }, [fileOffsets, selectedFileIndex]);

  useKeyboard((key) => {
    if (showHelp) {
      if (key.name === "escape" || key.name === "q" || key.sequence === "?") {
        setShowHelp(false);
      }
      return;
    }

    if (showBranchModal) {
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
  });

  const selectedFile = session.files[selectedFileIndex];
  const comparisonModeLabel =
    session.comparison.mode === "working-tree" ? "working tree" : "branch range";
  const currentBranchLabel = session.repository.currentBranch ?? "detached";

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.appBackground}>
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

      <scrollbox
        ref={scrollRef}
        width="100%"
        flexGrow={1}
        focused
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
          <span>{" branches  "}</span>
          <span fg={theme.text} bg={theme.surfaceMuted}>
            {" "}
            ?{" "}
          </span>
          <span>{" help"}</span>
        </text>
      </box>

      {showBranchModal ? (
        <BranchModal
          activeColumn={activeBranchColumn}
          base={session.comparison.base}
          head={session.comparison.head}
          localBranches={session.branches.local}
          localIndex={localBranchIndex}
          remoteBranches={visibleRemoteBranches}
          remoteIndex={remoteBranchIndex}
          remoteTotalCount={session.branches.remote.length}
          showAllRemoteBranches={showAllRemoteBranches}
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
    const localSelection = session.branches.local.findIndex(
      (branch) => branch.name === session.comparison.head || branch.isCurrent,
    );
    const remoteSelection = visibleRemoteBranches.findIndex(
      (branch) =>
        branch.name === session.comparison.base || branch.name === session.comparison.head,
    );

    if (localSelection >= 0) {
      setLocalBranchIndex(localSelection);
    }

    if (remoteSelection >= 0) {
      setRemoteBranchIndex(remoteSelection);
    }

    setActiveBranchColumn(remoteSelection >= 0 ? "remote" : "local");
    setShowBranchModal(true);
    setStatusMessage("Opened branch list.");
  }

  function handleBranchModalKey(key: { name: string; sequence?: string; shift?: boolean }): void {
    if (key.name === "escape" || key.name === "q" || key.name === "l") {
      setShowBranchModal(false);
      setStatusMessage("Closed branch list.");
      return;
    }

    if (key.name === "tab" || key.name === "left" || key.name === "right") {
      setActiveBranchColumn((currentColumn) => (currentColumn === "local" ? "remote" : "local"));
      return;
    }

    if (key.name === "o") {
      setShowAllRemoteBranches((currentValue) => {
        const nextValue = !currentValue;
        setStatusMessage(
          nextValue ? "Showing all remote branches." : "Showing focused remote branches.",
        );
        return nextValue;
      });
      return;
    }

    if (key.name === "j" || key.name === "down") {
      if (activeBranchColumn === "local") {
        setLocalBranchIndex((currentIndex) =>
          clampIndex(currentIndex + 1, session.branches.local.length),
        );
      } else {
        setRemoteBranchIndex((currentIndex) =>
          clampIndex(currentIndex + 1, visibleRemoteBranches.length),
        );
      }
      return;
    }

    if (key.name === "k" || key.name === "up") {
      if (activeBranchColumn === "local") {
        setLocalBranchIndex((currentIndex) =>
          clampIndex(currentIndex - 1, session.branches.local.length),
        );
      } else {
        setRemoteBranchIndex((currentIndex) =>
          clampIndex(currentIndex - 1, visibleRemoteBranches.length),
        );
      }
      return;
    }

    if (key.name === "g" && !key.shift) {
      if (activeBranchColumn === "local") {
        setLocalBranchIndex(0);
      } else {
        setRemoteBranchIndex(0);
      }
      return;
    }

    if (key.name === "g" && key.shift) {
      if (activeBranchColumn === "local") {
        setLocalBranchIndex(Math.max(session.branches.local.length - 1, 0));
      } else {
        setRemoteBranchIndex(Math.max(visibleRemoteBranches.length - 1, 0));
      }
      return;
    }

    if (key.name === "return" || key.name === "b") {
      if (selectedBranch != null) {
        void applyBranchSelection("base", selectedBranch);
      }
      return;
    }

    if (key.name === "h") {
      if (selectedBranch != null) {
        void applyBranchSelection("head", selectedBranch);
      }
    }
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
      setSelectedFileIndex(0);
      setStatusMessage(`Updated ${target} to ${branch.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to update ${target}.`;
      setStatusMessage(message);
    } finally {
      setIsReloading(false);
    }
  }
}
