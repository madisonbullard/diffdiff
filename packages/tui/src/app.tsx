import type { BranchInfo, StartupOptions } from "@diffdiff/core";
import { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { getUiTheme } from "./theme.ts";
import type { PreparedReviewFile, PreparedReviewSession } from "./types.ts";
import {
  clampIndex,
  estimateFileRows,
  getVisibleRemoteBranches,
  truncateSegments,
} from "./view-model.ts";

interface DiffdiffAppProps {
  initialSession: PreparedReviewSession;
  initialOptions: StartupOptions;
  loadSession: (options: StartupOptions) => Promise<PreparedReviewSession>;
  onExit: () => void;
}

type BranchColumn = "local" | "remote";

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
  const { width } = useTerminalDimensions();
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
  const contentWidth = Math.max(width - 12, 32);

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={uiTheme.appBackground}>
      <box
        width="100%"
        border
        bottom={undefined}
        borderStyle="single"
        borderColor={uiTheme.border}
        backgroundColor={uiTheme.chromeBackground}
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <text fg={uiTheme.text}>
          <span fg={uiTheme.accent}>{session.repository.name}</span>
          <span fg={uiTheme.textMuted}>
            {" "}
            {session.comparison.base}...{session.comparison.head}
          </span>
          <span fg={uiTheme.textMuted}> {session.files.length} files</span>
          <span fg={uiTheme.textMuted}> {reviewedPaths.size} reviewed</span>
        </text>
        <text fg={uiTheme.textMuted}>{session.repository.rootPath}</text>
        {session.warnings[0] != null ? (
          <text fg={uiTheme.warning}>{session.warnings[0].message}</text>
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
                index={index}
                contentWidth={contentWidth}
                isCollapsed={isCollapsed}
                isReviewed={isReviewed}
                isSelected={isSelected}
                theme={uiTheme}
                comparisonBase={session.comparison.base}
                comparisonHead={session.comparison.head}
              />
            );
          })}
        </box>
      </scrollbox>

      <box
        width="100%"
        border
        borderStyle="single"
        borderColor={uiTheme.border}
        backgroundColor={uiTheme.chromeBackground}
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <text fg={uiTheme.textMuted}>
          q quit j/k next-prev r reviewed c collapse m reviewed+next l branches ? help
        </text>
        <text fg={isReloading ? uiTheme.accent : uiTheme.text}>
          {isReloading ? "Loading comparison..." : statusMessage}
        </text>
        {selectedFile != null ? (
          <text fg={uiTheme.textMuted}>Selected: {selectedFile.path}</text>
        ) : null}
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

interface FileCardProps {
  file: PreparedReviewFile;
  index: number;
  contentWidth: number;
  isCollapsed: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  theme: ReturnType<typeof getUiTheme>;
  comparisonBase: string;
  comparisonHead: string;
}

function FileCard({
  file,
  contentWidth,
  isCollapsed,
  isReviewed,
  isSelected,
  theme,
}: FileCardProps) {
  const borderColor = isSelected ? theme.borderActive : theme.border;
  const headerBackground = isReviewed ? theme.reviewedBg : theme.surfaceMuted;
  const statusLabel = file.status === "modified" ? "Changed" : capitalize(file.status);
  const statusColor =
    file.status === "added"
      ? theme.success
      : file.status === "deleted"
        ? theme.danger
        : file.status === "renamed"
          ? theme.warning
          : theme.accent;

  return (
    <box
      width="100%"
      border
      borderStyle="single"
      borderColor={borderColor}
      backgroundColor={theme.surface}
      flexDirection="column"
    >
      <box
        width="100%"
        backgroundColor={headerBackground}
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <text fg={theme.text}>
          <span fg={isSelected ? theme.accent : theme.text}>{file.path}</span>
          <span fg={theme.textMuted}>
            {" "}
            {file.additions}+ / {file.deletions}-
          </span>
          <span fg={statusColor}> [{statusLabel}]</span>
          {isReviewed ? <span fg={theme.success}> [Reviewed]</span> : null}
          {isCollapsed ? <span fg={theme.warning}> [Collapsed]</span> : null}
        </text>
        {file.previousPath != null ? (
          <text fg={theme.textMuted}>renamed from {file.previousPath}</text>
        ) : null}
        <text fg={theme.textMuted}>
          {file.isBinary ? "Binary diff" : "GitHub-style unified diff"}
        </text>
      </box>

      {!isCollapsed ? (
        <box width="100%" flexDirection="column" paddingX={1} paddingY={1}>
          {file.isBinary ? (
            <text fg={theme.textMuted}>
              Binary file changed. Content preview is not available yet.
            </text>
          ) : null}
          {!file.isBinary && file.renderError != null ? (
            <text fg={theme.warning}>{file.renderError}</text>
          ) : null}
          {!file.isBinary && file.renderError == null && file.unifiedLines.length === 0 ? (
            <text fg={theme.textMuted}>No textual diff available for this file.</text>
          ) : null}
          {!file.isBinary && file.renderError == null
            ? file.unifiedLines.map((line, index) => (
                <DiffLineView
                  key={`${file.path}-${index}`}
                  line={line}
                  lineNumberWidth={file.lineNumberWidth}
                  maxWidth={contentWidth}
                  theme={theme}
                />
              ))
            : null}
        </box>
      ) : null}
    </box>
  );
}

function DiffLineView({
  line,
  lineNumberWidth,
  maxWidth,
  theme,
}: {
  line: PreparedReviewFile["unifiedLines"][number];
  lineNumberWidth: number;
  maxWidth: number;
  theme: ReturnType<typeof getUiTheme>;
}) {
  const prefix =
    line.kind === "addition"
      ? "+"
      : line.kind === "deletion"
        ? "-"
        : line.kind === "hunk"
          ? "@"
          : line.kind === "gap"
            ? "~"
            : " ";
  const backgroundColor =
    line.kind === "addition"
      ? theme.additionBg
      : line.kind === "deletion"
        ? theme.deletionBg
        : line.kind === "hunk" || line.kind === "gap"
          ? theme.hunkBg
          : theme.contextBg;
  const lineNumberFg = line.kind === "hunk" || line.kind === "gap" ? theme.accent : theme.textMuted;
  const contentMaxWidth = Math.max(maxWidth - lineNumberWidth * 2 - 8, 8);
  const segments = truncateSegments(line.segments, contentMaxWidth);

  return (
    <text fg={theme.text} bg={backgroundColor}>
      <span fg={lineNumberFg}>{formatLineNumber(line.oldLineNumber, lineNumberWidth)}</span>
      <span fg={lineNumberFg}> </span>
      <span fg={lineNumberFg}>{formatLineNumber(line.newLineNumber, lineNumberWidth)}</span>
      <span
        fg={
          line.kind === "addition"
            ? theme.success
            : line.kind === "deletion"
              ? theme.danger
              : line.kind === "hunk"
                ? theme.accent
                : theme.textMuted
        }
      >
        {` ${prefix} `}
      </span>
      {segments.length === 0 ? <span>{line.kind === "gap" ? "" : " "}</span> : null}
      {segments.map((segment, index) => (
        <Fragment key={index}>
          <span fg={segment.fg} bg={segment.bg}>
            {segment.text}
          </span>
        </Fragment>
      ))}
    </text>
  );
}

function BranchModal({
  activeColumn,
  base,
  head,
  localBranches,
  localIndex,
  remoteBranches,
  remoteIndex,
  showAllRemoteBranches,
  theme,
}: {
  activeColumn: BranchColumn;
  base: string;
  head: string;
  localBranches: readonly BranchInfo[];
  localIndex: number;
  remoteBranches: readonly BranchInfo[];
  remoteIndex: number;
  showAllRemoteBranches: boolean;
  theme: ReturnType<typeof getUiTheme>;
}) {
  return (
    <box
      position="absolute"
      top={2}
      right={4}
      bottom={2}
      left={4}
      alignItems="center"
      justifyContent="center"
      zIndex={20}
    >
      <box
        width="92%"
        maxWidth={140}
        border
        borderStyle="single"
        borderColor={theme.borderActive}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <text fg={theme.text}>Branch List</text>
        <text fg={theme.textMuted}>
          tab switch columns b set base h set head o toggle hidden remotes esc close
        </text>
        <box width="100%" flexDirection="row" gap={1}>
          <BranchColumnView
            title="Local branches"
            branches={localBranches}
            selectedIndex={localIndex}
            isActive={activeColumn === "local"}
            base={base}
            head={head}
            theme={theme}
          />
          <BranchColumnView
            title={showAllRemoteBranches ? "Remote branches" : "Remote branches (open PRs)"}
            branches={remoteBranches}
            selectedIndex={remoteIndex}
            isActive={activeColumn === "remote"}
            base={base}
            head={head}
            theme={theme}
          />
        </box>
      </box>
    </box>
  );
}

function BranchColumnView({
  title,
  branches,
  selectedIndex,
  isActive,
  base,
  head,
  theme,
}: {
  title: string;
  branches: readonly BranchInfo[];
  selectedIndex: number;
  isActive: boolean;
  base: string;
  head: string;
  theme: ReturnType<typeof getUiTheme>;
}) {
  return (
    <box
      width="50%"
      border
      borderStyle="single"
      borderColor={isActive ? theme.borderActive : theme.border}
      backgroundColor={theme.surface}
      padding={1}
      flexDirection="column"
    >
      <text fg={isActive ? theme.accent : theme.text}>{title}</text>
      {branches.length === 0 ? <text fg={theme.textMuted}>Nothing to show.</text> : null}
      {branches.map((branch, index) => {
        const isSelected = index === selectedIndex;
        const fg = isSelected ? theme.accent : theme.text;

        return (
          <text key={branch.ref} fg={fg} bg={isSelected ? theme.surfaceMuted : undefined}>
            <span fg={fg}>{branch.name}</span>
            {branch.pullRequest != null ? <span fg={theme.success}> [Open]</span> : null}
            {branch.name === base ? <span fg={theme.warning}> [Base]</span> : null}
            {branch.name === head ? <span fg={theme.accent}> [Head]</span> : null}
            {branch.isCurrent ? <span fg={theme.textMuted}> [Current]</span> : null}
          </text>
        );
      })}
    </box>
  );
}

function HelpModal({ theme }: { theme: ReturnType<typeof getUiTheme> }) {
  return (
    <box
      position="absolute"
      top={4}
      right={10}
      left={10}
      zIndex={30}
      alignItems="center"
      justifyContent="center"
    >
      <box
        width="80%"
        border
        borderStyle="single"
        borderColor={theme.borderActive}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <text fg={theme.text}>Keybinds</text>
        <text fg={theme.textMuted}>
          q quit l branches ? help j/k or n/p next-prev file g/G first-last file
        </text>
        <text fg={theme.textMuted}>
          r toggle reviewed c or enter collapse m review + collapse + next
        </text>
        <text fg={theme.textMuted}>
          In the branch modal: tab switch columns, b set base, h set head, o toggle hidden remote
          branches.
        </text>
      </box>
    </box>
  );
}

function formatLineNumber(lineNumber: number | undefined, width: number): string {
  return lineNumber == null ? " ".repeat(width) : String(lineNumber).padStart(width, " ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
