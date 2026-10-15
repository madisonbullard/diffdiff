import type { UiTheme } from "../theme.ts";
import type { TextInputSurface } from "../text-input-surface.ts";
import { DialogPanel } from "../components/dialog/panel.tsx";
import { DialogEditor } from "../components/dialog/editor.tsx";
import { DialogRow } from "../components/dialog/list-view.tsx";
import { useDialogUi, primaryBinding } from "../components/dialog/context.tsx";
import { formatReviewEvent, getReviewSubmissionEvent } from "./formatting.ts";
import * as A from "../app/keymap/actions.ts";
export function SubmitReviewModal({
  bodySurface,
  eventIndex,
  isSubmitting,
  theme,
  field = "event",
}: {
  bodySurface: TextInputSurface;
  eventIndex: number;
  isSubmitting: boolean;
  theme: UiTheme;
  field?: "event" | "body";
}) {
  const ui = useDialogUi();
  return (
    <DialogPanel
      title="Submit Review"
      family="form"
      theme={theme}
      status={isSubmitting ? "Submitting… input paused · Esc continues in background" : undefined}
      actions={[
        {
          action: A.SUBMIT_REVIEW_SUBMIT,
          label: "submit",
          primary: true,
          disabled: isSubmitting || (eventIndex === 2 && !bodySurface.value.trim()),
        },
        { action: A.REVIEW_SWITCH_FIELD, label: "field" },
        ...(field === "body"
          ? [
              { action: A.TEXT_NEWLINE, label: "newline" },
              { action: A.TEXT_OPEN_EXTERNAL_EDITOR, label: "editor" },
            ]
          : [{ action: A.LIST_MOVE_DOWN, label: "choose event" }]),
      ]}
    >
      {(rect) => (
        <>
          <text height={1} flexShrink={0} fg={theme.textMuted}>
            Event
          </text>
          {[0, 1, 2].map((i) => (
            <DialogRow
              key={i}
              selected={i === eventIndex}
              label={`${field === "event" && i === eventIndex ? "● " : "○ "}${formatReviewEvent(getReviewSubmissionEvent(i))}`}
              width={rect.innerWidth}
              theme={theme}
              onSelect={() =>
                ui.run(i > eventIndex ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(i - eventIndex))
              }
            />
          ))}
          <text height={1} flexShrink={0} fg={field === "body" ? theme.accent : theme.textMuted}>
            Summary · optional for Comment and Approve
          </text>
          <DialogEditor
            surface={bodySurface}
            height={rect.bodyRows - 6}
            width={rect.innerWidth}
            focused={field === "body"}
            paused={isSubmitting}
            theme={theme}
            placeholder="Add a review summary…"
            onFocus={() => {
              if (field !== "body") ui.run(A.REVIEW_SWITCH_FIELD);
            }}
          />
          <text height={1} flexShrink={0} fg={theme.textMuted}>
            {eventIndex === 2
              ? "Request changes blocks merging; a summary is required."
              : field === "body"
                ? `${primaryBinding(ui, A.TEXT_NEWLINE) ?? ""} newline · typing edits only the summary`
                : eventIndex === 1
                  ? "Approve this PR; your approval is recorded on GitHub."
                  : "Comment without approving or requesting changes."}
          </text>
        </>
      )}
    </DialogPanel>
  );
}
