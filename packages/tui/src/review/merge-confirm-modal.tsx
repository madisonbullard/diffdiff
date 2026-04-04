import type { GitHubMergeMethod } from "@diffdiff/core";
import { ModalFrame, SPLIT_BORDER } from "../components/shared.tsx";
import type { UiTheme } from "../theme.ts";

export function MergeConfirmModal({
  method,
  theme,
}: {
  method: GitHubMergeMethod | undefined;
  theme: UiTheme;
}) {
  const methodLabel = method ?? "selected";

  return (
    <ModalFrame
      title="Confirm Merge"
      subtitle={`Press enter again to merge with ${methodLabel}.`}
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
          Review the merge method, title, and body in the background form, then confirm to submit.
        </text>
      </box>
    </ModalFrame>
  );
}
