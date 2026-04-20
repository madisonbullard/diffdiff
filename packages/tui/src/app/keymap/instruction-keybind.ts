import type { KeymapMode } from "../shell/keymap-mode.ts";
import { getActionBindingSequences, getPrefixedActionBindingSuffixes } from "./display.ts";
import type { KeymapPrefixDefinition } from "./prefixes.ts";
import { parseKeyString } from "./key-event.ts";
import type { KeyEvent, ReverseKeymaps } from "./types.ts";

export function getInstructionActionKeybindLabel(
  reverseKeymaps: ReverseKeymaps | undefined,
  actionId: string,
  modes: readonly KeymapMode[],
  fallbackKeybind: string,
): string {
  const keybindSequence =
    reverseKeymaps == null
      ? undefined
      : choosePreferredSequence(getActionBindingSequences(reverseKeymaps, actionId, modes));

  return formatInstructionSequence(keybindSequence ?? [parseKeyString(fallbackKeybind)]);
}

export function getInstructionPrefixedActionKeybindLabel(
  reverseKeymaps: ReverseKeymaps,
  actionId: string,
  prefix: KeymapPrefixDefinition,
  mode: KeymapMode,
): string | undefined {
  const prefixSequence = [parseKeyString(prefix.triggerKeybind)];
  const suffix = choosePreferredSequence(
    getPrefixedActionBindingSuffixes(reverseKeymaps, actionId, prefix.nodeLabel, mode),
  );

  return suffix == null ? undefined : formatInstructionSequence([...prefixSequence, ...suffix]);
}

function choosePreferredSequence(
  sequences: readonly (readonly KeyEvent[])[],
): readonly KeyEvent[] | undefined {
  return [...sequences].sort(compareInstructionSequences)[0];
}

function compareInstructionSequences(
  left: readonly KeyEvent[],
  right: readonly KeyEvent[],
): number {
  const leftModified = countModifiedKeys(left);
  const rightModified = countModifiedKeys(right);
  if (leftModified !== rightModified) {
    return leftModified - rightModified;
  }

  if (left.length !== right.length) {
    return left.length - right.length;
  }

  return formatInstructionSequence(left).localeCompare(formatInstructionSequence(right));
}

function countModifiedKeys(sequence: readonly KeyEvent[]): number {
  return sequence.reduce(
    (count, event) => count + Number(event.ctrl || event.meta || event.shift),
    0,
  );
}

export function formatInstructionKeybind(keybind: string): string {
  return formatInstructionSequence([parseKeyString(keybind)]);
}

export function formatInstructionSequence(
  sequence: readonly { key: string; ctrl: boolean; meta: boolean; shift: boolean }[],
): string {
  return sequence.map(formatInstructionKeyEvent).join(" ");
}

function formatInstructionKeyEvent(event: {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}): string {
  const tokens: string[] = [];
  if (event.ctrl) {
    tokens.push("Ctrl");
  }
  if (event.meta) {
    tokens.push("Alt");
  }
  if (event.shift) {
    tokens.push("Shift");
  }
  tokens.push(formatInstructionKeyToken(event.key));
  return tokens.join("+");
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
