import type { ReactNode } from "react";
import type { TextInputSurface } from "../text-input-surface.ts";
import {
  formatAuthorList,
  formatChangeSummary,
  formatCommitDelta,
  formatCommitListEntry,
} from "../view-model.ts";
import type { BranchListItem, CommitListItem } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import { BranchName, Tag, getRemoteShortName, shortSha, tintHex } from "./shared.tsx";
import { TextInputContent } from "./text-input-content.tsx";

const COMMIT_LIST_MAX_VISIBLE = 7;

export function BranchListView({
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
        <EmptyListNotice message="No items match the current branch filters." theme={theme} />
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

export function CommitListView({
  commitItems,
  searchSurface,
  searchActive,
  selectedIndex,
  theme,
}: {
  commitItems: readonly CommitListItem[];
  searchSurface: TextInputSurface;
  searchActive: boolean;
  selectedIndex: number;
  theme: UiTheme;
}) {
  const searchQuery = searchSurface.value;

  return (
    <box width="100%" flexDirection="column" gap={0}>
      <box
        width="100%"
        border={["left"]}
        customBorderChars={{
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
        }}
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
            <TextInputContent
              cursorColor={theme.accent}
              cursorTextColor={theme.inverseText}
              placeholder={searchActive ? undefined : "search commits..."}
              placeholderColor={theme.textMuted}
              showCursor={searchActive}
              surface={searchSurface}
            />
          </span>
        </text>
      </box>
      {commitItems.length === 0 ? (
        <EmptyListNotice
          message={
            searchQuery !== ""
              ? "No commits match the current search."
              : "No commits to show for the current comparison."
          }
          theme={theme}
        />
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

export function getBranchListItemTitle(item: BranchListItem): string {
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

export function getBranchListItemMeta(item: BranchListItem, base: string, head: string): string {
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

function EmptyListNotice({ message, theme }: { message: string; theme: UiTheme }) {
  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={{
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
      }}
      borderColor={theme.border}
      backgroundColor={theme.surface}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
    >
      <text fg={theme.textMuted}>{message}</text>
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
      customBorderChars={{
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
      }}
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

export function ListViewTab({
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

export function CategoryPill({
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
