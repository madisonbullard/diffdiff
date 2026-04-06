import {
  formatParsedCommandKeybind,
  getCommandBindingsForPrefix,
  matchCommandKeybind,
  type CommandKeybindPrefix,
  type KeyboardInput,
} from "../../commands.ts";
import { LEADER_KEYBIND } from "../shared/constants.ts";
import type { AppCommand } from "./registry.ts";

export interface PrefixMenuConfig {
  badgeLabel: string;
  cancelStatus: string;
  getActivateStatus: (triggerLabel: string) => string;
  getUnboundStatus: (keyName: string) => string;
  onEnterMode?: (controls: { clearPrefixMode: (status?: string) => void }) => void | (() => void);
  pickerDescription?: string;
  pickerTitle?: string;
  preserveFocusByDefault?: boolean;
  prefix: CommandKeybindPrefix;
  statusLabel: string;
  triggerKeybind: string;
}

export interface PrefixMenuCommand {
  command: AppCommand;
  label: string;
}

const PREFIX_MENUS: readonly PrefixMenuConfig[] = [
  {
    badgeLabel: "LEADER",
    cancelStatus: "Canceled leader key.",
    getActivateStatus: (triggerLabel) => `Leader key active. Awaiting a ${triggerLabel} command.`,
    getUnboundStatus: (keyName) => `No command is bound to leader ${keyName}.`,
    onEnterMode: ({ clearPrefixMode }) => {
      const timeout = setTimeout(() => {
        clearPrefixMode("Leader key timed out.");
      }, 2_000);

      return () => clearTimeout(timeout);
    },
    prefix: "leader",
    preserveFocusByDefault: false,
    statusLabel: "leader",
    triggerKeybind: LEADER_KEYBIND,
  },
  {
    badgeLabel: "SPACE",
    cancelStatus: "Canceled modal picker.",
    getActivateStatus: () => "modal picker active. Awaiting a space command.",
    getUnboundStatus: (keyName) => `No modal is bound to space ${keyName}.`,
    pickerDescription: "Press a key to open a modal.",
    pickerTitle: "Modal Picker",
    prefix: "space",
    preserveFocusByDefault: true,
    statusLabel: "space",
    triggerKeybind: "space",
  },
] as const;

export function getPrefixMenuConfig(prefix: CommandKeybindPrefix): PrefixMenuConfig | undefined {
  return PREFIX_MENUS.find((menu) => menu.prefix === prefix);
}

export function getPrefixMenuByTriggerKey(input: KeyboardInput): PrefixMenuConfig | undefined {
  return PREFIX_MENUS.find((menu) => matchCommandKeybind(menu.triggerKeybind, input));
}

export function getPrefixMenuCommands(
  commands: readonly AppCommand[],
  prefix: CommandKeybindPrefix,
): PrefixMenuCommand[] {
  return commands.flatMap((command) => {
    const [binding] = getCommandBindingsForPrefix(command.keybind, prefix);
    if (binding == null) {
      return [];
    }

    return [
      {
        command,
        label: formatParsedCommandKeybind(binding, { leaderKeybind: LEADER_KEYBIND }),
      },
    ];
  });
}
