import type { BranchDialogModels } from "../app/dialogs/dialog-models.ts";
import type { UiTheme } from "../theme.ts";
import type { BranchListFilters, BranchListItem, CommitListItem } from "../types.ts";
import type { TextInputSurface } from "../text-input-surface.ts";
import { getBranchListItemMeta, getBranchListItemTitle } from "./branch-labels.ts";
import { DialogPanel } from "./dialog/panel.tsx";
import { DialogList, DialogRow } from "./dialog/list-view.tsx";
import { useDialogUi } from "./dialog/context.tsx";
import { TextInputContent } from "./text-input-content.tsx";
import { fitText } from "./dialog/text.ts";
import * as A from "../app/keymap/actions.ts";
import { formatCommitListEntry } from "../view-model.ts";
export function BranchModal({
  activeView,
  base,
  branchItems,
  branchIndex,
  commitItems,
  commitIndex,
  commitSearchSurface,
  commitSearchActive,
  filters,
  head,
  theme,
  facetsActive = false,
  facetIndex = 0,
}: {
  activeView: BranchDialogModels["activeView"];
  base: string;
  branchItems: readonly BranchListItem[];
  branchIndex: number;
  commitItems: readonly CommitListItem[];
  commitIndex: number;
  commitSearchSurface: TextInputSurface;
  commitSearchActive: boolean;
  comparisonMode: "range" | "working-tree";
  filters: BranchListFilters;
  head: string;
  localBranchCount: number;
  openPrCount: number;
  remoteBranchCount: number;
  theme: UiTheme;
  facetsActive?: boolean;
  facetIndex?: number;
}) {
  const ui = useDialogUi();
  const index = activeView === "branch" ? branchIndex : commitIndex;
  const length = activeView === "branch" ? branchItems.length : commitItems.length;
  const facets = [
    ["workingTree", "Working tree"],
    ["localBranch", "Local"],
    ["openPr", "PR"],
    ["remoteBranch", "Remote"],
  ] as const;
  return (
    <DialogPanel
      title="Compare"
      context={`${base} ← ${head}`}
      position={`${length ? index + 1 : 0}/${length}`}
      theme={theme}
      actions={
        facetsActive
          ? [
              { action: A.FILTER_TOGGLE, label: "toggle", primary: true },
              { action: A.FILTER_ENABLE_ALL, label: "all" },
              { action: A.FILTER_DISABLE_ALL, label: "none" },
              { action: A.MODAL_DISMISS, label: "done" },
            ]
          : [
              {
                action: A.LIST_ACCEPT,
                label:
                  branchItems[branchIndex]?.kind === "open-pr" && activeView === "branch"
                    ? "open PR"
                    : "set head",
                primary: true,
              },
              { action: A.BRANCH_SELECT_BASE, label: "set base" },
              { action: A.BRANCH_SWITCH_TAB, label: "view" },
              {
                action: activeView === "branch" ? A.BRANCH_OPEN_FILTERS : A.BRANCH_SEARCH,
                label: activeView === "branch" ? "filters" : "search",
              },
            ]
      }
    >
      {(rect) => (
        <>
          <box height={1} flexShrink={0} flexDirection="row">
            <text
              fg={activeView === "branch" ? theme.accent : theme.textMuted}
              onMouseUp={() => ui.run(A.BRANCH_GO_TO_BRANCHES)}
            >
              Branches{" "}
            </text>
            <text
              fg={activeView === "commit" ? theme.accent : theme.textMuted}
              onMouseUp={() => ui.run(A.BRANCH_GO_TO_COMMITS)}
            >
              Commits
            </text>
          </box>
          {activeView === "branch" && !commitSearchActive ? (
            <box height={1} flexShrink={0} flexDirection="row">
              {facets.map(([key, label], i) => (
                <text
                  key={key}
                  fg={facetsActive && facetIndex === i ? theme.accent : theme.textMuted}
                  onMouseUp={() => ui.run(`facet.${key}`)}
                >{`${filters[key] ? "[x]" : "[ ]"} ${label}  `}</text>
              ))}
            </box>
          ) : (
            <text height={1} flexShrink={0} fg={theme.textMuted}>
              <TextInputContent
                showCursor={commitSearchActive}
                surface={commitSearchSurface}
                placeholder={activeView === "branch" ? "/ Search branches…" : "/ Search commits…"}
                placeholderColor={theme.textMuted}
                cursorColor={theme.accent}
              />
            </text>
          )}
          {activeView === "branch" ? (
            <DialogList
              items={branchItems}
              index={branchIndex}
              height={rect.bodyRows - 4}
              theme={theme}
              onMove={(delta) =>
                ui.run(delta > 0 ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(delta))
              }
              render={(item, i) => (
                <DialogRow
                  selected={!facetsActive && i === branchIndex}
                  label={getBranchListItemTitle(item)}
                  right={item.kind}
                  theme={theme}
                  width={rect.innerWidth}
                  onSelect={() =>
                    ui.run(i > index ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(i - index))
                  }
                  onActivate={() => ui.run(A.LIST_ACCEPT)}
                />
              )}
            />
          ) : (
            <DialogList
              items={commitItems}
              index={commitIndex}
              height={rect.bodyRows - 4}
              theme={theme}
              render={(item, i) => (
                <DialogRow
                  selected={i === commitIndex}
                  label={`${item.commit.shortSha} ${item.commit.subject}`}
                  theme={theme}
                  width={rect.innerWidth}
                  onSelect={() =>
                    ui.run(i > index ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(i - index))
                  }
                  onActivate={() => ui.run(A.LIST_ACCEPT)}
                />
              )}
            />
          )}
          <text height={2} flexShrink={0} wrapMode="word" fg={theme.textMuted}>
            {fitText(
              activeView === "branch" && branchItems[branchIndex]
                ? getBranchListItemMeta(branchItems[branchIndex]!, base, head)
                : commitItems[commitIndex]
                  ? `${formatCommitListEntry(commitItems[commitIndex]!.commit)}\n${commitItems[commitIndex]!.commit.author}`
                  : "No comparisons match. Change the filters to show more.",
              rect.innerWidth * 2,
            )}
          </text>
        </>
      )}
    </DialogPanel>
  );
}
