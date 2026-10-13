import type { GitHubMergeMethod } from "@madisonbullard/diffdiff-core";
import { ModalFrame, SPLIT_BORDER } from "../components/shared.tsx";
import type { UiTheme } from "../theme.ts";

export function MergeConfirmModal({
  autoMerge = false,
  method,
  theme,
}: {
  autoMerge?: boolean;
  method: GitHubMergeMethod | undefined;
  theme: UiTheme;
}) {
  const methodLabel = method ?? "selected";

  return (
    <ModalFrame
      title={autoMerge ? "Confirm Auto-Merge" : "Confirm Merge"}
      subtitle={
        autoMerge
          ? `Press enter again to enable auto-merge with ${methodLabel}.`
          : `Press enter again to merge with ${methodLabel}.`
      }
      theme={theme}
      maxWidth={64}
      width="56%"
      zIndex={56}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" enter "}
          </span>
          <span>{" confirm  "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" esc / q "}
          </span>
          <span>{" back"}</span>
        </text>
      }
    >
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.warning}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={theme.textMuted} wrapMode="word">
          {autoMerge
            ? "GitHub will merge this PR when its required checks and reviews pass. Review the method, title, and body before enabling."
            : "Review the merge method, title, and body in the background form, then confirm to submit."}
        </text>
      </box>
    </ModalFrame>
  );
}
