function joinTextInputHints(...hints: string[]): string {
  return hints.filter((hint) => hint.length > 0).join(" ");
}

export const SINGLE_LINE_TEXT_INPUT_HINT = "";

export const SINGLE_LINE_TEXT_INPUT_WITH_EDITOR_HINT = joinTextInputHints(
  SINGLE_LINE_TEXT_INPUT_HINT,
  "Use leader+e for the external editor.",
);

export const MULTILINE_TEXT_INPUT_HINT =
  "Use shift+enter, ctrl+j, alt+enter, or cmd+enter for newlines.";

export const MULTILINE_TEXT_INPUT_WITH_EDITOR_HINT = joinTextInputHints(
  MULTILINE_TEXT_INPUT_HINT,
  "Use leader+e for the external editor.",
);
