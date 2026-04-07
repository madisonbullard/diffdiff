import { formatDisplayKeySequence } from "../keymap/display.ts";
import { parseKeyString } from "../keymap/key-event.ts";
import { getKeymapPrefix, type KeymapPrefixId } from "../keymap/prefixes.ts";
import type { KeyTrieEntry, KeyTrieNode, ResolvedKeymaps } from "../keymap/types.ts";
import { NO_OP_ACTION } from "../keymap/types.ts";
import type { KeymapMode } from "../shell/keymap-mode.ts";
import type { AppCommand } from "./registry.ts";

export interface PrefixPickerConfig {
  description: string;
  title: string;
}

export interface PrefixMenuConfig {
  badgeLabel: string;
  cancelStatus: string;
  getUnboundStatus: (keyName: string) => string;
  nodeLabel: string;
  onEnterMode?: (controls: { clearPrefixMode: (status?: string) => void }) => void | (() => void);
  picker?: PrefixPickerConfig;
  preserveFocusByDefault?: boolean;
  prefix: KeymapPrefixId;
}

export interface PrefixMenuCommand {
  actionId: string;
  enabled: boolean;
  label: string;
  title: string;
}

interface PrefixMenuDefinition extends Omit<PrefixMenuConfig, "nodeLabel"> {}

interface PrefixPickerMenuDefinition extends Omit<PrefixMenuDefinition, "picker"> {
  picker: Omit<PrefixPickerConfig, "title"> & { title?: string };
}

function definePrefixMenu(config: PrefixMenuDefinition): PrefixMenuConfig {
  return {
    ...config,
    nodeLabel: getKeymapPrefix(config.prefix).nodeLabel,
  };
}

function definePrefixPickerMenu(config: PrefixPickerMenuDefinition): PrefixMenuConfig {
  const keymapPrefix = getKeymapPrefix(config.prefix);

  return definePrefixMenu({
    ...config,
    picker: {
      ...config.picker,
      title: config.picker.title ?? keymapPrefix.nodeLabel,
    },
  });
}

const ACTION_DISPLAY_TITLES: Readonly<Record<string, string>> = {
  "goto.first-file": "Jump to first file",
  "goto.last-file": "Jump to last file",
  "goto.last-accessed-file": "Jump to alternate file",
  "goto.next-hunk": "Jump to next hunk",
  "goto.previous-hunk": "Jump to previous hunk",
  "goto.selected-file-line": "Jump to selected file line",
  "goto.window-bottom": "Jump to bottom",
  "goto.window-center": "Jump to center",
  "goto.window-top": "Jump to top",
};

const PREFIX_MENUS: Readonly<Record<KeymapPrefixId, PrefixMenuConfig>> = {
  leader: definePrefixMenu({
    badgeLabel: "LEADER",
    cancelStatus: "Canceled leader key.",
    getUnboundStatus: (keyName) => `No command is bound to leader ${keyName}.`,
    onEnterMode: ({ clearPrefixMode }) => {
      const timeout = setTimeout(() => {
        clearPrefixMode("Leader key timed out.");
      }, 2_000);

      return () => clearTimeout(timeout);
    },
    prefix: "leader",
    preserveFocusByDefault: false,
  }),
  space: definePrefixPickerMenu({
    badgeLabel: "SPACE",
    cancelStatus: "Canceled modal picker.",
    getUnboundStatus: (keyName) => `No modal is bound to space ${keyName}.`,
    picker: {
      description: "Press a key to open a modal.",
    },
    prefix: "space",
    preserveFocusByDefault: true,
  }),
  g: definePrefixPickerMenu({
    badgeLabel: "GOTO",
    cancelStatus: "Canceled goto picker.",
    getUnboundStatus: (keyName) => `No jump is bound to goto ${keyName}.`,
    picker: {
      description: "Press a key to jump around the comparison.",
    },
    prefix: "g",
  }),
  s: definePrefixPickerMenu({
    badgeLabel: "IN FILE",
    cancelStatus: "Canceled in-file picker.",
    getUnboundStatus: (keyName) => `No in-file jump is bound to s ${keyName}.`,
    picker: {
      description: "Press a key to jump within the selected file.",
    },
    prefix: "s",
  }),
} as const;

export function getPrefixMenuConfig(prefix: KeymapPrefixId): PrefixMenuConfig | undefined {
  return PREFIX_MENUS[prefix];
}

function findLabeledNodes(root: KeyTrieNode | undefined, label: string): KeyTrieNode[] {
  if (root == null) {
    return [];
  }

  const matches: KeyTrieNode[] = [];

  function walk(node: KeyTrieNode): void {
    if (node.label === label) {
      matches.push(node);
    }

    for (const child of node.children.values()) {
      if (child.kind === "node") {
        walk(child);
      }
    }
  }

  walk(root);
  return matches;
}

function groupPrefixLabels(labels: readonly string[]): string {
  return [...new Set(labels)].sort((left, right) => left.localeCompare(right)).join(" / ");
}

function fallbackActionTitle(actionId: string): string {
  return actionId
    .split(".")
    .flatMap((part) => part.split("-"))
    .map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function getActionTitle(actionId: string, command: AppCommand | undefined): string {
  return command?.title ?? ACTION_DISPLAY_TITLES[actionId] ?? fallbackActionTitle(actionId);
}

function getEntryDescriptor(
  entry: KeyTrieEntry,
  serializedKey: string,
  command: AppCommand | undefined,
): { actionId: string; enabled: boolean; title: string } | undefined {
  switch (entry.kind) {
    case "action": {
      if (entry.actionId === NO_OP_ACTION) {
        return undefined;
      }

      return {
        actionId: entry.actionId,
        enabled: command?.enabled !== false,
        title: getActionTitle(entry.actionId, command),
      };
    }
    case "sequence":
      return {
        actionId: entry.actionIds.join(" "),
        enabled: true,
        title: "Multiple commands",
      };
    case "node":
      return {
        actionId: entry.label ?? serializedKey,
        enabled: true,
        title: entry.label ?? "Submenu",
      };
  }
}

export function getPrefixMenuCommands(
  commands: readonly AppCommand[],
  prefix: KeymapPrefixId,
  resolvedKeymaps: ResolvedKeymaps,
  mode: KeymapMode,
): PrefixMenuCommand[] {
  const prefixMenu = getPrefixMenuConfig(prefix);
  if (prefixMenu?.picker == null) {
    return [];
  }

  const commandsByValue = new Map(commands.map((command) => [command.value, command]));
  const groupedCommands = new Map<
    string,
    { actionId: string; enabled: boolean; labels: string[]; title: string }
  >();

  for (const node of findLabeledNodes(resolvedKeymaps.get(mode), prefixMenu.nodeLabel)) {
    for (const [serializedKey, child] of node.children) {
      const descriptor = getEntryDescriptor(
        child,
        serializedKey,
        child.kind === "action" ? commandsByValue.get(child.actionId) : undefined,
      );
      if (descriptor == null) {
        continue;
      }

      const existing = groupedCommands.get(descriptor.actionId);
      const label = formatDisplayKeySequence([parseKeyString(serializedKey)]);

      if (existing == null) {
        groupedCommands.set(descriptor.actionId, {
          ...descriptor,
          labels: [label],
        });
        continue;
      }

      existing.labels.push(label);
      existing.enabled = existing.enabled && descriptor.enabled;
    }
  }

  return [...groupedCommands.values()].map(({ actionId, enabled, labels, title }) => ({
    actionId,
    enabled,
    label: groupPrefixLabels(labels),
    title,
  }));
}
