import type { GitHubDashboardPullRequest } from "@madisonbullard/diffdiff-core";
import type { UiTheme } from "../theme.ts";
import type { TextInputSurface } from "../text-input-surface.ts";
import { TextInputContent } from "./text-input-content.tsx";
import { DialogPanel } from "./dialog/panel.tsx";
import { DialogList, DialogRow } from "./dialog/list-view.tsx";
import { fitText } from "./dialog/text.ts";
import { useDialogUi } from "./dialog/context.tsx";
import * as A from "../app/keymap/actions.ts";
export function PullRequestListModal({
  draftPrCount,
  isLoading,
  pullRequests,
  reviewRequestedCount,
  searchActive,
  searchSurface,
  selectedIndex,
  theme,
}: {
  draftPrCount: number;
  isLoading: boolean;
  pullRequests: readonly GitHubDashboardPullRequest[];
  reviewRequestedCount: number;
  searchActive: boolean;
  searchSurface: TextInputSurface;
  selectedIndex: number;
  theme: UiTheme;
}) {
  const ui = useDialogUi();
  const selected = pullRequests[selectedIndex];
  return (
    <DialogPanel
      title="GitHub PRs"
      context={`${pullRequests.length} open · ${draftPrCount} draft · ${reviewRequestedCount} requested`}
      theme={theme}
      position={`${pullRequests.length ? selectedIndex + 1 : 0}/${pullRequests.length}`}
      status={isLoading ? "Loading pull requests…" : undefined}
      actions={[
        { action: A.LIST_ACCEPT, label: "open", primary: true },
        { action: A.PR_LIST_SEARCH, label: "search" },
        { action: A.LIST_MOVE_DOWN, label: "move" },
        { action: A.PR_LIST_REFRESH, label: "refresh" },
      ]}
    >
      {(rect) => (
        <>
          <text height={1} flexShrink={0} fg={theme.text}>
            <TextInputContent
              surface={searchSurface}
              showCursor={searchActive}
              placeholder="/ Search pull requests…"
              placeholderColor={theme.textMuted}
              cursorColor={theme.accent}
            />
          </text>
          <DialogList
            items={pullRequests}
            index={selectedIndex}
            height={rect.bodyRows - 3}
            theme={theme}
            empty={
              isLoading
                ? "Loading pull requests..."
                : searchSurface.value
                  ? "No pull requests match the current search."
                  : "No open authored or review-requested pull requests."
            }
            onMove={(delta) =>
              ui.run(delta > 0 ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(delta))
            }
            render={(pr, i) => (
              <DialogRow
                selected={i === selectedIndex}
                label={`#${pr.number} ${pr.title}`}
                right={`${pr.repository.owner}/${pr.repository.repo}${pr.isDraft ? " · draft" : ""}${pr.isReviewRequested ? " · requested" : ""}`}
                width={rect.innerWidth}
                theme={theme}
                onSelect={() =>
                  ui.run(
                    i > selectedIndex ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP,
                    Math.abs(i - selectedIndex),
                  )
                }
                onActivate={() => ui.run(A.LIST_ACCEPT)}
              />
            )}
          />
          <text height={2} flexShrink={0} wrapMode="word" fg={theme.textMuted}>
            {fitText(
              selected
                ? `${selected.title}\n${selected.author.login} · ${selected.repository.owner}/${selected.repository.repo}`
                : "Nothing to show.",
              rect.innerWidth * 2,
            )}
          </text>
        </>
      )}
    </DialogPanel>
  );
}
