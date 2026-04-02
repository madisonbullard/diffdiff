import type { SelectedReviewAnchor } from "../review-anchors.ts";
import type { UiTheme } from "../theme.ts";
import { MODAL_OVERLAY, REVIEW_BORDER } from "./shared.tsx";

export function ReviewComposerModal({
  anchor,
  body,
  isSubmitting,
  theme,
}: {
  anchor: SelectedReviewAnchor;
  body: string;
  isSubmitting: boolean;
  theme: UiTheme;
}) {
  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={55}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width="92%"
        maxWidth={108}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="column">
            <text fg={theme.accent} wrapMode="none">
              Add Comment
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              {`Comment on ${anchor.path}:${anchor.line} (${anchor.side.toLowerCase()}).`}
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" enter "}
            </span>
            <span>{" submit  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" shift+enter "}
            </span>
            <span>{" newline  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" esc "}
            </span>
            <span>{" close"}</span>
          </text>
        </box>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={REVIEW_BORDER}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
        >
          <text fg={theme.text} wrapMode="word">
            {anchor.snippet}
          </text>
        </box>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={REVIEW_BORDER}
          borderColor={theme.borderActive}
          backgroundColor={theme.surfaceMuted}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          minHeight={8}
        >
          <text fg={theme.text} wrapMode="word">
            {body !== "" ? body : ""}
            <span fg={theme.accent}>_</span>
          </text>
        </box>
        <text fg={isSubmitting ? theme.accent : theme.textMuted} wrapMode="none">
          {isSubmitting ? "Submitting review comment..." : "Type your comment body."}
        </text>
      </box>
    </box>
  );
}
