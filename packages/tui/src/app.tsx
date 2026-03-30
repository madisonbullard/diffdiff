import type { BranchInfo, StartupOptions } from "@diffdiff/core";
import { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BranchModal, FileCard, HelpModal, type BranchColumn } from "./components.tsx";
import { getUiTheme } from "./theme.ts";
import type { PreparedReviewSession } from "./types.ts";
import { clampIndex, estimateFileRows, getVisibleRemoteBranches } from "./view-model.ts";

interface DiffdiffAppProps {
  initialSession: PreparedReviewSession;
  initialOptions: StartupOptions;
  loadSession: (options: StartupOptions) => Promise<PreparedReviewSession>;
  onExit: () => void;
}

export function DiffdiffApp({
  initialSession,
  initialOptions,
  loadSession,
  onExit,
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
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const uiTheme = getUiTheme(session.themeName);

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
      setShowBranchModal(true);
      setStatusMessage("Opened branch list.");
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
  });

  const selectedFile = session.files[selectedFileIndex];
  const comparisonModeLabel =
    session.comparison.mode === "working-tree" ? "working tree" : "branch range";

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={uiTheme.appBackground}>
      <box
        flexShrink={0}
        width="100%"
        border
        borderStyle="single"
        borderColor={uiTheme.border}
        backgroundColor={uiTheme.chromeBackground}
        paddingX={1}
        paddingY={0}
        flexDirection="column"
      >
        <text fg={uiTheme.text} wrapMode="none">
          <span fg={uiTheme.accent}>{session.repository.name}</span>
          <span fg={uiTheme.text}> </span>
          <span fg={uiTheme.chromeBackground} bg={uiTheme.accent}>
            {` ${comparisonModeLabel} `}
          </span>
          <span fg={uiTheme.textMuted}>
            {" "}
            {session.comparison.base}...{session.comparison.head}
          </span>
          <span fg={uiTheme.text}> </span>
          <span
            fg={uiTheme.text}
            bg={uiTheme.surfaceMuted}
          >{` ${session.files.length} files `}</span>
          <span fg={uiTheme.text}> </span>
          <span
            fg={uiTheme.text}
            bg={uiTheme.surfaceMuted}
          >{` ${reviewedPaths.size} reviewed `}</span>
        </text>
        <text fg={uiTheme.textMuted} wrapMode="none">
          {session.repository.rootPath}
        </text>
        {session.warnings[0] != null ? (
          <text fg={uiTheme.warning} wrapMode="none">
            {session.warnings[0].message}
          </text>
        ) : null}
      </box>

      <scrollbox
        ref={scrollRef}
        width="100%"
        flexGrow={1}
        focused
        viewportOptions={{ backgroundColor: uiTheme.appBackground }}
        contentOptions={{ backgroundColor: uiTheme.appBackground }}
        verticalScrollbarOptions={{ trackOptions: { backgroundColor: uiTheme.border } }}
      >
        <box width="100%" flexDirection="column" paddingX={1} paddingY={1} gap={1}>
          {session.files.length === 0 ? (
            <box
              border
              borderStyle="single"
              borderColor={uiTheme.border}
              backgroundColor={uiTheme.surface}
              padding={2}
            >
              <text fg={uiTheme.text}>No changed files found for this comparison.</text>
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
                isCollapsed={isCollapsed}
                isReviewed={isReviewed}
                isSelected={isSelected}
                theme={uiTheme}
              />
            );
          })}
        </box>
      </scrollbox>

      <box
        flexShrink={0}
        width="100%"
        border
        borderStyle="single"
        borderColor={uiTheme.border}
        backgroundColor={uiTheme.chromeBackground}
        paddingX={1}
        paddingY={0}
        flexDirection="column"
      >
        <text fg={uiTheme.textMuted} wrapMode="none">
          <span fg={uiTheme.text} bg={uiTheme.surfaceMuted}>
            {" "}
            q{" "}
          </span>
          <span>{" quit  "}</span>
          <span fg={uiTheme.text} bg={uiTheme.surfaceMuted}>
            {" "}
            j/k{" "}
          </span>
          <span>{" move  "}</span>
          <span fg={uiTheme.text} bg={uiTheme.surfaceMuted}>
            {" "}
            r{" "}
          </span>
          <span>{" reviewed  "}</span>
          <span fg={uiTheme.text} bg={uiTheme.surfaceMuted}>
            {" "}
            c{" "}
          </span>
          <span>{" collapse  "}</span>
          <span fg={uiTheme.text} bg={uiTheme.surfaceMuted}>
            {" "}
            m{" "}
          </span>
          <span>{" review+next  "}</span>
          <span fg={uiTheme.text} bg={uiTheme.surfaceMuted}>
            {" "}
            l{" "}
          </span>
          <span>{" branches  "}</span>
          <span fg={uiTheme.text} bg={uiTheme.surfaceMuted}>
            {" "}
            ?{" "}
          </span>
          <span>{" help"}</span>
        </text>
        <text fg={isReloading ? uiTheme.accent : uiTheme.text} wrapMode="none">
          <span>{isReloading ? "Loading comparison..." : statusMessage}</span>
          {selectedFile != null ? (
            <span fg={uiTheme.textMuted}>{`  •  selected ${selectedFile.path}`}</span>
          ) : null}
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
          showAllRemoteBranches={showAllRemoteBranches}
          theme={uiTheme}
        />
      ) : null}

      {showHelp ? <HelpModal theme={uiTheme} /> : null}
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
      setShowAllRemoteBranches((currentValue) => !currentValue);
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
