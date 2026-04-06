import type { AppPane } from "../../types.ts";
import type { AppCommand } from "../commands/registry.ts";
import type { KeymapMode } from "../shell/keymap-mode.ts";
import { formatKeySequence } from "./key-event.ts";
import type { KeyEvent, ReverseKeymaps } from "./types.ts";

export function formatDisplayKeySequence(sequence: readonly KeyEvent[]): string {
  return formatKeySequence(sequence);
}

function sortLabels(labels: Iterable<string>): string[] {
  return [...new Set(labels)].sort((left, right) => {
    const leftParts = left.split(" ").length;
    const rightParts = right.split(" ").length;
    if (leftParts !== rightParts) {
      return leftParts - rightParts;
    }
    return left.localeCompare(right);
  });
}

function commandModesForPane(pane: AppPane): readonly KeymapMode[] {
  return pane === "diff" ? ["diff", "thread"] : ["tree"];
}

export function getCommandKeymapModes(
  command: Pick<AppCommand, "keybindingContexts">,
): readonly KeymapMode[] {
  if (command.keybindingContexts == null || command.keybindingContexts.length === 0) {
    return ["diff", "thread", "tree"];
  }

  return [...new Set(command.keybindingContexts.flatMap((pane) => commandModesForPane(pane)))];
}

export function getActionBindingLabels(
  reverseKeymaps: ReverseKeymaps,
  actionId: string,
  modes: readonly KeymapMode[],
): string[] {
  const labels: string[] = [];

  for (const mode of modes) {
    const sequences = reverseKeymaps.get(mode)?.actions.get(actionId) ?? [];
    for (const sequence of sequences) {
      labels.push(formatDisplayKeySequence(sequence));
    }
  }

  return sortLabels(labels);
}

export function formatActionBindings(
  reverseKeymaps: ReverseKeymaps,
  actionId: string,
  modes: readonly KeymapMode[],
): string | undefined {
  const labels = getActionBindingLabels(reverseKeymaps, actionId, modes);
  return labels.length === 0 ? undefined : labels.join(" / ");
}

export function formatCommandBindings(
  reverseKeymaps: ReverseKeymaps,
  command: Pick<AppCommand, "keybindingContexts" | "value">,
): string | undefined {
  return formatActionBindings(reverseKeymaps, command.value, getCommandKeymapModes(command));
}

function sequencesEqual(left: readonly KeyEvent[], right: readonly KeyEvent[]): boolean {
  return (
    left.length === right.length &&
    left.every((event, index) => {
      const candidate = right[index];
      return (
        candidate != null &&
        event.key === candidate.key &&
        event.ctrl === candidate.ctrl &&
        event.meta === candidate.meta &&
        event.shift === candidate.shift
      );
    })
  );
}

function startsWithSequence(sequence: readonly KeyEvent[], prefix: readonly KeyEvent[]): boolean {
  if (prefix.length > sequence.length) {
    return false;
  }

  return sequencesEqual(sequence.slice(0, prefix.length), prefix);
}

export function formatPrefixedActionBindings(
  reverseKeymaps: ReverseKeymaps,
  actionId: string,
  prefixNodeLabel: string,
  mode: KeymapMode,
): string | undefined {
  const prefixSequences = reverseKeymaps.get(mode)?.nodes.get(prefixNodeLabel) ?? [];
  const actionSequences = reverseKeymaps.get(mode)?.actions.get(actionId) ?? [];
  const labels: string[] = [];

  for (const actionSequence of actionSequences) {
    for (const prefixSequence of prefixSequences) {
      if (!startsWithSequence(actionSequence, prefixSequence)) {
        continue;
      }

      const suffix = actionSequence.slice(prefixSequence.length);
      if (suffix.length > 0) {
        labels.push(formatDisplayKeySequence(suffix));
      }
    }
  }

  const sorted = sortLabels(labels);
  return sorted.length === 0 ? undefined : sorted.join(" / ");
}
