import type { BranchInfo } from "@diffdiff/core";
import type { ColorInput, SyntaxStyle } from "@opentui/core";
import type { ReactNode } from "react";
import { getDiffFiletype } from "./language.ts";
import type { UiTheme } from "./theme.ts";
import type {
  DiffView,
  PreparedReviewFile,
  SideBySideDiffCell,
  SideBySideDiffRow,
  TextSegment,
  UnifiedDiffLine,
} from "./types.ts";
import { getDiffViewLabel, truncateSegments } from "./view-model.ts";

export type BranchColumn = "local" | "remote";

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
  syntaxStyle,
  terminalWidth,
  theme,
}: FileCardProps) {
  const borderColor = isSelected ? theme.borderActive : isReviewed ? theme.success : theme.border;
  const fileBackground = isSelected ? theme.surfaceMuted : theme.surface;
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

  return (
    <box
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
  activeColumn,
  base,
  head,
  localBranches,
  localIndex,
  remoteBranches,
  remoteIndex,
  remoteTotalCount,
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
  remoteTotalCount: number;
  showAllRemoteBranches: boolean;
  theme: UiTheme;
}) {
  const selectedBranch =
    activeColumn === "local"
      ? selectBranch(localBranches, localIndex)
      : selectBranch(remoteBranches, remoteIndex);
  const hiddenRemoteCount = Math.max(remoteTotalCount - remoteBranches.length, 0);

  return (
    <ModalFrame
      title="Branch list"
      subtitle="Pick a base or head directly from git refs."
      theme={theme}
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
        borderColor={theme.border}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={1}
      >
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.warning}>base</span>
          <span>{` ${base}`}</span>
          <span>{"  •  "}</span>
          <span fg={theme.accent}>head</span>
          <span>{` ${head}`}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          {localBranches.length} local • {remoteBranches.length}/{remoteTotalCount} remote shown
          {showAllRemoteBranches
            ? "  •  all remotes visible"
            : hiddenRemoteCount > 0
              ? `  •  ${hiddenRemoteCount} hidden without open PRs`
              : "  •  focused on active/default remotes"}
        </text>
      </box>

      <box width="100%" flexDirection="row" gap={2}>
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
          title={showAllRemoteBranches ? "Remote branches" : "Remote branches with context"}
          branches={remoteBranches}
          selectedIndex={remoteIndex}
          isActive={activeColumn === "remote"}
          base={base}
          head={head}
          theme={theme}
        />
      </box>

      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={selectedBranch?.pullRequest != null ? theme.success : theme.borderActive}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <text fg={theme.text} wrapMode="none">
            Selected {activeColumn} branch
          </text>
          <text fg={theme.textMuted} wrapMode="none">
            <KeyCap label="tab" theme={theme} />
            <span>{" switch columns"}</span>
          </text>
        </box>

        {selectedBranch != null ? (
          <>
            <text fg={theme.text} wrapMode="none">
              <BranchName branch={selectedBranch} fg={theme.text} theme={theme} />
              <BranchBadges branch={selectedBranch} base={base} head={head} theme={theme} />
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <span>{`sha ${shortSha(selectedBranch.sha)}`}</span>
              {selectedBranch.upstream != null ? (
                <span>{`  •  upstream ${selectedBranch.upstream}`}</span>
              ) : null}
              {selectedBranch.remoteName != null ? (
                <span>{`  •  remote ${selectedBranch.remoteName}`}</span>
              ) : null}
            </text>
            {selectedBranch.pullRequest != null ? (
              <>
                <text fg={theme.text} wrapMode="none">
                  <Tag
                    label={`OPEN PR #${selectedBranch.pullRequest.number}`}
                    fg={theme.inverseText}
                    bg={theme.success}
                  />
                  <span> </span>
                  <span>{selectedBranch.pullRequest.title}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  {selectedBranch.pullRequest.headRefName} -&gt;{" "}
                  {selectedBranch.pullRequest.baseRefName}
                </text>
              </>
            ) : (
              <text fg={theme.textMuted} wrapMode="none">
                No open GitHub pull request metadata for this branch.
              </text>
            )}
          </>
        ) : (
          <text fg={theme.textMuted}>Nothing to show.</text>
        )}

        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="enter / b" theme={theme} />
          <span>{" set base  "}</span>
          <KeyCap label="h" theme={theme} />
          <span>{" set head  "}</span>
          <KeyCap label="o" theme={theme} />
          <span>{showAllRemoteBranches ? " hide extra remotes" : " show all remotes"}</span>
        </text>
      </box>
    </ModalFrame>
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
  theme: UiTheme;
}) {
  return (
    <box
      width="50%"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={isActive ? theme.borderActive : theme.border}
      backgroundColor={theme.surface}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={1}
    >
      <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
        <text fg={isActive ? theme.accent : theme.text} wrapMode="none">
          {title}
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          {branches.length}
        </text>
      </box>
      {branches.length === 0 ? <text fg={theme.textMuted}>Nothing to show.</text> : null}
      {branches.map((branch, index) => {
        const isSelected = index === selectedIndex;
        const fg = isSelected ? theme.accent : theme.text;

        return (
          <box
            key={branch.ref}
            width="100%"
            backgroundColor={isSelected ? theme.surfaceMuted : undefined}
            paddingLeft={1}
            paddingRight={1}
          >
            <text fg={fg} wrapMode="none">
              <BranchName branch={branch} fg={fg} theme={theme} />
              <BranchBadges branch={branch} base={base} head={head} theme={theme} compact />
            </text>
          </box>
        );
      })}
    </box>
  );
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
          <span>{" branch list  "}</span>
          <KeyCap label="tab" theme={theme} />
          <span>{" switch branch columns  "}</span>
          <KeyCap label="b / h" theme={theme} />
          <span>{" set base / head"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="o" theme={theme} />
          <span>{" toggle extra remotes  "}</span>
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
}: {
  branch: BranchInfo;
  base: string;
  head: string;
  theme: UiTheme;
  compact?: boolean;
}) {
  return (
    <>
      {branch.pullRequest != null ? (
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

function selectBranch(branches: readonly BranchInfo[], index: number): BranchInfo | undefined {
  if (branches.length === 0) {
    return undefined;
  }

  return branches[Math.max(0, Math.min(index, branches.length - 1))];
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
