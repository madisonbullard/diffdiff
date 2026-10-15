import type { GitHubPullRequestRequestedReviewer } from "@madisonbullard/diffdiff-core";
import type { UiTheme } from "../theme.ts";
import { TextInputContent } from "../components/text-input-content.tsx";
import { DialogPanel } from "../components/dialog/panel.tsx";
import { DialogList, DialogRow } from "../components/dialog/list-view.tsx";
import { useDialogUi } from "../components/dialog/context.tsx";
import {
  filterReviewerCandidates,
  getRequestedReviewerLogins,
  reviewerRecommendationLabel,
  type ReviewerPickerState,
} from "../app/review/reviewer-picker-state.ts";
import * as A from "../app/keymap/actions.ts";
export function ReviewerPickerModal({
  picker,
  requests,
  theme,
}: {
  picker: ReviewerPickerState;
  requests: readonly GitHubPullRequestRequestedReviewer[];
  theme: UiTheme;
}) {
  const ui = useDialogUi();
  const users = filterReviewerCandidates(picker, requests);
  const requested = getRequestedReviewerLogins(requests);
  return (
    <DialogPanel
      title="Request reviewers"
      context={`${users.length} matching users · ${picker.selected.size} selected`}
      theme={theme}
      position={`${users.length ? picker.index + 1 : 0}/${users.length}`}
      status={
        picker.error ??
        (picker.isSubmitting
          ? "Requesting reviewers… Esc continues in background"
          : picker.isLoading
            ? "Loading reviewers…"
            : picker.recommendationsUnavailable
              ? "GitHub suggestions unavailable. You can still select reviewers."
              : undefined)
      }
      tone={picker.error ? "danger" : undefined}
      actions={[
        {
          action: A.REVIEWERS_SUBMIT,
          label: "request",
          primary: true,
          disabled: picker.isSubmitting || !picker.selected.size,
        },
        { action: A.LIST_ACCEPT, label: "select", disabled: picker.isSubmitting },
        { action: A.REVIEWERS_REFRESH, label: "reload" },
      ]}
    >
      {(rect) => (
        <>
          <text height={1} flexShrink={0} fg={theme.text}>
            <TextInputContent
              surface={picker.input}
              showCursor={!picker.isSubmitting}
              placeholder="Filter by name or username"
              placeholderColor={theme.textMuted}
              cursorColor={theme.accent}
            />
          </text>
          <DialogList
            items={users}
            index={picker.index}
            height={rect.bodyRows - 3}
            theme={theme}
            empty={picker.isLoading ? "Loading reviewers..." : "No reviewers match this filter."}
            onMove={(delta) =>
              ui.run(delta > 0 ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(delta))
            }
            render={(user, i) => (
              <DialogRow
                selected={picker.index === i}
                onClick={() => ui.run(A.REVIEWERS_TOGGLE_AT, i)}
                label={`${requested.has(user.login.toLowerCase()) || picker.selected.has(user.login.toLowerCase()) ? "[x]" : "[ ]"} ${user.name ? `${user.name} (@${user.login})` : `@${user.login}`}`}
                right={
                  requested.has(user.login.toLowerCase())
                    ? "Requested"
                    : reviewerRecommendationLabel(user)
                }
                theme={theme}
                width={rect.innerWidth}
                onSelect={() =>
                  ui.run(
                    i > picker.index ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP,
                    Math.abs(i - picker.index),
                  )
                }
                onActivate={() => ui.run(A.LIST_ACCEPT)}
              />
            )}
          />
          <text height={2} flexShrink={0} fg={theme.textMuted} wrapMode="word">
            {picker.selected.size
              ? `Selected: ${[...picker.selected].join(", ")}`
              : "Existing review requests are kept. Select people, then request."}
            {picker.recommendationsUnavailable
              ? "\nGitHub suggestions unavailable. You can still select reviewers."
              : ""}
          </text>
        </>
      )}
    </DialogPanel>
  );
}
