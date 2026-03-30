import type { BranchInfo } from "@diffdiff/core";
import type { BoxRenderable, ColorInput, SyntaxStyle } from "@opentui/core";
import type { ReactNode, Ref } from "react";
import { getDiffFiletype } from "./language.ts";
import type { UiTheme } from "./theme.ts";
import type {
  BranchListFilters,
  BranchListItem,
  CommitListItem,
  DiffView,
  ListModalView,
  PreparedReviewFile,
  SideBySideDiffCell,
  SideBySideDiffRow,
  TextSegment,
  UnifiedDiffLine,
} from "./types.ts";
import {
  formatAuthorList,
  formatChangeSummary,
  formatCommitDelta,
  getDiffViewLabel,
  truncateSegments,
} from "./view-model.ts";

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
  isCollapsed: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  rootRef?: Ref<BoxRenderable>;
  syntaxStyle: SyntaxStyle;
  terminalWidth: number;
  theme: UiTheme;
}

export function FileCard({
  file,
  diffView,
  isCollapsed,
  isReviewed,
  isSelected,
  rootRef,
  syntaxStyle,
  terminalWidth,
  theme,
}: FileCardProps) {
  const filetype = getDiffFiletype(file.path);
  const statusLabel = file.status === "modified" ? "Changed" : capitalize(file.status);
  const statusColor =
    file.status === "added"
      ? theme.success
      : file.status === "deleted"
        ? theme.danger
        : file.status === "renamed"
          ? theme.warning
          : theme.accent;
  const modeLabel = file.isBinary
    ? "binary change"
    : `${filetype ?? "text"} ${getDiffViewLabel(diffView)} diff`;
  const { borderColor, fileBackground } = getFileCardChrome(isSelected, isReviewed, theme);

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
      paddingRight={1}
      paddingTop={1}
      paddingBottom={isCollapsed ? 0 : 1}
      gap={1}
    >
      <FileCardTitleRow file={file} isSelected={isSelected} theme={theme} />

      <text fg={theme.textMuted} wrapMode="none">
        <Tag label={statusLabel.toUpperCase()} fg={theme.inverseText} bg={statusColor} />
        {isReviewed ? (
          <>
            <span> </span>
            <Tag label="REVIEWED" fg={theme.text} bg={theme.reviewedBg} />
          </>
        ) : null}
        {isCollapsed ? (
          <>
            <span> </span>
            <Tag label="COLLAPSED" fg={theme.text} bg={theme.surface} />
          </>
        ) : null}
        <span>{"  "}</span>
        <span>{modeLabel}</span>
      </text>

      {file.previousPath != null ? (
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.warning}>rename</span>
          <span>{` ${file.previousPath} -> ${file.path}`}</span>
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
            <box paddingLeft={1}>
              {diffView === "unified" && file.unifiedLines.length > 0 ? (
                <UnifiedDiffPreview file={file} theme={theme} />
              ) : diffView === "split" && file.sideBySideRows.length > 0 ? (
                <SideBySideDiffPreview file={file} terminalWidth={terminalWidth} theme={theme} />
              ) : (
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
  isReviewed,
  isSelected,
  theme,
}: {
  file: PreparedReviewFile;
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
      paddingLeft={2}
      paddingRight={1}
      zIndex={10}
    >
      <FileCardTitleRow file={file} isSelected={isSelected} theme={theme} />
    </box>
  );
}

function FileCardTitleRow({
  file,
  isSelected,
  theme,
}: {
  file: PreparedReviewFile;
  isSelected: boolean;
  theme: UiTheme;
}) {
  return (
    <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
      <text fg={theme.text} wrapMode="none">
        <span fg={isSelected ? theme.accent : theme.text}>{file.path}</span>
      </text>
      <text fg={theme.textMuted} wrapMode="none">
        <span fg={theme.success}>{`+${file.additions}`}</span>
        <span>{" / "}</span>
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

function UnifiedDiffPreview({ file, theme }: { file: PreparedReviewFile; theme: UiTheme }) {
  return (
    <box width="100%" flexDirection="column">
      {file.unifiedLines.map((line, index) => (
        <UnifiedDiffRow
          key={`${line.kind}-${index}`}
          line={line}
          lineNumberWidth={file.lineNumberWidth}
          theme={theme}
        />
      ))}
    </box>
  );
}

function SideBySideDiffPreview({
  file,
  terminalWidth,
  theme,
}: {
  file: PreparedReviewFile;
  terminalWidth: number;
  theme: UiTheme;
}) {
  const paneWidth = Math.max(Math.floor((Math.max(terminalWidth - 12, 40) - 1) / 2), 12);
  const contentWidth = Math.max(paneWidth - (file.lineNumberWidth + 3), 1);

  return (
    <box width="100%" flexDirection="column">
      {file.sideBySideRows.map((row, index) => (
        <SideBySideDiffRowView
          key={`${row.kind}-${index}`}
          contentWidth={contentWidth}
          lineNumberWidth={file.lineNumberWidth}
          paneWidth={paneWidth}
          row={row}
          theme={theme}
        />
      ))}
    </box>
  );
}

function SideBySideDiffRowView({
  contentWidth,
  lineNumberWidth,
  paneWidth,
  row,
  theme,
}: {
  contentWidth: number;
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

  return (
    <box width="100%" flexDirection="row">
      <SideBySideDiffCellView
        cell={row.left ?? { kind: "empty", segments: [] }}
        contentWidth={contentWidth}
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
  lineNumberWidth,
  paneWidth,
  theme,
}: {
  cell: SideBySideDiffCell;
  contentWidth: number;
  lineNumberWidth: number;
  paneWidth: number;
  theme: UiTheme;
}) {
  const lineNumberBg =
    cell.kind === "addition"
      ? theme.additionLineNumberBg
      : cell.kind === "deletion"
        ? theme.deletionLineNumberBg
        : theme.contextBg;
  const contentBg =
    cell.kind === "addition"
      ? theme.additionBg
      : cell.kind === "deletion"
        ? theme.deletionBg
        : theme.contextBg;
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
  line,
  lineNumberWidth,
  theme,
}: {
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
  const lineNumberBg =
    line.kind === "addition"
      ? theme.additionLineNumberBg
      : line.kind === "deletion"
        ? theme.deletionLineNumberBg
        : theme.contextBg;
  const contentBg =
    line.kind === "addition"
      ? theme.additionBg
      : line.kind === "deletion"
        ? theme.deletionBg
        : theme.contextBg;
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
          : "Inspect commits included in the active comparison."
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
            <span>{` ${base}`}</span>
            <span>{"  •  "}</span>
            <span fg={theme.accent}>head</span>
            <span>{` ${head}`}</span>
          </text>
          <box flexDirection="row" gap={1}>
            <text wrapMode="none">
              <ListViewTab label="Branches" isActive={activeView === "branch"} theme={theme} />
            </text>
            <text wrapMode="none">
              <ListViewTab label="Commits" isActive={activeView === "commit"} theme={theme} />
            </text>
          </box>
        </box>
        {activeView === "branch" ? (
          <text fg={theme.textMuted} wrapMode="none">
            <span>{`${localBranchCount} local`}</span>
            <span>{"  •  "}</span>
            <span>{`${openPrCount} open PR`}</span>
            <span>{"  •  "}</span>
            <span>{`${remoteBranchCount} remote`}</span>
            <span>{"  •  filters "}</span>
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
        <CommitListView commitItems={commitItems} selectedIndex={commitIndex} theme={theme} />
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
              <span>{" select  "}</span>
              <KeyCap label="b" theme={theme} />
              <span>{" set base  "}</span>
              <KeyCap label="h" theme={theme} />
              <span>{" set head  "}</span>
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
              {selectedCommitItem.commit.subject}
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <span>{selectedCommitItem.commit.author}</span>
              <span>{"  •  "}</span>
              <span>{selectedCommitItem.commit.shortSha}</span>
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <KeyCap label="enter / h" theme={theme} />
              <span>{" set head  "}</span>
              <KeyCap label="b" theme={theme} />
              <span>{" set base  "}</span>
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
      <box width="100%" flexDirection="column" gap={1}>
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
    <box width="100%" flexDirection="column" gap={1}>
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

function CommitListView({
  commitItems,
  selectedIndex,
  theme,
}: {
  commitItems: readonly CommitListItem[];
  selectedIndex: number;
  theme: UiTheme;
}) {
  return (
    <box width="100%" flexDirection="column" gap={1}>
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
          <text fg={theme.textMuted}>No commits to show for the current comparison.</text>
        </box>
      ) : null}
      {commitItems.map((item, index) => {
        const isSelected = index === selectedIndex;
        const borderColor = isSelected ? theme.borderActive : theme.accent;
        const backgroundColor = isSelected
          ? tintHex(theme.surface, theme.accent, 0.24)
          : tintHex(theme.surface, theme.accent, 0.14);

        return (
          <box
            key={item.key}
            width="100%"
            border={["left"]}
            customBorderChars={SPLIT_BORDER}
            borderColor={borderColor}
            backgroundColor={backgroundColor}
            paddingLeft={2}
            paddingRight={1}
            paddingTop={0}
            paddingBottom={0}
            flexDirection="column"
            gap={0}
          >
            <text fg={theme.text} wrapMode="none">
              {item.commit.subject}
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <span>{item.commit.author}</span>
              <span>{"  •  "}</span>
              <span fg={theme.accent}>{item.commit.shortSha}</span>
            </text>
          </box>
        );
      })}
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
  const borderColor = isSelected ? theme.borderActive : accent;
  const backgroundColor = tintHex(theme.surface, accent, isSelected ? 0.24 : 0.14);

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
      flexDirection="column"
      gap={0}
    >
      <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
        <text fg={theme.text} wrapMode="none">
          {renderBranchListItemTitle(item, base, head, theme)}
        </text>
        {isActiveComparison ? (
          <text wrapMode="none">
            <Tag label="ACTIVE" fg={theme.inverseText} bg={accent} />
          </text>
        ) : null}
      </box>
      <text fg={theme.textMuted} wrapMode="none">
        {renderBranchListItemSummary(item)}
      </text>
    </box>
  );
}

function ListViewTab({
  label,
  isActive,
  theme,
}: {
  label: string;
  isActive: boolean;
  theme: UiTheme;
}) {
  return (
    <span
      fg={isActive ? theme.inverseText : theme.textMuted}
      bg={isActive ? theme.accent : theme.surfaceMuted}
    >
      {` ${label} `}
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

function renderBranchListItemTitle(
  item: BranchListItem,
  base: string,
  head: string,
  theme: UiTheme,
): ReactNode {
  if (item.kind === "working-tree") {
    return <>Working tree</>;
  }

  if (item.kind === "open-pr" && item.branch?.pullRequest != null) {
    return (
      <>
        <span fg={theme.success}>{item.branch.pullRequest.title}</span>
        <span fg={theme.textMuted}>{` (#${item.branch.pullRequest.number})`}</span>
        <BranchBadges
          branch={item.branch}
          base={base}
          head={head}
          theme={theme}
          compact
          hidePullRequest
        />
      </>
    );
  }

  return (
    <>
      <BranchName branch={item.branch!} fg={theme.text} theme={theme} />
      <BranchBadges branch={item.branch!} base={base} head={head} theme={theme} compact />
    </>
  );
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
    return `${formatAuthorList(summary.authors)}  •  ${formatCommitDelta(summary.commitCount, summary.comparedTo)}  •  +${summary.additions}/-${summary.deletions}`;
  }

  return `${formatAuthorList(summary.authors)}  •  ${formatCommitDelta(summary.commitCount, summary.comparedTo)}  •  ${formatChangeSummary(summary)}`;
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

  return details.join("  •  ");
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
        borderColor={theme.borderActive}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={1}
      >
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="j / k" theme={theme} />
          <span>{" move between files  "}</span>
          <KeyCap label="g / G" theme={theme} />
          <span>{" first / last file"}</span>
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
          <KeyCap label="m" theme={theme} />
          <span>{" review and advance  "}</span>
          <KeyCap label="l" theme={theme} />
          <span>{" list modal  "}</span>
          <KeyCap label="tab" theme={theme} />
          <span>{" switch branch/commit view  "}</span>
          <KeyCap label="b / h" theme={theme} />
          <span>{" set base / head"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="w" theme={theme} />
          <span>{" working tree  "}</span>
          <KeyCap label="o" theme={theme} />
          <span>{" remote toggle  "}</span>
          <KeyCap label="f" theme={theme} />
          <span>{" list filters  "}</span>
          <KeyCap label="q" theme={theme} />
          <span>{" quit"}</span>
        </text>
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
            <text fg={theme.text} wrapMode="none">
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

function BranchBadges({
  branch,
  base,
  head,
  theme,
  compact = false,
  hidePullRequest = false,
}: {
  branch: BranchInfo;
  base: string;
  head: string;
  theme: UiTheme;
  compact?: boolean;
  hidePullRequest?: boolean;
}) {
  return (
    <>
      {branch.pullRequest != null && !hidePullRequest ? (
        <>
          <span> </span>
          <Tag
            label={
              compact ? `PR #${branch.pullRequest.number}` : `OPEN PR #${branch.pullRequest.number}`
            }
            fg={theme.inverseText}
            bg={theme.success}
          />
        </>
      ) : null}
      {branch.name === base ? (
        <>
          <span> </span>
          <Tag label="BASE" fg={theme.inverseText} bg={theme.warning} />
        </>
      ) : null}
      {branch.name === head ? (
        <>
          <span> </span>
          <Tag label="HEAD" fg={theme.inverseText} bg={theme.accent} />
        </>
      ) : null}
      {branch.isCurrent ? (
        <>
          <span> </span>
          <Tag label="CURRENT" fg={theme.text} bg={theme.reviewedBg} />
        </>
      ) : null}
      {branch.isDefault ? (
        <>
          <span> </span>
          <Tag label="DEFAULT" fg={theme.text} bg={theme.surfaceMuted} />
        </>
      ) : null}
    </>
  );
}

function KeyCap({ label, theme }: { label: string; theme: UiTheme }) {
  return (
    <span fg={theme.text} bg={theme.surfaceMuted}>
      {` ${label} `}
    </span>
  );
}

function Tag({ label, fg, bg }: { label: string; fg: ColorInput; bg: ColorInput }) {
  return (
    <span fg={fg} bg={bg}>
      {` ${label} `}
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
