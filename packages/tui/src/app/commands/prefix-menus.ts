import { formatPrefixedActionBindings } from "../keymap/display.ts";
import * as A from "../keymap/actions.ts";
import { getKeymapPrefix, type KeymapPrefixId } from "../keymap/prefixes.ts";
import type { ReverseKeymaps } from "../keymap/types.ts";
import type { KeymapMode } from "../shell/keymap-mode.ts";
import type { AppCommand } from "./registry.ts";

export interface PrefixPickerItem {
  actionId: string;
  enabled?: boolean;
  title?: string;
}

export interface PrefixPickerConfig {
  description: string;
  items: readonly PrefixPickerItem[];
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

interface CommandPickerPrefixMenuDefinition extends Omit<PrefixMenuDefinition, "picker"> {
  picker: Omit<PrefixPickerConfig, "title"> & { title?: string };
}

function definePrefixMenu(config: PrefixMenuDefinition): PrefixMenuConfig {
  return {
    ...config,
    nodeLabel: getKeymapPrefix(config.prefix).nodeLabel,
  };
}

function defineCommandPickerPrefixMenu(
  config: CommandPickerPrefixMenuDefinition,
): PrefixMenuConfig {
  const keymapPrefix = getKeymapPrefix(config.prefix);

  return definePrefixMenu({
    ...config,
    picker: {
      ...config.picker,
      title: config.picker.title ?? keymapPrefix.nodeLabel,
    },
  });
}

const SPACE_PICKER_ITEMS: readonly PrefixPickerItem[] = [
  { actionId: A.SYSTEM_DIAGNOSTICS },
  { actionId: A.SYSTEM_HELP },
  { actionId: A.GITHUB_PULL_REQUEST_LIST },
  { actionId: A.GITHUB_COMMENTS },
  { actionId: A.GITHUB_ADD_COMMENT },
  { actionId: A.GITHUB_SUBMIT_REVIEW },
  { actionId: A.GITHUB_MERGE },
  { actionId: A.COMPARISON_LIST },
];

const GOTO_PICKER_ITEMS: readonly PrefixPickerItem[] = [
  { actionId: A.GOTO_FIRST_FILE, title: "Jump to first file" },
  { actionId: A.GOTO_LAST_FILE, title: "Jump to last file" },
  { actionId: A.GOTO_WINDOW_TOP, title: "Jump to top" },
  { actionId: A.GOTO_WINDOW_CENTER, title: "Jump to center" },
  { actionId: A.GOTO_WINDOW_BOTTOM, title: "Jump to bottom" },
  { actionId: A.GOTO_NEXT_HUNK, title: "Jump to next hunk" },
  { actionId: A.GOTO_PREVIOUS_HUNK, title: "Jump to previous hunk" },
  { actionId: A.GOTO_LAST_ACCESSED_FILE, title: "Jump to alternate file" },
];

const IN_FILE_PICKER_ITEMS: readonly PrefixPickerItem[] = [
  { actionId: A.GOTO_SELECTED_FILE_LINE, title: "Jump to selected file line" },
];

const PREFIX_MENUS: readonly PrefixMenuConfig[] = [
  definePrefixMenu({
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
  defineCommandPickerPrefixMenu({
    badgeLabel: "SPACE",
    cancelStatus: "Canceled modal picker.",
    getUnboundStatus: (keyName) => `No modal is bound to space ${keyName}.`,
    picker: {
      description: "Press a key to open a modal.",
      items: SPACE_PICKER_ITEMS,
    },
    prefix: "space",
    preserveFocusByDefault: true,
  }),
  defineCommandPickerPrefixMenu({
    badgeLabel: "GOTO",
    cancelStatus: "Canceled goto picker.",
    getUnboundStatus: (keyName) => `No jump is bound to goto ${keyName}.`,
    picker: {
      description: "Press a key to jump around the comparison.",
      items: GOTO_PICKER_ITEMS,
    },
    prefix: "g",
  }),
  defineCommandPickerPrefixMenu({
    badgeLabel: "IN FILE",
    cancelStatus: "Canceled in-file picker.",
    getUnboundStatus: (keyName) => `No in-file jump is bound to s ${keyName}.`,
    picker: {
      description: "Press a key to jump within the selected file.",
      items: IN_FILE_PICKER_ITEMS,
    },
    prefix: "s",
  }),
] as const;

export function getPrefixMenuConfig(prefix: KeymapPrefixId): PrefixMenuConfig | undefined {
  return PREFIX_MENUS.find((menu) => menu.prefix === prefix);
}

export function getPrefixMenuCommands(
  commands: readonly AppCommand[],
  prefix: KeymapPrefixId,
  reverseKeymaps: ReverseKeymaps,
  mode: KeymapMode,
): PrefixMenuCommand[] {
  const prefixMenu = getPrefixMenuConfig(prefix);
  if (prefixMenu?.picker == null) {
    return [];
  }

  const commandsByValue = new Map(commands.map((command) => [command.value, command]));

  return prefixMenu.picker.items.flatMap((item) => {
    const label = formatPrefixedActionBindings(
      reverseKeymaps,
      item.actionId,
      prefixMenu.nodeLabel,
      mode,
    );
    if (label == null) {
      return [];
    }

    const command = commandsByValue.get(item.actionId);
    const title = item.title ?? command?.title;
    if (title == null) {
      return [];
    }

    return [
      {
        actionId: item.actionId,
        enabled: item.enabled ?? command?.enabled !== false,
        label,
        title,
      },
    ];
  });
}
