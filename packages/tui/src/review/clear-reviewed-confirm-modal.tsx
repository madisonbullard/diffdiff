import type { UiTheme } from "../theme.ts";
import { DialogPanel } from "../components/dialog/panel.tsx";
import * as A from "../app/keymap/actions.ts";
export function ClearReviewedConfirmModal({
  reviewedCount,
  theme,
}: {
  reviewedCount: number;
  theme: UiTheme;
}) {
  return (
    <DialogPanel
      title="Clear Review Marks"
      family="confirm"
      contentRows={9}
      tone="warning"
      status="Only review marks change; files and comments are kept."
      theme={theme}
      actions={[
        { action: A.CLEAR_REVIEWED_CONFIRM, label: "clear marks", primary: true, warning: true },
        { action: A.MODAL_DISMISS, label: "cancel" },
      ]}
    >
      <text
        fg={theme.text}
        wrapMode="word"
      >{`Remove the reviewed state from ${reviewedCount} ${reviewedCount === 1 ? "file" : "files"}?\nThe comparison stays open.`}</text>
    </DialogPanel>
  );
}
