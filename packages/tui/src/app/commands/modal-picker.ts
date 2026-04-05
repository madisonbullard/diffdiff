import { formatCommandKeybind, matchCommandKeybind, type KeyboardInput } from "../../commands.ts";
import type { AppCommand } from "./registry.ts";

export interface ModalPickerCommand {
  command: AppCommand;
  keybind: string;
  label: string;
}

const MODAL_PICKER_COMMAND_ORDER = [
  "comparison.list",
  "github.pull-request-list",
  "github.comments",
  "github.add-comment",
  "github.submit-review",
  "github.merge",
  "system.help",
  "system.diagnostics",
] as const;

const MODAL_PICKER_ORDER_INDEX = new Map<string, number>(
  MODAL_PICKER_COMMAND_ORDER.map((value, index) => [value, index]),
);

export function getModalPickerCommands(commands: readonly AppCommand[]): ModalPickerCommand[] {
  return commands
    .filter(
      (command): command is AppCommand & { modalKeybind: string } => command.modalKeybind != null,
    )
    .map((command) => ({
      command,
      keybind: command.modalKeybind,
      label: formatCommandKeybind(command.modalKeybind, "leader") ?? command.modalKeybind,
    }))
    .sort((left, right) => {
      const leftOrder = MODAL_PICKER_ORDER_INDEX.get(left.command.value) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder =
        MODAL_PICKER_ORDER_INDEX.get(right.command.value) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.command.title.localeCompare(right.command.title);
    });
}

export function findModalPickerCommandByKey(
  commands: readonly ModalPickerCommand[],
  input: KeyboardInput,
): AppCommand | undefined {
  return commands.find((command) => matchCommandKeybind(command.keybind, input))?.command;
}
