import type { UiTheme } from "../theme.ts";
import { AsciiLoadingLabel } from "../components/ascii-loading-pane.tsx";
import { TextInputContent } from "../components/text-input-content.tsx";
import { formatReviewEvent, getReviewSubmissionEvent } from "./formatting.ts";
import { MODAL_OVERLAY, REVIEW_BORDER } from "./shared.tsx";

export function SubmitReviewModal({
  body,
  bodyCursorOffset,
  eventIndex,
  isSubmitting,
  theme,
}: {
  body: string;
  bodyCursorOffset: number;
  eventIndex: number;
  isSubmitting: boolean;
  theme: UiTheme;
}) {
  const events = [0, 1, 2].map((index) => getReviewSubmissionEvent(index));

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
        width="88%"
        maxWidth={96}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="column">
            <text fg={theme.accent} wrapMode="none">
              Submit Review
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              Submit the current review to GitHub.
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" up/down "}
            </span>
            <span>{" choose event  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" leader+j/k "}
            </span>
            <span>{" move while typing  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" ctrl+e "}
            </span>
            <span>{" editor  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" enter "}
            </span>
            <span>{" submit  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" esc "}
            </span>
            <span>{" close"}</span>
          </text>
        </box>
        <box width="100%" flexDirection="column" gap={0}>
          {events.map((event, index) => {
            const isSelected = index === eventIndex;
            const accent =
              event === "APPROVE"
                ? theme.success
                : event === "REQUEST_CHANGES"
                  ? theme.danger
                  : theme.accent;

            return (
              <box
                key={event}
                width="100%"
                border={["left"]}
                customBorderChars={REVIEW_BORDER}
                borderColor={isSelected ? accent : theme.border}
                backgroundColor={isSelected ? theme.surfaceMuted : theme.surface}
                paddingLeft={2}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
              >
                <text fg={isSelected ? theme.text : theme.textMuted} wrapMode="none">
                  <span fg={accent}>{isSelected ? "> " : "  "}</span>
                  <span>{formatReviewEvent(event)}</span>
                </text>
              </box>
            );
          })}
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
          minHeight={6}
        >
          <text fg={theme.text} wrapMode="word">
            <TextInputContent
              cursorColor={theme.accent}
              cursorOffset={bodyCursorOffset}
              value={body}
            />
          </text>
        </box>
        {isSubmitting ? (
          <AsciiLoadingLabel color={theme.accent} message="Submitting review..." theme={theme} />
        ) : (
          <text fg={theme.textMuted} wrapMode="none">
            Optional review summary. Use shift+enter for a newline or ctrl+e for the external
            editor.
          </text>
        )}
      </box>
    </box>
  );
}
