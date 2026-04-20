import type { ReverseKeymaps } from "../keymap/index.ts";
import { COMPARISON_REFRESH } from "../keymap/actions.ts";
import { getInstructionActionKeybindLabel } from "../keymap/instruction-keybind.ts";

const REFRESH_KEYMAP_MODES = ["diff", "thread", "tree"] as const;
const DEFAULT_REFRESH_KEYBIND = "shift+r";

export function getRefreshComparisonKeybindLabel(reverseKeymaps?: ReverseKeymaps): string {
  return getInstructionActionKeybindLabel(
    reverseKeymaps,
    COMPARISON_REFRESH,
    REFRESH_KEYMAP_MODES,
    DEFAULT_REFRESH_KEYBIND,
  );
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
