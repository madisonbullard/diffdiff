import type { ReverseKeymaps } from "../keymap/index.ts";
import { COMPARISON_REFRESH } from "../keymap/actions.ts";
import { getActionBindingLabels } from "../keymap/display.ts";

const REFRESH_KEYMAP_MODES = ["diff", "thread", "tree"] as const;
const DEFAULT_REFRESH_KEYBIND = "shift+r";

export function getRefreshComparisonKeybindLabel(reverseKeymaps?: ReverseKeymaps): string {
  const keybind =
    reverseKeymaps == null
      ? undefined
      : REFRESH_KEYMAP_MODES.map(
          (mode) => getActionBindingLabels(reverseKeymaps, COMPARISON_REFRESH, [mode])[0],
        ).find((label) => label != null);

  return formatInstructionKeybind(keybind ?? DEFAULT_REFRESH_KEYBIND);
}

export function withRefreshComparisonHint(
  message: string,
  reverseKeymaps?: ReverseKeymaps,
  options?: { retry?: boolean },
): string {
  const keybindLabel = getRefreshComparisonKeybindLabel(reverseKeymaps);
  const action = options?.retry === true ? "refresh and try again" : "refresh";
  const instruction = `Press ${keybindLabel} to ${action}.`;

  if (options?.retry === true) {
    return insertInstructionAfterFirstSentence(message, instruction);
  }

  return `${message} ${instruction}`;
}

function insertInstructionAfterFirstSentence(message: string, instruction: string): string {
  const firstSentenceEnd = message.indexOf(".");
  if (firstSentenceEnd < 0) {
    return `${message} ${instruction}`;
  }

  const firstSentence = message.slice(0, firstSentenceEnd + 1);
  const remainder = message.slice(firstSentenceEnd + 1).trimStart();
  return remainder === ""
    ? `${firstSentence} ${instruction}`
    : `${firstSentence} ${instruction} ${remainder}`;
}

function formatInstructionKeybind(keybind: string): string {
  return keybind
    .split(" ")
    .map((chord) => chord.split("+").map(formatInstructionKeyToken).join("+"))
    .join(" ");
}

function formatInstructionKeyToken(token: string): string {
  switch (token) {
    case "alt":
      return "Alt";
    case "ctrl":
      return "Ctrl";
    case "delete":
    case "del":
      return "Del";
    case "escape":
      return "Esc";
    case "return":
      return "Enter";
    case "shift":
      return "Shift";
    case "space":
      return "Space";
    default:
      return token.length === 1
        ? token.toUpperCase()
        : `${token[0]!.toUpperCase()}${token.slice(1)}`;
  }
}
