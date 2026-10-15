import type { GitHubMergeMethod, GitHubPullRequestDetail } from "@madisonbullard/diffdiff-core";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { Ref } from "react";
import type { UiTheme } from "../theme.ts";
import type { TextInputSurface } from "../text-input-surface.ts";
import { DialogPanel } from "../components/dialog/panel.tsx";
import { DialogEditor } from "../components/dialog/editor.tsx";
import { useDialogUi } from "../components/dialog/context.tsx";
import { dialogTokens } from "../components/dialog/tokens.ts";
import { fitText } from "../components/dialog/text.ts";
import { formatMergeMethod, getMergeBlockedReason } from "./formatting.ts";
import * as A from "../app/keymap/actions.ts";
export function MergePullRequestModal({
  autoMerge = false,
  bodySurface,
  canSubmit,
  field,
  isSubmitting,
  method,
  pullRequest,
  theme,
  titleSurface,
  confirming = false,
  cleanupAfterMerge = true,
}: {
  autoMerge?: boolean;
  bodySurface: TextInputSurface;
  bodyScrollRef?: Ref<ScrollBoxRenderable | null>;
  canSubmit: boolean;
  field: "method" | "title" | "body";
  isSubmitting: boolean;
  method: GitHubMergeMethod | null | undefined;
  pullRequest: GitHubPullRequestDetail;
  theme: UiTheme;
  titleSurface: TextInputSurface;
  confirming?: boolean;
  cleanupAfterMerge?: boolean;
}) {
  const ui = useDialogUi();
  const methods = pullRequest.merge.allowedMethods ?? [];
  const blocked =
    method == null ? "Choose an allowed merge method." : getMergeBlockedReason(pullRequest);
  const title = autoMerge ? "Enable Auto-Merge" : "Merge Pull Request";
  return (
    <DialogPanel
      title={title}
      context={`#${pullRequest.number} · ${pullRequest.headRefName} → ${pullRequest.baseRefName}`}
      family="form"
      theme={theme}
      tone={confirming ? "warning" : undefined}
      status={
        isSubmitting
          ? "Sending… input paused · Esc continues in background"
          : confirming
            ? autoMerge
              ? "Press Enter to enable auto-merge. GitHub will wait for requirements to pass."
              : "Press Enter to merge now. This cannot be undone."
            : pullRequest.merge.autoMergeEnabled
              ? "Auto-merge is already enabled."
              : !canSubmit
                ? autoMerge
                  ? pullRequest.merge.autoMergeEnabled
                    ? "Auto-merge is already enabled."
                    : "Auto-merge is unavailable for this pull request."
                  : blocked
                : undefined
      }
      actions={[
        {
          action: A.MERGE_CONFIRM,
          label: confirming ? (autoMerge ? "enable auto-merge" : "merge now") : "continue",
          primary: true,
          warning: confirming,
          disabled: !canSubmit || isSubmitting,
        },
        ...(confirming
          ? [{ action: A.MODAL_DISMISS, label: "back to editing" }]
          : [
              { action: A.MERGE_NEXT_FIELD, label: "field" },
              { action: A.MERGE_TOGGLE_AUTO, label: "auto-merge" },
              { action: A.MERGE_TOGGLE_CLEANUP, label: "cleanup", disabled: autoMerge },
            ]),
      ]}
    >
      {(rect) => (
        <>
          <text
            height={1}
            flexShrink={0}
            fg={field === "method" ? theme.accent : theme.textMuted}
          >{`Method  ${methods.length ? methods.map((value) => `${value === method ? "●" : "○"} ${formatMergeMethod(value)}`).join("   ") : "No allowed merge methods"}`}</text>
          <text height={1} flexShrink={0} fg={theme.textMuted}>
            Commit title
          </text>
          <DialogEditor
            surface={titleSurface}
            height={1}
            width={rect.innerWidth}
            focused={field === "title" && !confirming}
            paused={isSubmitting}
            theme={theme}
          />
          <text height={1} flexShrink={0} fg={theme.textMuted}>
            Commit message
          </text>
          <DialogEditor
            surface={bodySurface}
            height={rect.bodyRows - 8}
            width={rect.innerWidth}
            focused={field === "body" && !confirming}
            paused={isSubmitting}
            theme={theme}
          />
          <text
            height={1}
            flexShrink={0}
            fg={theme.text}
            onMouseUp={() => {
              if (!confirming) ui.run(A.MERGE_TOGGLE_AUTO);
            }}
          >{`[${autoMerge ? "x" : " "}] Auto-merge`}</text>
          <text
            height={1}
            flexShrink={0}
            fg={autoMerge ? theme.textMuted : theme.text}
            onMouseUp={() => {
              if (!confirming) ui.run(A.MERGE_TOGGLE_CLEANUP);
            }}
          >{`[${cleanupAfterMerge && !autoMerge ? "x" : " "}] Clean up local refs after merge${autoMerge ? " · unavailable with auto-merge" : ""}`}</text>
          <text
            height={2}
            flexShrink={0}
            fg={theme.textMuted}
            bg={confirming ? dialogTokens(theme).warning : undefined}
            wrapMode="word"
          >
            {fitText(
              autoMerge
                ? "GitHub merges when checks and review requirements pass. No local cleanup runs later."
                : `${pullRequest.headRefName} + tracking ref · only if GitHub deletes the branch. Checked-out branches and extra commits are kept.`,
              rect.innerWidth * 2,
            )}
          </text>
        </>
      )}
    </DialogPanel>
  );
}
