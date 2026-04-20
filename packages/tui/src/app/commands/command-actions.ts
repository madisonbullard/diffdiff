import type { AppCommand } from "./registry.ts";
import { findAppCommandByValue } from "./registry.ts";
import { closeDialog as closeAppDialog, openDialog as openAppDialog } from "../dialogs/stack.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { BasicTextInputController } from "../text-input/input-controllers.ts";

interface CreateCommandActionsOptions {
  getCommands: () => readonly AppCommand[];
  inputController: BasicTextInputController;
  state: DiffdiffAppState;
}

export function createCommandActions({
  getCommands,
  inputController,
  state,
}: CreateCommandActionsOptions) {
  function clearPrefixMode(status?: string): void {
    state.keybindController.clearPrefixMode(status);
  }

  function runCommand(command: AppCommand): void {
    if (command.enabled === false) {
      state.setStatusMessage(
        command.disabledReason ?? `${command.title} is not available right now.`,
      );
      return;
    }

    clearPrefixMode();
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "command-palette"));
    inputController.reset();
    command.run();
  }

  function runCommandByValue(value: string): void {
    const command = findAppCommandByValue(getCommands(), value);
    if (command != null) {
      runCommand(command);
    }
  }

  function openCommandModal(): void {
    clearPrefixMode();
    inputController.reset();
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "command-palette"));
    state.setStatusMessage("Opened command palette.");
  }

  function closeCommandModal(): void {
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "command-palette", "dismiss"),
    );
    inputController.reset();
    state.setStatusMessage("Closed command palette.");
  }

  return {
    clearPrefixMode,
    closeCommandModal,
    openCommandModal,
    runCommand,
    runCommandByValue,
  };
}
