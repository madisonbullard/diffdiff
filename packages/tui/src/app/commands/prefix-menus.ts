import { formatPrefixedActionBindings } from "../keymap/display.ts";
import { getKeymapPrefix, type KeymapPrefixId } from "../keymap/prefixes.ts";
import type { ReverseKeymaps } from "../keymap/types.ts";
import type { KeymapMode } from "../shell/keymap-mode.ts";
import type { AppCommand } from "./registry.ts";

export interface PrefixMenuConfig {
  badgeLabel: string;
  cancelStatus: string;
  getUnboundStatus: (keyName: string) => string;
  nodeLabel: string;
  onEnterMode?: (controls: { clearPrefixMode: (status?: string) => void }) => void | (() => void);
  pickerDescription?: string;
  pickerTitle?: string;
  preserveFocusByDefault?: boolean;
  prefix: KeymapPrefixId;
}

export interface PrefixMenuCommand {
  command: AppCommand;
  label: string;
}

const PREFIX_MENUS: readonly PrefixMenuConfig[] = [
  {
    badgeLabel: "LEADER",
    cancelStatus: "Canceled leader key.",
    getUnboundStatus: (keyName) => `No command is bound to leader ${keyName}.`,
    nodeLabel: getKeymapPrefix("leader").nodeLabel,
    onEnterMode: ({ clearPrefixMode }) => {
      const timeout = setTimeout(() => {
        clearPrefixMode("Leader key timed out.");
      }, 2_000);

      return () => clearTimeout(timeout);
    },
    prefix: "leader",
    preserveFocusByDefault: false,
  },
  {
    badgeLabel: "SPACE",
    cancelStatus: "Canceled modal picker.",
    getUnboundStatus: (keyName) => `No modal is bound to space ${keyName}.`,
    nodeLabel: getKeymapPrefix("space").nodeLabel,
    pickerDescription: "Press a key to open a modal.",
    pickerTitle: "Modal Picker",
    prefix: "space",
    preserveFocusByDefault: true,
  },
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
  if (prefixMenu == null) {
    return [];
  }

  return commands.flatMap((command) => {
    const label = formatPrefixedActionBindings(
      reverseKeymaps,
      command.value,
      prefixMenu.nodeLabel,
      mode,
    );
    if (label == null) {
      return [];
    }

    return [
      {
        command,
        label,
      },
    ];
  });
}
