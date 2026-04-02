import type { GitHubPullRequestReviewThread } from "@diffdiff/core";
import type { ColorInput } from "@opentui/core";
import { useMemo } from "react";
import { ReviewThreadList } from "../review/threads.tsx";
import type { UiTheme } from "../theme.ts";
import type {
  PreparedReviewFile,
  SideBySideDiffCell,
  SideBySideDiffRow,
  TextSegment,
  UnifiedDiffLine,
} from "../types.ts";
import { truncateSegments } from "../view-model.ts";
import {
  matchesSideBySideAnchor,
  matchesUnifiedAnchor,
  type SelectedReviewAnchor,
} from "../review-anchors.ts";
import { tintHex } from "./shared.tsx";
import {
  getUnifiedVirtualWindow,
  shouldVirtualizeUnifiedPreview,
  type PreviewViewport,
} from "./unified-diff-virtualization.ts";

const EMPTY_THREADS: readonly GitHubPullRequestReviewThread[] = [];

export function UnifiedDiffPreview({
  collapsedCommentStates,
  file,
  onToggleReviewThreadCollapsed,
  previewViewport,
  reviewThreads,
  selectedReviewAnchor,
  terminalWidth,
  theme,
}: {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  file: PreparedReviewFile;
  onToggleReviewThreadCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  previewViewport?: PreviewViewport;
  reviewThreads: readonly GitHubPullRequestReviewThread[];
  selectedReviewAnchor?: SelectedReviewAnchor;
  terminalWidth: number;
  theme: UiTheme;
}) {
  const threadIndex = useMemo(
    () => buildUnifiedThreadIndex(reviewThreads, file.unifiedLines),
    [file.unifiedLines, reviewThreads],
  );
  const visibleWindow = useMemo(() => {
    if (
      !shouldVirtualizeUnifiedPreview({
        hasSelectedReviewAnchor: selectedReviewAnchor != null,
        previewViewport,
        reviewThreadCount: reviewThreads.length,
      })
    ) {
      return undefined;
    }

    return getUnifiedVirtualWindow({ file, previewViewport: previewViewport!, terminalWidth });
  }, [file, previewViewport, reviewThreads.length, selectedReviewAnchor, terminalWidth]);
  const visibleLines =
    visibleWindow == null
      ? file.unifiedLines
      : file.unifiedLines.slice(visibleWindow.startIndex, visibleWindow.endIndex + 1);

  return (
    <box width="100%" flexDirection="column">
      {visibleWindow != null && visibleWindow.topSpacerHeight > 0 ? (
        <box width="100%" height={visibleWindow.topSpacerHeight} />
      ) : null}
      {visibleLines.map((line, index) => {
        const lineIndex = visibleWindow == null ? index : visibleWindow.startIndex + index;
        const lineThreads = getUnifiedLineThreads(threadIndex, line);

        return (
          <box key={`${line.kind}-${lineIndex}`} width="100%" flexDirection="column">
            <UnifiedDiffRow
              isSelected={matchesUnifiedAnchor(line, selectedReviewAnchor)}
              line={line}
              lineNumberWidth={file.lineNumberWidth}
              theme={theme}
            />
            <ReviewThreadList
              collapsedCommentStates={collapsedCommentStates}
              onToggleCollapsed={onToggleReviewThreadCollapsed}
              threads={lineThreads}
              theme={theme}
            />
          </box>
        );
      })}
      {visibleWindow != null && visibleWindow.bottomSpacerHeight > 0 ? (
        <box width="100%" height={visibleWindow.bottomSpacerHeight} />
      ) : null}
      <ReviewThreadList
        collapsedCommentStates={collapsedCommentStates}
        onToggleCollapsed={onToggleReviewThreadCollapsed}
        threads={threadIndex.unanchoredThreads}
        theme={theme}
      />
    </box>
  );
}

export function SideBySideDiffPreview({
  collapsedCommentStates,
  file,
  onToggleReviewThreadCollapsed,
  reviewThreads,
  selectedReviewAnchor,
  terminalWidth,
  theme,
}: {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  file: PreparedReviewFile;
  onToggleReviewThreadCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  reviewThreads: readonly GitHubPullRequestReviewThread[];
  selectedReviewAnchor?: SelectedReviewAnchor;
  terminalWidth: number;
  theme: UiTheme;
}) {
  const paneWidth = Math.max(Math.floor((Math.max(terminalWidth - 12, 40) - 1) / 2), 12);
  const contentWidth = Math.max(paneWidth - (file.lineNumberWidth + 3), 1);
  const threadIndex = useMemo(
    () => buildSideBySideThreadIndex(reviewThreads, file.sideBySideRows),
    [file.sideBySideRows, reviewThreads],
  );

  return (
    <box width="100%" flexDirection="column">
      {file.sideBySideRows.map((row, index) => {
        const rowThreads = getSideBySideRowThreads(threadIndex, row);

        return (
          <box key={`${row.kind}-${index}`} width="100%" flexDirection="column">
            <SideBySideDiffRowView
              contentWidth={contentWidth}
              isSelected={matchesSideBySideAnchor(row, selectedReviewAnchor)}
              lineNumberWidth={file.lineNumberWidth}
              paneWidth={paneWidth}
              row={row}
              theme={theme}
            />
            <ReviewThreadList
              collapsedCommentStates={collapsedCommentStates}
              onToggleCollapsed={onToggleReviewThreadCollapsed}
              threads={rowThreads}
              theme={theme}
            />
          </box>
        );
      })}
      <ReviewThreadList
        collapsedCommentStates={collapsedCommentStates}
        onToggleCollapsed={onToggleReviewThreadCollapsed}
        threads={threadIndex.unanchoredThreads}
        theme={theme}
      />
    </box>
  );
}

function buildUnifiedThreadIndex(
  threads: readonly GitHubPullRequestReviewThread[],
  lines: readonly UnifiedDiffLine[],
) {
  const leftLineNumbers = new Set<number>();
  const rightLineNumbers = new Set<number>();

  for (const line of lines) {
    if (line.kind === "hunk" || line.kind === "gap") {
      continue;
    }

    if (line.oldLineNumber != null) {
      leftLineNumbers.add(line.oldLineNumber);
    }

    if (line.newLineNumber != null) {
      rightLineNumbers.add(line.newLineNumber);
    }
  }

  const leftThreads = new Map<number, GitHubPullRequestReviewThread[]>();
  const rightThreads = new Map<number, GitHubPullRequestReviewThread[]>();
  const unanchoredThreads: GitHubPullRequestReviewThread[] = [];

  for (const thread of threads) {
    const anchorLine = thread.line ?? thread.originalLine;
    if (anchorLine == null) {
      unanchoredThreads.push(thread);
      continue;
    }

    if (thread.side === "LEFT") {
      if (!leftLineNumbers.has(anchorLine)) {
        unanchoredThreads.push(thread);
        continue;
      }

      pushThread(leftThreads, anchorLine, thread);
      continue;
    }

    if (!rightLineNumbers.has(anchorLine)) {
      unanchoredThreads.push(thread);
      continue;
    }

    pushThread(rightThreads, anchorLine, thread);
  }

  return {
    leftThreads,
    rightThreads,
    unanchoredThreads,
  };
}

function getUnifiedLineThreads(
  threadIndex: ReturnType<typeof buildUnifiedThreadIndex>,
  line: UnifiedDiffLine,
): readonly GitHubPullRequestReviewThread[] {
  if (line.kind === "hunk" || line.kind === "gap") {
    return EMPTY_THREADS;
  }

  if (line.kind === "deletion") {
    return line.oldLineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.leftThreads.get(line.oldLineNumber) ?? EMPTY_THREADS);
  }

  if (line.kind === "addition") {
    return line.newLineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.rightThreads.get(line.newLineNumber) ?? EMPTY_THREADS);
  }

  const leftThreads =
    line.oldLineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.leftThreads.get(line.oldLineNumber) ?? EMPTY_THREADS);
  const rightThreads =
    line.newLineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.rightThreads.get(line.newLineNumber) ?? EMPTY_THREADS);

  if (leftThreads.length === 0) {
    return rightThreads;
  }

  if (rightThreads.length === 0) {
    return leftThreads;
  }

  return [...leftThreads, ...rightThreads];
}

function buildSideBySideThreadIndex(
  threads: readonly GitHubPullRequestReviewThread[],
  rows: readonly SideBySideDiffRow[],
) {
  const leftLineNumbers = new Set<number>();
  const rightLineNumbers = new Set<number>();

  for (const row of rows) {
    if (row.kind !== "line") {
      continue;
    }

    if (row.left?.lineNumber != null) {
      leftLineNumbers.add(row.left.lineNumber);
    }

    if (row.right?.lineNumber != null) {
      rightLineNumbers.add(row.right.lineNumber);
    }
  }

  const leftThreads = new Map<number, GitHubPullRequestReviewThread[]>();
  const rightThreads = new Map<number, GitHubPullRequestReviewThread[]>();
  const unanchoredThreads: GitHubPullRequestReviewThread[] = [];

  for (const thread of threads) {
    const anchorLine = thread.line ?? thread.originalLine;
    if (anchorLine == null) {
      unanchoredThreads.push(thread);
      continue;
    }

    if (thread.side === "LEFT") {
      if (!leftLineNumbers.has(anchorLine)) {
        unanchoredThreads.push(thread);
        continue;
      }

      pushThread(leftThreads, anchorLine, thread);
      continue;
    }

    if (!rightLineNumbers.has(anchorLine)) {
      unanchoredThreads.push(thread);
      continue;
    }

    pushThread(rightThreads, anchorLine, thread);
  }

  return {
    leftThreads,
    rightThreads,
    unanchoredThreads,
  };
}

function getSideBySideRowThreads(
  threadIndex: ReturnType<typeof buildSideBySideThreadIndex>,
  row: SideBySideDiffRow,
): readonly GitHubPullRequestReviewThread[] {
  if (row.kind !== "line") {
    return EMPTY_THREADS;
  }

  const leftThreads =
    row.left?.lineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.leftThreads.get(row.left.lineNumber) ?? EMPTY_THREADS);
  const rightThreads =
    row.right?.lineNumber == null
      ? EMPTY_THREADS
      : (threadIndex.rightThreads.get(row.right.lineNumber) ?? EMPTY_THREADS);

  if (leftThreads.length === 0) {
    return rightThreads;
  }

  if (rightThreads.length === 0) {
    return leftThreads;
  }

  return [...leftThreads, ...rightThreads];
}

function pushThread(
  index: Map<number, GitHubPullRequestReviewThread[]>,
  lineNumber: number,
  thread: GitHubPullRequestReviewThread,
): void {
  const existingThreads = index.get(lineNumber);
  if (existingThreads == null) {
    index.set(lineNumber, [thread]);
    return;
  }

  existingThreads.push(thread);
}

function SideBySideDiffRowView({
  contentWidth,
  isSelected,
  lineNumberWidth,
  paneWidth,
  row,
  theme,
}: {
  contentWidth: number;
  isSelected: boolean;
  lineNumberWidth: number;
  paneWidth: number;
  row: SideBySideDiffRow;
  theme: UiTheme;
}) {
  if (row.kind === "hunk" || row.kind === "gap") {
    return (
      <box width="100%" backgroundColor={row.kind === "hunk" ? theme.hunkBg : theme.contextBg}>
        <text fg={row.kind === "hunk" ? theme.warning : theme.textMuted} wrapMode="none">
          {renderSegments(truncateSegments(row.segments ?? [], paneWidth * 2 + 1), theme.text)}
        </text>
      </box>
    );
  }

  const rowBackground = isSelected ? tintHex(theme.surfaceMuted, theme.accent, 0.2) : undefined;

  return (
    <box width="100%" flexDirection="row" backgroundColor={rowBackground}>
      <SideBySideDiffCellView
        cell={row.left ?? { kind: "empty", segments: [] }}
        contentWidth={contentWidth}
        isSelected={isSelected}
        lineNumberWidth={lineNumberWidth}
        paneWidth={paneWidth}
        theme={theme}
      />
      <box width={1} backgroundColor={theme.surface}>
        <text fg={theme.border}> </text>
      </box>
      <SideBySideDiffCellView
        cell={row.right ?? { kind: "empty", segments: [] }}
        contentWidth={contentWidth}
        isSelected={isSelected}
        lineNumberWidth={lineNumberWidth}
        paneWidth={paneWidth}
        theme={theme}
      />
    </box>
  );
}

function SideBySideDiffCellView({
  cell,
  contentWidth,
  isSelected,
  lineNumberWidth,
  paneWidth,
  theme,
}: {
  cell: SideBySideDiffCell;
  contentWidth: number;
  isSelected: boolean;
  lineNumberWidth: number;
  paneWidth: number;
  theme: UiTheme;
}) {
  const baseLineNumberBg =
    cell.kind === "addition"
      ? theme.additionLineNumberBg
      : cell.kind === "deletion"
        ? theme.deletionLineNumberBg
        : theme.contextBg;
  const baseContentBg =
    cell.kind === "addition"
      ? theme.additionBg
      : cell.kind === "deletion"
        ? theme.deletionBg
        : theme.contextBg;
  const lineNumberBg = isSelected
    ? tintHex(baseLineNumberBg, theme.accent, 0.24)
    : baseLineNumberBg;
  const contentBg = isSelected ? tintHex(baseContentBg, theme.accent, 0.18) : baseContentBg;
  const sign = cell.kind === "addition" ? "+" : cell.kind === "deletion" ? "-" : " ";
  const signColor =
    cell.kind === "addition"
      ? theme.success
      : cell.kind === "deletion"
        ? theme.danger
        : theme.textMuted;

  return (
    <box width={paneWidth} flexDirection="row">
      <box width={lineNumberWidth + 3} backgroundColor={lineNumberBg}>
        <text fg={theme.textMuted} wrapMode="none">
          {cell.lineNumber != null
            ? String(cell.lineNumber).padStart(lineNumberWidth, " ")
            : " ".repeat(lineNumberWidth)}
          <span fg={signColor}>{` ${sign}`}</span>
        </text>
      </box>
      <box width={contentWidth} backgroundColor={contentBg}>
        <text fg={theme.text} wrapMode="none">
          {renderSegments(truncateSegments(cell.segments, contentWidth), theme.text)}
        </text>
      </box>
    </box>
  );
}

function UnifiedDiffRow({
  isSelected,
  line,
  lineNumberWidth,
  theme,
}: {
  isSelected: boolean;
  line: UnifiedDiffLine;
  lineNumberWidth: number;
  theme: UiTheme;
}) {
  if (line.kind === "hunk" || line.kind === "gap") {
    return (
      <box width="100%" backgroundColor={line.kind === "hunk" ? theme.hunkBg : theme.contextBg}>
        <text fg={line.kind === "hunk" ? theme.warning : theme.textMuted} wrapMode="word">
          <span>{" ".repeat(lineNumberWidth + 3)}</span>
          {renderSegments(line.segments, theme.text)}
        </text>
      </box>
    );
  }

  const lineNumber = line.newLineNumber ?? line.oldLineNumber;
  const sign = line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
  const baseLineNumberBg =
    line.kind === "addition"
      ? theme.additionLineNumberBg
      : line.kind === "deletion"
        ? theme.deletionLineNumberBg
        : theme.contextBg;
  const baseContentBg =
    line.kind === "addition"
      ? theme.additionBg
      : line.kind === "deletion"
        ? theme.deletionBg
        : theme.contextBg;
  const lineNumberBg = isSelected
    ? tintHex(baseLineNumberBg, theme.accent, 0.24)
    : baseLineNumberBg;
  const contentBg = isSelected ? tintHex(baseContentBg, theme.accent, 0.18) : baseContentBg;
  const signColor =
    line.kind === "addition"
      ? theme.success
      : line.kind === "deletion"
        ? theme.danger
        : theme.textMuted;

  return (
    <box width="100%" flexDirection="row">
      <box width={lineNumberWidth + 3} backgroundColor={lineNumberBg}>
        <text fg={theme.textMuted} wrapMode="none">
          {lineNumber != null
            ? String(lineNumber).padStart(lineNumberWidth, " ")
            : " ".repeat(lineNumberWidth)}
          <span fg={signColor}>{` ${sign}`}</span>
        </text>
      </box>
      <box flexGrow={1} backgroundColor={contentBg}>
        <text fg={theme.text} wrapMode="word">
          {renderSegments(line.segments, theme.text)}
        </text>
      </box>
    </box>
  );
}

function renderSegments(segments: readonly TextSegment[], defaultFg: ColorInput) {
  return segments.map((segment, index) => (
    <span key={index} fg={segment.fg ?? defaultFg} bg={segment.bg}>
      {segment.text}
    </span>
  ));
}
