import { formatCommitListEntry } from "../view-model.ts";
import type { BranchListFilters, BranchListItem, CommitListItem } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import {
  getBranchListItemMeta,
  getBranchListItemTitle,
  BranchListView,
  CategoryPill,
  CommitListView,
  ListViewTab,
} from "./branch-list-view.tsx";
import { KeyCap, ModalFrame, SPLIT_BORDER, selectItem } from "./shared.tsx";
import { SINGLE_LINE_TEXT_INPUT_HINT } from "./text-input-hints.ts";

export function BranchModal({
  activeView,
  base,
  branchItems,
  branchIndex,
  commitItems,
  commitIndex,
  commitSearchQuery,
  commitSearchCursorOffset,
  commitSearchActive,
  comparisonMode,
  filters,
  head,
  localBranchCount,
  openPrCount,
  remoteBranchCount,
  theme,
}: {
  activeView: "branch" | "commit";
  base: string;
  branchItems: readonly BranchListItem[];
  branchIndex: number;
  commitItems: readonly CommitListItem[];
  commitIndex: number;
  commitSearchQuery: string;
  commitSearchCursorOffset: number;
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
          <KeyCap label="left / right" theme={theme} />
          <span>{" panes  "}</span>
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
              const maxLen = Math.max(...tabs.map((tab) => tab.label.length));
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
          searchCursorOffset={commitSearchCursorOffset}
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
              {selectedBranchItem?.kind === "open-pr" ? (
                <>
                  <KeyCap label="enter" theme={theme} />
                  <span>{" open PR review  "}</span>
                </>
              ) : (
                <>
                  <KeyCap label="h" theme={theme} />
                  <span>{" set head  "}</span>
                  <KeyCap label="b" theme={theme} />
                  <span>{" set base  "}</span>
                </>
              )}
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
              <KeyCap label="h" theme={theme} />
              <span>{" set head  "}</span>
              <KeyCap label="b" theme={theme} />
              <span>{" set base  "}</span>
              <span fg={theme.border}>{"\u2502  "}</span>
              <KeyCap label="/" theme={theme} />
              <span>{" search  "}</span>
              <KeyCap label="left / right / tab" theme={theme} />
              <span>{" switch view"}</span>
            </text>
            <text fg={theme.textMuted} wrapMode="word">
              {SINGLE_LINE_TEXT_INPUT_HINT}
            </text>
          </>
        ) : (
          <text fg={theme.textMuted}>Nothing to show.</text>
        )}
      </box>
    </ModalFrame>
  );
}
