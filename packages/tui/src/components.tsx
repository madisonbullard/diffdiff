import type { BranchInfo, GitHubPullRequestReviewThread } from "@diffdiff/core";
import { logDiffdiffWarn } from "@diffdiff/core";
import type { BoxRenderable, ColorInput, SyntaxStyle } from "@opentui/core";
import { useEffect, useRef } from "react";
import type { ReactNode, Ref } from "react";
import {
  getThreadsForSideBySideRow,
  getThreadsForUnifiedLine,
  getUnanchoredSideBySideThreads,
  getUnanchoredUnifiedThreads,
  ReviewThreadList,
} from "./github-review.tsx";
import { getDiffFiletype } from "./language.ts";
import type { UiTheme } from "./theme.ts";
import type {
  AppPane,
  BranchListFilters,
  BranchListItem,
  CommitListItem,
  DiffView,
  FileTreeNode,
  ListModalView,
  PreparedReviewFile,
  SideBySideDiffCell,
  SideBySideDiffRow,
  TextSegment,
  UnifiedDiffLine,
} from "./types.ts";
import {
  matchesSideBySideAnchor,
  matchesUnifiedAnchor,
  type SelectedReviewAnchor,
} from "./review-anchors.ts";
import {
  formatCommitListEntry,
  formatAuthorList,
  formatChangeSummary,
  formatCommitDelta,
  truncateSegments,
} from "./view-model.ts";
import { formatCommandKeybind, type CommandDefinition } from "./commands.ts";

const SPLIT_BORDER = {
  topLeft: "",
  bottomLeft: "",
  vertical: "┃",
  topRight: "",
  bottomRight: "",
  horizontal: " ",
  bottomT: "",
  topT: "",
  cross: "",
  leftT: "",
  rightT: "",
} as const;

const MODAL_OVERLAY = "#00000096";

export interface FileCardProps {
  file: PreparedReviewFile;
  diffView: DiffView;
  headerVariant?: "sticky-compact";
  isCollapsed: boolean;
  removeTopPadding?: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  reviewThreads?: readonly GitHubPullRequestReviewThread[];
  rootRef?: Ref<BoxRenderable>;
  selectedReviewAnchor?: SelectedReviewAnchor;
  showOutdatedReviewThreads?: boolean;
  syntaxStyle: SyntaxStyle;
  terminalWidth: number;
  theme: UiTheme;
}

export interface FileTreeSidebarProps {
  activePane: AppPane;
  collapsedDirectories: ReadonlySet<string>;
  collapsedPaths: ReadonlySet<string>;
  nodes: readonly FileTreeNode[];
  onNodeMouseUp: (node: FileTreeNode) => void;
  onRowRef?: (index: number, node: BoxRenderable | null) => void;
  reviewedPaths: ReadonlySet<string>;
  selectedFilePath?: string;
  selectedPath?: string;
  theme: UiTheme;
}

export function FileCard({
  file,
  diffView,
  headerVariant,
  isCollapsed,
  removeTopPadding = false,
  isReviewed,
  isSelected,
  reviewThreads = [],
  rootRef,
  selectedReviewAnchor,
  showOutdatedReviewThreads = false,
  syntaxStyle,
  terminalWidth,
  theme,
}: FileCardProps) {
  const filetype = getDiffFiletype(file.path);
  const { statusColor, statusLabel } = getFileStatusChrome(file.status, theme);
  const { borderColor, fileBackground } = getFileCardChrome(isSelected, isReviewed, theme);
  const usesCompactHeader = headerVariant === "sticky-compact";

  const usesFallbackRenderer =
    !file.isBinary &&
    file.renderError == null &&
    file.patch.trim() !== "" &&
    ((diffView === "unified" && file.unifiedLines.length === 0) ||
      (diffView === "split" && file.sideBySideRows.length === 0));
  const loggedFallbackRef = useRef(false);

  useEffect(() => {
    if (usesFallbackRenderer && !loggedFallbackRef.current) {
      loggedFallbackRef.current = true;
      logDiffdiffWarn("render", "diff_fallback_renderer_used", {
        diffView,
        path: file.path,
      });
    }

    if (!usesFallbackRenderer) {
      loggedFallbackRef.current = false;
    }
  }, [diffView, file.path, usesFallbackRenderer]);

  return (
    <box
      ref={rootRef}
      width="100%"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={borderColor}
      backgroundColor={fileBackground}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={0}
      paddingTop={removeTopPadding ? 0 : 1}
      paddingBottom={isCollapsed ? 0 : 1}
      gap={1}
    >
      {usesCompactHeader ? (
        <FileCardStatusRow
          isReviewed={isReviewed}
          statusColor={statusColor}
          statusLabel={statusLabel}
          theme={theme}
        />
      ) : (
        <>
          <FileCardTitleRow
            file={file}
            isCollapsed={isCollapsed}
            isSelected={isSelected}
            theme={theme}
          />

          <FileCardStatusTags
            isReviewed={isReviewed}
            statusColor={statusColor}
            statusLabel={statusLabel}
            theme={theme}
          />
        </>
      )}

      {file.previousPath != null ? (
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.warning}>rename</span>
          <span> </span>
          <span>{file.previousPath}</span>
          <span fg={theme.warning}>{" \u2192 "}</span>
          <span>{file.path}</span>
        </text>
      ) : null}

      {!isCollapsed ? (
        <box width="100%" flexDirection="column">
          {file.isBinary ? (
            <box paddingLeft={1}>
              <text fg={theme.textMuted}>
                Binary file changed. Content preview is not available yet.
              </text>
            </box>
          ) : null}
          {!file.isBinary && file.renderError != null ? (
            <box paddingLeft={1}>
              <text fg={theme.warning}>{file.renderError}</text>
            </box>
          ) : null}
          {!file.isBinary && file.renderError == null && file.patch.trim() === "" ? (
            <box paddingLeft={1}>
              <text fg={theme.textMuted}>No textual diff available for this file.</text>
            </box>
          ) : null}
          {!file.isBinary && file.renderError == null && file.patch.trim() !== "" ? (
            <box width="100%">
              {diffView === "unified" && file.unifiedLines.length > 0 ? (
                <UnifiedDiffPreview
                  file={file}
                  reviewThreads={reviewThreads}
                  selectedReviewAnchor={selectedReviewAnchor}
                  showOutdatedReviewThreads={showOutdatedReviewThreads}
                  theme={theme}
                />
              ) : diffView === "split" && file.sideBySideRows.length > 0 ? (
                <SideBySideDiffPreview
                  file={file}
                  reviewThreads={reviewThreads}
                  selectedReviewAnchor={selectedReviewAnchor}
                  showOutdatedReviewThreads={showOutdatedReviewThreads}
                  terminalWidth={terminalWidth}
                  theme={theme}
                />
              ) : (
                <box width="100%" flexDirection="column" gap={1}>
                  <diff
                    diff={file.patch}
                    view={diffView}
                    filetype={filetype}
                    showLineNumbers={true}
                    syntaxStyle={syntaxStyle}
                    width="100%"
                    wrapMode="word"
                    fg={theme.text}
                    addedBg={theme.additionBg}
                    removedBg={theme.deletionBg}
                    contextBg={theme.contextBg}
                    addedSignColor={theme.success}
                    removedSignColor={theme.danger}
                    lineNumberFg={theme.textMuted}
                    lineNumberBg={theme.contextBg}
                    addedLineNumberBg={theme.additionLineNumberBg}
                    removedLineNumberBg={theme.deletionLineNumberBg}
                  />
                  <ReviewThreadList
                    threads={reviewThreads.filter(
                      (thread) => showOutdatedReviewThreads || !thread.isOutdated,
                    )}
                    theme={theme}
                  />
                </box>
              )}
            </box>
          ) : null}
        </box>
      ) : null}
    </box>
  );
}

export function StickyFileHeader({
  file,
  isCollapsed,
  isReviewed,
  isSelected,
  theme,
}: {
  file: PreparedReviewFile;
  isCollapsed: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  theme: UiTheme;
}) {
  const { borderColor, fileBackground } = getFileCardChrome(isSelected, isReviewed, theme);

  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={borderColor}
      backgroundColor={fileBackground}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={0}
      paddingTop={1}
      paddingBottom={1}
      zIndex={10}
    >
      <box width="100%" paddingRight={1}>
        <FileCardTitleRow
          file={file}
          isCollapsed={isCollapsed}
          isSelected={isSelected}
          theme={theme}
        />
      </box>
    </box>
  );
}

export function FileTreeSidebar({
  activePane,
  collapsedDirectories,
  collapsedPaths,
  nodes,
  onNodeMouseUp,
  onRowRef,
  reviewedPaths,
  selectedFilePath,
  selectedPath,
  theme,
}: FileTreeSidebarProps) {
  if (nodes.length === 0) {
    return (
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={activePane === "tree" ? theme.borderActive : theme.border}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={theme.textMuted}>No files in this comparison.</text>
      </box>
    );
  }

  return (
    <box width="100%" flexDirection="column" gap={0}>
      {nodes.map((node, index) => {
        const isSelected = node.path === selectedPath;
        const isCurrentFile = node.kind === "file" && node.path === selectedFilePath;
        const isReviewed = node.kind === "file" && reviewedPaths.has(node.path);
        const isFileCollapsed = node.kind === "file" && collapsedPaths.has(node.path);
        const isDirectoryCollapsed =
          node.kind === "directory" && collapsedDirectories.has(node.path);
        const accent =
          node.kind === "directory"
            ? theme.warning
            : node.status === "added"
              ? theme.success
              : node.status === "deleted"
                ? theme.danger
                : node.status === "renamed"
                  ? theme.warning
                  : theme.accent;
        const borderColor = isSelected
          ? theme.borderActive
          : isCurrentFile
            ? theme.accent
            : isReviewed
              ? theme.success
              : theme.border;
        const backgroundColor = isSelected
          ? tintHex(theme.surface, accent, 0.24)
          : isCurrentFile
            ? tintHex(theme.surface, theme.accent, 0.14)
            : isReviewed
              ? theme.reviewedBg
              : theme.surface;
        const labelColor = isSelected || isCurrentFile ? theme.text : theme.textMuted;
        const prefix =
          node.kind === "directory"
            ? `${"  ".repeat(node.depth)}${isDirectoryCollapsed ? ">" : "v"} `
            : `${"  ".repeat(node.depth)}${getFileTreeStatusGlyph(node.status)} `;

        return (
          <box
            key={node.path}
            ref={(renderable) => {
              onRowRef?.(index, renderable);
            }}
            width="100%"
            border={["left"]}
            customBorderChars={SPLIT_BORDER}
            borderColor={borderColor}
            backgroundColor={backgroundColor}
            paddingLeft={1}
            paddingRight={1}
            paddingTop={0}
            paddingBottom={0}
            onMouseUp={() => {
              onNodeMouseUp(node);
            }}
          >
            <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
              <text fg={labelColor} wrapMode="none">
                <span fg={node.kind === "directory" ? theme.warning : accent}>{prefix}</span>
                <span fg={isSelected ? theme.text : isCurrentFile ? theme.accent : labelColor}>
                  {node.name}
                </span>
              </text>
              <text fg={theme.textMuted} wrapMode="none">
                {node.kind === "directory" ? (
                  <span>{`${node.fileCount}`}</span>
                ) : (
                  <>
                    {isReviewed ? <span fg={theme.success}>{"\u2713 "}</span> : null}
                    {isFileCollapsed ? <span fg={theme.textMuted}>{"\u2212 "}</span> : null}
                    <span fg={theme.success}>{`+${node.additions}`}</span>
                    <span fg={theme.border}> </span>
                    <span fg={theme.danger}>{`-${node.deletions}`}</span>
                  </>
                )}
              </text>
            </box>
          </box>
        );
      })}
    </box>
  );
}

function FileCardTitleRow({
  file,
  isCollapsed,
  isSelected,
  theme,
}: {
  file: PreparedReviewFile;
  isCollapsed: boolean;
  isSelected: boolean;
  theme: UiTheme;
}) {
  return (
    <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
      <text fg={theme.text} wrapMode="none">
        <span fg={theme.textMuted}>{isCollapsed ? "\u25B6 " : "\u25BC "}</span>
        <span fg={isSelected ? theme.accent : theme.text}>{file.path}</span>
      </text>
      <FileCardChangeCounts file={file} theme={theme} />
    </box>
  );
}

function FileCardStatusRow({
  isReviewed,
  statusColor,
  statusLabel,
  theme,
}: {
  isReviewed: boolean;
  statusColor: ColorInput;
  statusLabel: string;
  theme: UiTheme;
}) {
  return (
    <box width="100%">
      <FileCardStatusTags
        isReviewed={isReviewed}
        statusColor={statusColor}
        statusLabel={statusLabel}
        theme={theme}
      />
    </box>
  );
}

function FileCardStatusTags({
  isReviewed,
  statusColor,
  statusLabel,
  theme,
}: {
  isReviewed: boolean;
  statusColor: ColorInput;
  statusLabel: string;
  theme: UiTheme;
}) {
  return (
    <text fg={theme.textMuted} wrapMode="none">
      <Tag label={statusLabel.toUpperCase()} fg={theme.inverseText} bg={statusColor} />
      {isReviewed ? (
        <>
          <span> </span>
          <Tag label="REVIEWED" fg={theme.success} bg={theme.reviewedBg} />
        </>
      ) : null}
    </text>
  );
}

function FileCardChangeCounts({ file, theme }: { file: PreparedReviewFile; theme: UiTheme }) {
  return (
    <box paddingRight={2}>
      <text fg={theme.textMuted} wrapMode="none">
        <span fg={theme.success}>{`+${file.additions}`}</span>
        <span fg={theme.border}>{" / "}</span>
        <span fg={theme.danger}>{`-${file.deletions}`}</span>
      </text>
    </box>
  );
}

function getFileCardChrome(isSelected: boolean, isReviewed: boolean, theme: UiTheme) {
  return {
    borderColor: isSelected ? theme.borderActive : isReviewed ? theme.success : theme.border,
    fileBackground: isSelected ? theme.surfaceMuted : theme.surface,
  };
}

function getFileStatusChrome(status: PreparedReviewFile["status"], theme: UiTheme) {
  return {
    statusColor:
      status === "added"
        ? theme.success
        : status === "deleted"
          ? theme.danger
          : status === "renamed"
            ? theme.warning
            : theme.accent,
    statusLabel: status === "modified" ? "Changed" : capitalize(status),
  };
}

function getFileTreeStatusGlyph(status: PreparedReviewFile["status"]): string {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "modified":
      return "M";
  }
}

function UnifiedDiffPreview({
  file,
  reviewThreads,
  selectedReviewAnchor,
  showOutdatedReviewThreads,
  theme,
}: {
  file: PreparedReviewFile;
  reviewThreads: readonly GitHubPullRequestReviewThread[];
  selectedReviewAnchor?: SelectedReviewAnchor;
  showOutdatedReviewThreads: boolean;
  theme: UiTheme;
}) {
  const visibleThreads = reviewThreads.filter(
    (thread) => showOutdatedReviewThreads || !thread.isOutdated,
  );

  return (
    <box width="100%" flexDirection="column">
      {file.unifiedLines.map((line, index) => {
        const lineThreads = getThreadsForUnifiedLine(visibleThreads, line);

        return (
          <box key={`${line.kind}-${index}`} width="100%" flexDirection="column">
            <UnifiedDiffRow
              isSelected={matchesUnifiedAnchor(line, selectedReviewAnchor)}
              line={line}
              lineNumberWidth={file.lineNumberWidth}
              theme={theme}
            />
            <ReviewThreadList threads={lineThreads} theme={theme} />
          </box>
        );
      })}
      <ReviewThreadList
        threads={getUnanchoredUnifiedThreads(visibleThreads, file.unifiedLines)}
        theme={theme}
      />
    </box>
  );
}

function SideBySideDiffPreview({
  file,
  reviewThreads,
  selectedReviewAnchor,
  showOutdatedReviewThreads,
  terminalWidth,
  theme,
}: {
  file: PreparedReviewFile;
  reviewThreads: readonly GitHubPullRequestReviewThread[];
  selectedReviewAnchor?: SelectedReviewAnchor;
  showOutdatedReviewThreads: boolean;
  terminalWidth: number;
  theme: UiTheme;
}) {
  const paneWidth = Math.max(Math.floor((Math.max(terminalWidth - 12, 40) - 1) / 2), 12);
  const contentWidth = Math.max(paneWidth - (file.lineNumberWidth + 3), 1);
  const visibleThreads = reviewThreads.filter(
    (thread) => showOutdatedReviewThreads || !thread.isOutdated,
  );

  return (
    <box width="100%" flexDirection="column">
      {file.sideBySideRows.map((row, index) => {
        const rowThreads = getThreadsForSideBySideRow(visibleThreads, row);

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
            <ReviewThreadList threads={rowThreads} theme={theme} />
          </box>
        );
      })}
      <ReviewThreadList
        threads={getUnanchoredSideBySideThreads(visibleThreads, file.sideBySideRows)}
        theme={theme}
      />
    </box>
  );
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

export function BranchModal({
  activeView,
  base,
  branchItems,
  branchIndex,
  commitItems,
  commitIndex,
  commitSearchQuery,
  commitSearchActive,
  comparisonMode,
  filters,
  head,
  localBranchCount,
  openPrCount,
  remoteBranchCount,
  theme,
}: {
  activeView: ListModalView;
  base: string;
  branchItems: readonly BranchListItem[];
  branchIndex: number;
  commitItems: readonly CommitListItem[];
  commitIndex: number;
  commitSearchQuery: string;
  commitSearchActive: boolean;
  comparisonMode: "range" | "working-tree";
  filters: BranchListFilters;
  head: string;
  localBranchCount: number;
  openPrCount: number;
  remoteBranchCount: number;
  theme: UiTheme;
}) {
  const selectedBranchItem = selectItem(branchItems, branchIndex);
  const selectedCommitItem = selectItem(commitItems, commitIndex);

  return (
    <ModalFrame
      title="List"
      subtitle={
        activeView === "branch"
          ? "Browse working tree changes, branches, and open pull requests."
          : "Browse the comparison commit log and choose base/head commits."
      }
      theme={theme}
      maxWidth={108}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="tab" theme={theme} />
          <span>{" switch view  "}</span>
          {activeView === "branch" ? (
            <>
              <KeyCap label="f" theme={theme} />
              <span>{" filters  "}</span>
            </>
          ) : null}
          <KeyCap label="esc" theme={theme} />
          <span>{" close"}</span>
        </text>
      }
    >
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.border}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={2}>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.warning}>base</span>
            <span fg={theme.textMuted}>{" \u2190 "}</span>
            <span fg={theme.text}>{base}</span>
            <span fg={theme.border}>{"  \u2502  "}</span>
            <span fg={theme.accent}>head</span>
            <span fg={theme.textMuted}>{" \u2192 "}</span>
            <span fg={theme.text}>{head}</span>
          </text>
          <box flexDirection="row" gap={1}>
            {(() => {
              const tabs = [
                { label: "Branches", isActive: activeView === "branch" },
                { label: "Commits", isActive: activeView === "commit" },
              ];
              const maxLen = Math.max(...tabs.map((t) => t.label.length));
              return tabs.map((tab) => (
                <text key={tab.label} wrapMode="none">
                  <ListViewTab
                    label={tab.label}
                    isActive={tab.isActive}
                    width={maxLen}
                    theme={theme}
                  />
                </text>
              ));
            })()}
          </box>
        </box>
        {activeView === "branch" ? (
          <text fg={theme.textMuted} wrapMode="none">
            <span>{`${localBranchCount}`}</span>
            <span>{" local"}</span>
            <span fg={theme.border}>{"  \u2502  "}</span>
            <span>{`${openPrCount}`}</span>
            <span>{" open PR"}</span>
            <span fg={theme.border}>{"  \u2502  "}</span>
            <span>{`${remoteBranchCount}`}</span>
            <span>{" remote"}</span>
            <span fg={theme.border}>{"  \u2502  "}</span>
            <CategoryPill label="working tree" isEnabled={filters.workingTree} theme={theme} />
            <span> </span>
            <CategoryPill label="local" isEnabled={filters.localBranch} theme={theme} />
            <span> </span>
            <CategoryPill label="PR" isEnabled={filters.openPr} theme={theme} />
            <span> </span>
            <CategoryPill label="remote" isEnabled={filters.remoteBranch} theme={theme} />
          </text>
        ) : (
          <text fg={theme.textMuted} wrapMode="none">
            {commitItems.length === 0
              ? comparisonMode === "working-tree"
                ? "Working tree changes are not committed yet."
                : "No commits are unique to the selected head ref."
              : `${commitItems.length} commits in the current comparison`}
          </text>
        )}
      </box>

      {activeView === "branch" ? (
        <BranchListView
          base={base}
          branchItems={branchItems}
          comparisonMode={comparisonMode}
          head={head}
          selectedIndex={branchIndex}
          theme={theme}
        />
      ) : (
        <CommitListView
          commitItems={commitItems}
          searchQuery={commitSearchQuery}
          searchActive={commitSearchActive}
          selectedIndex={commitIndex}
          theme={theme}
        />
      )}

      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={activeView === "branch" ? theme.borderActive : theme.border}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={1}
      >
        {activeView === "branch" ? (
          <>
            {selectedBranchItem != null ? (
              <>
                <text fg={theme.text} wrapMode="none">
                  {getBranchListItemTitle(selectedBranchItem)}
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  {getBranchListItemMeta(selectedBranchItem, base, head)}
                </text>
              </>
            ) : (
              <text fg={theme.textMuted}>
                Enable at least one branch filter to populate the list.
              </text>
            )}
            <text fg={theme.textMuted} wrapMode="none">
              <KeyCap label="enter" theme={theme} />
              <span>{selectedBranchItem?.kind === "open-pr" ? " open PR  " : " select  "}</span>
              <KeyCap label="b" theme={theme} />
              <span>{" set base  "}</span>
              <KeyCap label="h" theme={theme} />
              <span>{" set head  "}</span>
              <span fg={theme.border}>{"\u2502  "}</span>
              <KeyCap label="w" theme={theme} />
              <span>{" working tree  "}</span>
              <KeyCap label="o" theme={theme} />
              <span>{" remote toggle  "}</span>
              <KeyCap label="f" theme={theme} />
              <span>{" filters"}</span>
            </text>
          </>
        ) : selectedCommitItem != null ? (
          <>
            <text fg={theme.text} wrapMode="none">
              {formatCommitListEntry(selectedCommitItem.commit)}
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <span>{selectedCommitItem.commit.author}</span>
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <KeyCap label="enter / h" theme={theme} />
              <span>{" set head  "}</span>
              <KeyCap label="b" theme={theme} />
              <span>{" set base  "}</span>
              <span fg={theme.border}>{"\u2502  "}</span>
              <KeyCap label="/" theme={theme} />
              <span>{" search  "}</span>
              <KeyCap label="j / k" theme={theme} />
              <span>{" move  "}</span>
              <KeyCap label="tab" theme={theme} />
              <span>{" branch view"}</span>
            </text>
          </>
        ) : (
          <text fg={theme.textMuted}>Nothing to show.</text>
        )}
      </box>
    </ModalFrame>
  );
}

export function ListFilterModal({
  filters,
  selectedIndex,
  theme,
}: {
  filters: BranchListFilters;
  selectedIndex: number;
  theme: UiTheme;
}) {
  const entries = [
    ["workingTree", "Working tree"],
    ["localBranch", "Local branches"],
    ["openPr", "Open PRs"],
    ["remoteBranch", "Remote branches"],
  ] as const;

  return (
    <ModalFrame
      title="Filters"
      subtitle="Choose which list item types are visible in the branch view."
      theme={theme}
      maxWidth={56}
      width="68%"
      zIndex={40}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="esc" theme={theme} />
          <span>{" close"}</span>
        </text>
      }
    >
      <box width="100%" flexDirection="column" gap={0}>
        {entries.map(([key, label], index) => {
          const isSelected = index === selectedIndex;
          const isEnabled = filters[key];

          return (
            <box
              key={key}
              width="100%"
              border={["left"]}
              customBorderChars={SPLIT_BORDER}
              borderColor={isSelected ? theme.borderActive : theme.border}
              backgroundColor={isSelected ? theme.surfaceMuted : theme.surface}
              paddingLeft={2}
              paddingRight={1}
              paddingTop={1}
              paddingBottom={1}
              flexDirection="row"
              justifyContent="space-between"
              gap={1}
            >
              <text fg={isSelected ? theme.text : theme.textMuted} wrapMode="none">
                {label}
              </text>
              <text wrapMode="none">
                <CategoryPill
                  label={isEnabled ? "ON" : "OFF"}
                  isEnabled={isEnabled}
                  theme={theme}
                />
              </text>
            </box>
          );
        })}
      </box>
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.border}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="space / enter" theme={theme} />
          <span>{" toggle  "}</span>
          <KeyCap label="a" theme={theme} />
          <span>{" all on  "}</span>
          <KeyCap label="n" theme={theme} />
          <span>{" all off"}</span>
        </text>
      </box>
    </ModalFrame>
  );
}

function BranchListView({
  base,
  branchItems,
  comparisonMode,
  head,
  selectedIndex,
  theme,
}: {
  base: string;
  branchItems: readonly BranchListItem[];
  comparisonMode: "range" | "working-tree";
  head: string;
  selectedIndex: number;
  theme: UiTheme;
}) {
  return (
    <box width="100%" flexDirection="column" gap={0}>
      {branchItems.length === 0 ? (
        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
        >
          <text fg={theme.textMuted}>No items match the current branch filters.</text>
        </box>
      ) : null}
      {branchItems.map((item, index) => (
        <BranchListCard
          key={item.key}
          item={item}
          isActiveComparison={item.kind === "working-tree" && comparisonMode === "working-tree"}
          isSelected={index === selectedIndex}
          base={base}
          head={head}
          theme={theme}
        />
      ))}
    </box>
  );
}

const COMMIT_LIST_MAX_VISIBLE = 7;

function getCommitListWindow(
  items: readonly CommitListItem[],
  selectedIndex: number,
): { item: CommitListItem; index: number }[] {
  if (items.length <= COMMIT_LIST_MAX_VISIBLE) {
    return items.map((item, index) => ({ item, index }));
  }

  let start = selectedIndex - Math.floor(COMMIT_LIST_MAX_VISIBLE / 2);
  start = Math.max(0, Math.min(start, items.length - COMMIT_LIST_MAX_VISIBLE));
  const end = start + COMMIT_LIST_MAX_VISIBLE;

  return items.slice(start, end).map((item, i) => ({ item, index: start + i }));
}

function CommitListView({
  commitItems,
  searchQuery,
  searchActive,
  selectedIndex,
  theme,
}: {
  commitItems: readonly CommitListItem[];
  searchQuery: string;
  searchActive: boolean;
  selectedIndex: number;
  theme: UiTheme;
}) {
  return (
    <box width="100%" flexDirection="column" gap={0}>
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={searchActive ? theme.borderActive : theme.border}
        backgroundColor={searchActive ? theme.surfaceMuted : theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={0}
        paddingBottom={0}
        flexDirection="row"
        gap={1}
      >
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={searchActive ? theme.accent : theme.textMuted}>/</span>
          <span fg={searchQuery !== "" ? theme.text : theme.textMuted}>
            {searchQuery !== "" ? searchQuery : searchActive ? "" : "search commits..."}
          </span>
          {searchActive ? <span fg={theme.accent}>_</span> : null}
        </text>
      </box>
      {commitItems.length === 0 ? (
        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
        >
          <text fg={theme.textMuted}>
            {searchQuery !== ""
              ? "No commits match the current search."
              : "No commits to show for the current comparison."}
          </text>
        </box>
      ) : null}
      <box width="100%" flexDirection="column" gap={0}>
        {getCommitListWindow(commitItems, selectedIndex).map(({ item, index }) => {
          const isSelected = index === selectedIndex;
          const textColor = isSelected ? theme.text : theme.textMuted;

          return (
            <ListRow
              key={item.key}
              accentColor={theme.accent}
              isSelected={isSelected}
              theme={theme}
            >
              <text fg={textColor} wrapMode="none">
                {formatCommitListEntry(item.commit)}
              </text>
            </ListRow>
          );
        })}
      </box>
    </box>
  );
}

function ListRow({
  accentColor,
  isSelected,
  children,
  tags,
  theme,
}: {
  accentColor: string;
  isSelected: boolean;
  children: ReactNode;
  tags?: ReactNode;
  theme: UiTheme;
}) {
  const borderColor = isSelected ? theme.borderActive : accentColor;
  const backgroundColor = tintHex(theme.surface, accentColor, isSelected ? 0.24 : 0.14);

  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
      flexDirection="row"
      justifyContent="space-between"
      gap={1}
    >
      {children}
      {tags != null ? <text wrapMode="none">{tags}</text> : null}
    </box>
  );
}

function BranchListCard({
  item,
  isActiveComparison,
  isSelected,
  base,
  head,
  theme,
}: {
  item: BranchListItem;
  isActiveComparison: boolean;
  isSelected: boolean;
  base: string;
  head: string;
  theme: UiTheme;
}) {
  const accent = getBranchListAccent(item, theme);

  return (
    <ListRow
      accentColor={accent}
      isSelected={isSelected}
      tags={
        <BranchListItemTags
          item={item}
          isActiveComparison={isActiveComparison}
          accentColor={accent}
          base={base}
          head={head}
          theme={theme}
        />
      }
      theme={theme}
    >
      <text fg={theme.text} wrapMode="none">
        {renderBranchListItemTitle(item, theme)}
        <span fg={theme.textMuted}>{"  \u2502  "}</span>
        <span fg={theme.textMuted}>{renderBranchListItemSummary(item)}</span>
      </text>
    </ListRow>
  );
}

function BranchListItemTags({
  item,
  isActiveComparison,
  accentColor,
  base,
  head,
  theme,
}: {
  item: BranchListItem;
  isActiveComparison: boolean;
  accentColor: string;
  base: string;
  head: string;
  theme: UiTheme;
}) {
  const branch = item.branch;
  const tagWidth = Math.max(
    "ACTIVE".length,
    "BASE".length,
    "HEAD".length,
    "CURRENT".length,
    "DEFAULT".length,
  );

  return (
    <>
      {isActiveComparison ? (
        <>
          <span> </span>
          <Tag label="ACTIVE" fg={theme.inverseText} bg={accentColor} width={tagWidth} />
        </>
      ) : null}
      {branch?.pullRequest != null ? (
        <>
          <span> </span>
          <Tag
            label={`PR #${branch.pullRequest.number}`}
            fg={theme.inverseText}
            bg={theme.success}
          />
        </>
      ) : null}
      {branch?.name === base ? (
        <>
          <span> </span>
          <Tag label="BASE" fg={theme.inverseText} bg={theme.warning} width={tagWidth} />
        </>
      ) : null}
      {branch?.name === head ? (
        <>
          <span> </span>
          <Tag label="HEAD" fg={theme.inverseText} bg={theme.accent} width={tagWidth} />
        </>
      ) : null}
      {branch?.isCurrent === true ? (
        <>
          <span> </span>
          <Tag label="CURRENT" fg={theme.text} bg={theme.reviewedBg} width={tagWidth} />
        </>
      ) : null}
      {branch?.isDefault === true ? (
        <>
          <span> </span>
          <Tag label="DEFAULT" fg={theme.text} bg={theme.surfaceMuted} width={tagWidth} />
        </>
      ) : null}
    </>
  );
}

function ListViewTab({
  label,
  isActive,
  width,
  theme,
}: {
  label: string;
  isActive: boolean;
  width: number;
  theme: UiTheme;
}) {
  const padded = label.padEnd(width);
  return (
    <span
      fg={isActive ? theme.inverseText : theme.textMuted}
      bg={isActive ? theme.accent : theme.surfaceMuted}
    >
      {` ${padded} `}
    </span>
  );
}

function CategoryPill({
  label,
  isEnabled,
  theme,
}: {
  label: string;
  isEnabled: boolean;
  theme: UiTheme;
}) {
  return (
    <span
      fg={isEnabled ? theme.inverseText : theme.textMuted}
      bg={isEnabled ? theme.accent : theme.surfaceMuted}
    >
      {` ${label} `}
    </span>
  );
}

function renderBranchListItemTitle(item: BranchListItem, theme: UiTheme): ReactNode {
  if (item.kind === "working-tree") {
    return <>Working tree</>;
  }

  if (item.kind === "open-pr" && item.branch?.pullRequest != null) {
    return (
      <>
        <span fg={theme.success}>{item.branch.pullRequest.title}</span>
        <span fg={theme.textMuted}>{` (#${item.branch.pullRequest.number})`}</span>
      </>
    );
  }

  return <BranchName branch={item.branch!} fg={theme.text} theme={theme} />;
}

function renderBranchListItemSummary(item: BranchListItem): ReactNode {
  if (item.kind === "working-tree") {
    return formatChangeSummary(item.summary ?? { filesChanged: 0, additions: 0, deletions: 0 });
  }

  const summary = item.branch?.summary;
  if (summary == null) {
    return item.branch?.tipAuthor ?? "No branch metadata available.";
  }

  if (item.kind === "open-pr") {
    return `${formatAuthorList(summary.authors)}  \u2502  ${formatCommitDelta(summary.commitCount, summary.comparedTo)}  \u2502  +${summary.additions}/-${summary.deletions}`;
  }

  return `${formatAuthorList(summary.authors)}  \u2502  ${formatCommitDelta(summary.commitCount, summary.comparedTo)}  \u2502  ${formatChangeSummary(summary)}`;
}

function getBranchListItemTitle(item: BranchListItem): string {
  if (item.kind === "working-tree") {
    return "Working tree";
  }

  if (item.kind === "open-pr" && item.branch?.pullRequest != null) {
    return `${item.branch.pullRequest.title} (#${item.branch.pullRequest.number})`;
  }

  if (item.branch == null) {
    return "Nothing selected";
  }

  return item.branch.kind === "remote" ? getRemoteShortName(item.branch) : item.branch.name;
}

function getBranchListItemMeta(item: BranchListItem, base: string, head: string): string {
  if (item.kind === "working-tree") {
    return `Compares the working tree against ${head === "working tree" ? base : "HEAD"}.`;
  }

  if (item.branch == null) {
    return "Nothing to show.";
  }

  const details = [`sha ${shortSha(item.branch.sha)}`];

  if (item.branch.upstream != null) {
    details.push(`upstream ${item.branch.upstream}`);
  }

  if (item.branch.summary != null) {
    details.push(`diff vs ${item.branch.summary.comparedTo}`);
  }

  if (item.branch.name === base) {
    details.push("selected as base");
  }

  if (item.branch.name === head) {
    details.push("selected as head");
  }

  return details.join("  \u2502  ");
}

function getBranchListAccent(item: BranchListItem, theme: UiTheme): string {
  switch (item.kind) {
    case "working-tree":
      return theme.warning;
    case "local-branch":
      return theme.accent;
    case "open-pr":
      return theme.success;
    case "remote-branch":
      return theme.border;
  }
}

export function HelpModal({ theme }: { theme: UiTheme }) {
  return (
    <ModalFrame
      title="Help"
      subtitle="Review files quickly without leaving the keyboard."
      theme={theme}
      maxWidth={92}
      zIndex={30}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="esc" theme={theme} />
          <span>{" close"}</span>
        </text>
      }
    >
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.accent}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={0}
      >
        <text fg={theme.accent} wrapMode="none">
          Commands
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="ctrl+p" theme={theme} />
          <span>{" open the command palette  "}</span>
          <KeyCap label="ctrl+x" theme={theme} />
          <span>{" leader shortcuts"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="z" theme={theme} />
          <span>{" show or hide the key legend"}</span>
        </text>
      </box>
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.accent}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={0}
      >
        <text fg={theme.accent} wrapMode="none">
          Navigation
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="j / k" theme={theme} />
          <span>{" move in the active pane  "}</span>
          <KeyCap label="g / G" theme={theme} />
          <span>{" first / last item"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="tab" theme={theme} />
          <span>{" switch tree/diff pane  "}</span>
          <KeyCap label="left / right" theme={theme} />
          <span>{" collapse, expand, or open from the tree"}</span>
        </text>
      </box>
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.success}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={0}
      >
        <text fg={theme.success} wrapMode="none">
          Review
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="r" theme={theme} />
          <span>{" toggle reviewed  "}</span>
          <KeyCap label="c / enter" theme={theme} />
          <span>{" collapse file  "}</span>
          <KeyCap label="v" theme={theme} />
          <span>{" toggle diff view"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="t" theme={theme} />
          <span>{" PR comments  "}</span>
          <KeyCap label="u" theme={theme} />
          <span>{" outdated threads  "}</span>
          <KeyCap label="y" theme={theme} />
          <span>{" copy PR URL"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="a" theme={theme} />
          <span>{" add comment  "}</span>
          <KeyCap label="s" theme={theme} />
          <span>{" submit review  "}</span>
          <KeyCap label="m" theme={theme} />
          <span>{" merge PR"}</span>
        </text>
      </box>
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.warning}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={0}
      >
        <text fg={theme.warning} wrapMode="none">
          Comparison
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="l" theme={theme} />
          <span>{" list modal  "}</span>
          <KeyCap label="b / h" theme={theme} />
          <span>{" set base / head  "}</span>
          <KeyCap label="w" theme={theme} />
          <span>{" working tree"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="o" theme={theme} />
          <span>{" remote toggle  "}</span>
          <KeyCap label="f" theme={theme} />
          <span>{" list filters  "}</span>
          <KeyCap label="/" theme={theme} />
          <span>{" search commits  "}</span>
          <KeyCap label="q" theme={theme} />
          <span>{" quit"}</span>
        </text>
      </box>
    </ModalFrame>
  );
}

export function CommandPaletteModal({
  commands,
  leaderKeybind,
  query,
  selectedIndex,
  theme,
}: {
  commands: readonly CommandDefinition[];
  leaderKeybind: string;
  query: string;
  selectedIndex: number;
  theme: UiTheme;
}) {
  const selectedCommand = selectItem(commands, selectedIndex);
  const normalizedQuery = query.trim();
  let activeCategory: string | undefined;

  return (
    <ModalFrame
      title="Commands"
      subtitle={
        normalizedQuery === ""
          ? "Search or browse available diffdiff actions."
          : `Filtering commands for "${normalizedQuery}".`
      }
      theme={theme}
      maxWidth={96}
      width="78%"
      zIndex={30}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="esc" theme={theme} />
          <span>{" close"}</span>
        </text>
      }
    >
      <box width="100%" flexDirection="column" gap={1}>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          gap={0}
        >
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.text}>query</span>
            <span>{": "}</span>
            <span fg={normalizedQuery === "" ? theme.textMuted : theme.text}>
              {normalizedQuery === "" ? "type to filter commands" : normalizedQuery}
            </span>
          </text>
        </box>

        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={theme.accent}
          backgroundColor={theme.surface}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          gap={0}
        >
          {commands.length === 0 ? (
            <text fg={theme.textMuted} wrapMode="none">
              No matching commands.
            </text>
          ) : (
            commands.map((command, index) => {
              const showCategory = command.category !== activeCategory;
              activeCategory = command.category;
              const isSelected = index === selectedIndex;
              const backgroundColor = isSelected ? theme.accent : theme.surface;
              const foreground = isSelected ? theme.appBackground : theme.text;
              const detail = isSelected ? theme.appBackground : theme.textMuted;

              return (
                <box key={command.value} width="100%" flexDirection="column" gap={0}>
                  {showCategory ? (
                    <text fg={theme.success} wrapMode="none">
                      {command.category}
                    </text>
                  ) : null}
                  <box
                    width="100%"
                    backgroundColor={backgroundColor}
                    paddingLeft={1}
                    paddingRight={1}
                    flexDirection="row"
                    justifyContent="space-between"
                    gap={1}
                  >
                    <text fg={foreground} wrapMode="none">
                      <span>{isSelected ? "› " : "  "}</span>
                      <span>{command.title}</span>
                      {command.description != null ? (
                        <span fg={detail}>{`  ${command.description}`}</span>
                      ) : null}
                    </text>
                    <text fg={detail} wrapMode="none">
                      {formatCommandKeybind(command.keybind, leaderKeybind) ?? ""}
                    </text>
                  </box>
                </box>
              );
            })
          )}
        </box>

        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="row"
          justifyContent="space-between"
          gap={2}
        >
          <text fg={theme.textMuted} wrapMode="none">
            <KeyCap label="j / k" theme={theme} />
            <span>{" move  "}</span>
            <KeyCap label="enter" theme={theme} />
            <span>{" run  "}</span>
            <KeyCap label="backspace" theme={theme} />
            <span>{" edit query"}</span>
          </text>
          <text fg={theme.textMuted} wrapMode="none">
            {selectedCommand != null ? selectedCommand.value : ""}
          </text>
        </box>
      </box>
    </ModalFrame>
  );
}

function ModalFrame({
  children,
  headerRight,
  maxWidth = 140,
  theme,
  title,
  subtitle,
  width = "92%",
  zIndex = 20,
}: {
  children: ReactNode;
  headerRight?: ReactNode;
  maxWidth?: number;
  theme: UiTheme;
  title: string;
  subtitle?: string;
  width?: `${number}%` | "auto" | number;
  zIndex?: number;
}) {
  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={zIndex}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width={width}
        maxWidth={maxWidth}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="column">
          <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
            <text fg={theme.accent} wrapMode="none">
              {title}
            </text>
            {headerRight}
          </box>
          {subtitle != null ? (
            <text fg={theme.textMuted} wrapMode="none">
              {subtitle}
            </text>
          ) : null}
        </box>
        {children}
      </box>
    </box>
  );
}

function BranchName({ branch, fg, theme }: { branch: BranchInfo; fg: ColorInput; theme: UiTheme }) {
  if (branch.kind === "remote" && branch.remoteName != null) {
    return (
      <>
        <span fg={theme.textMuted}>{`${branch.remoteName}/`}</span>
        <span fg={fg}>{getRemoteShortName(branch)}</span>
      </>
    );
  }

  return <span fg={fg}>{branch.name}</span>;
}

function KeyCap({ label, theme }: { label: string; theme: UiTheme }) {
  return (
    <span fg={theme.accent} bg={theme.surfaceMuted}>
      {` ${label} `}
    </span>
  );
}

function Tag({
  label,
  fg,
  bg,
  width,
}: {
  label: string;
  fg: ColorInput;
  bg: ColorInput;
  width?: number;
}) {
  const padded = width != null ? label.padEnd(width) : label;
  return (
    <span fg={fg} bg={bg}>
      {` ${padded} `}
    </span>
  );
}

function selectItem<T>(items: readonly T[], index: number): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  return items[Math.max(0, Math.min(index, items.length - 1))];
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function getRemoteShortName(branch: BranchInfo): string {
  if (branch.remoteName == null) {
    return branch.name;
  }

  return branch.name.startsWith(`${branch.remoteName}/`)
    ? branch.name.slice(branch.remoteName.length + 1)
    : branch.name;
}

function tintHex(base: string, overlay: string, alpha: number): string {
  const baseRgb = parseHexColor(base);
  const overlayRgb = parseHexColor(overlay);

  return toHexColor({
    r: Math.round(baseRgb.r + (overlayRgb.r - baseRgb.r) * alpha),
    g: Math.round(baseRgb.g + (overlayRgb.g - baseRgb.g) * alpha),
    b: Math.round(baseRgb.b + (overlayRgb.b - baseRgb.b) * alpha),
  });
}

function parseHexColor(color: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}

function toHexColor(color: { r: number; g: number; b: number }): string {
  return `#${[color.r, color.g, color.b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
