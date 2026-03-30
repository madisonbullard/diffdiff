import type { BranchInfo } from "@diffdiff/core";
import { getFiletypeFromFileName } from "@pierre/diffs";
import type { UiTheme } from "./theme.ts";
import type { PreparedReviewFile } from "./types.ts";

export type BranchColumn = "local" | "remote";

export interface FileCardProps {
  file: PreparedReviewFile;
  isCollapsed: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  theme: UiTheme;
}

export function FileCard({ file, isCollapsed, isReviewed, isSelected, theme }: FileCardProps) {
  const borderColor = isSelected ? theme.borderActive : theme.border;
  const headerBackground = isReviewed ? theme.reviewedBg : theme.surfaceMuted;
  const filetype = getFiletypeFromFileName(file.path);
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
        paddingY={0}
        flexDirection="column"
      >
        <text fg={theme.text} wrapMode="none">
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
        <text fg={theme.textMuted} wrapMode="none">
          {file.isBinary ? "Binary diff" : "GitHub-style unified diff"}
        </text>
      </box>

      {!isCollapsed ? (
        <box width="100%" flexDirection="column">
          {file.isBinary ? (
            <box paddingX={1}>
              <text fg={theme.textMuted}>
                Binary file changed. Content preview is not available yet.
              </text>
            </box>
          ) : null}
          {!file.isBinary && file.patch.trim() === "" ? (
            <box paddingX={1}>
              <text fg={theme.textMuted}>No textual diff available for this file.</text>
            </box>
          ) : null}
          {!file.isBinary && file.patch.trim() !== "" ? (
            <box paddingLeft={1} paddingRight={1}>
              <diff
                diff={file.patch}
                view="unified"
                filetype={filetype}
                showLineNumbers={true}
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
                addedLineNumberBg={theme.reviewedBg}
                removedLineNumberBg={theme.surfaceMuted}
              />
            </box>
          ) : null}
        </box>
      ) : null}
    </box>
  );
}

export function BranchModal({
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
  theme: UiTheme;
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
  theme: UiTheme;
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

export function HelpModal({ theme }: { theme: UiTheme }) {
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
