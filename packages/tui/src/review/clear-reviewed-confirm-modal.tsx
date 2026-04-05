import { KeyCap, ModalFrame, SPLIT_BORDER } from "../components/shared.tsx";
import type { UiTheme } from "../theme.ts";

export function ClearReviewedConfirmModal({
  reviewedCount,
  theme,
}: {
  reviewedCount: number;
  theme: UiTheme;
}) {
  const fileLabel = reviewedCount === 1 ? "file" : "files";

  return (
    <ModalFrame
      title="Clear Review Marks"
      subtitle={`Remove the reviewed state from ${reviewedCount} ${fileLabel}?`}
      theme={theme}
      maxWidth={68}
      width="58%"
      zIndex={56}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="enter" theme={theme} />
          <span>{" confirm  "}</span>
          <KeyCap label="esc / q" theme={theme} />
          <span>{" cancel"}</span>
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
          This keeps the current comparison open, but every file will be marked unreviewed.
        </text>
      </box>
    </ModalFrame>
  );
}
