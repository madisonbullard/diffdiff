import type { UiTheme } from "../theme.ts";
import type { TextInputSurface } from "../text-input-surface.ts";
import { AsciiLoadingLabel } from "../components/ascii-loading-pane.tsx";
import { MULTILINE_TEXT_INPUT_WITH_EDITOR_HINT } from "../components/text-input-hints.ts";
import { TextInputContent } from "../components/text-input-content.tsx";
import { MODAL_OVERLAY, REVIEW_BORDER } from "./shared.tsx";

export function ReviewComposerModal({
  autocomplete,
  autocompleteIndex,
  bodySurface,
  context,
  historyEntryCount,
  isSubmitting,
  theme,
}: {
  autocomplete: import("./composer-autocomplete.ts").ReviewComposerAutocompleteState;
  autocompleteIndex: number;
  bodySurface: TextInputSurface;
  context: {
    snippet: string;
    subtitle: string;
    title: string;
  };
  historyEntryCount: number;
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
              {context.title}
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              {context.subtitle}
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" ctrl+e "}
            </span>
            <span>{" line end  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" leader+e "}
            </span>
            <span>{" editor  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" up/down "}
            </span>
            <span>{" drafts  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" @ "}
            </span>
            <span>{" files  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" enter "}
            </span>
            <span>{" submit  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" shift+enter "}
            </span>
            <span>{" newline  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" ctrl+j "}
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
            {context.snippet}
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
            <TextInputContent cursorColor={theme.accent} surface={bodySurface} />
          </text>
        </box>
        {autocomplete.isVisible ? (
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
            flexDirection="column"
            gap={0}
          >
            <text fg={theme.textMuted} wrapMode="none">
              {autocomplete.options.length === 0
                ? `No files match @${autocomplete.query}.`
                : `Insert file reference for @${autocomplete.query || ""}.`}
            </text>
            {autocomplete.options.map((option, index) => {
              const isSelected = index === autocompleteIndex;
              return (
                <text
                  key={`${option.path}:${option.insertText}`}
                  fg={isSelected ? theme.accent : theme.text}
                  wrapMode="none"
                >
                  <span>{isSelected ? "> " : "  "}</span>
                  <span>{option.insertText}</span>
                </text>
              );
            })}
          </box>
        ) : null}
        {isSubmitting ? (
          <AsciiLoadingLabel
            color={theme.accent}
            message="Submitting review comment..."
            theme={theme}
          />
        ) : (
          <text fg={theme.textMuted} wrapMode="word">
            {historyEntryCount > 0
              ? `Type your comment body. ${historyEntryCount} saved draft${historyEntryCount === 1 ? "" : "s"} available for browsing. ${MULTILINE_TEXT_INPUT_WITH_EDITOR_HINT}`
              : `Type your comment body. Use up/down for recent drafts and @ to reference changed files. ${MULTILINE_TEXT_INPUT_WITH_EDITOR_HINT}`}
          </text>
        )}
      </box>
    </box>
  );
}
