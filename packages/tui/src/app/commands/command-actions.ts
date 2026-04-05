import type { AppCommand } from "./registry.ts";
import { findAppCommandByValue } from "./registry.ts";
import type { KeyboardInput } from "../../commands.ts";
import { matchCommandKeybind } from "../../commands.ts";
import { LEADER_KEYBIND } from "../shared/constants.ts";
import { closeDialog as closeAppDialog, openDialog as openAppDialog } from "../dialogs/stack.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { TextInputLeaderOptions } from "../state/app-props.ts";

interface CreateCommandActionsOptions {
  getCommands: () => readonly AppCommand[];
  leaderKeyLabel: string;
  state: DiffdiffAppState;
}

export function createCommandActions({
  getCommands,
  leaderKeyLabel,
  state,
}: CreateCommandActionsOptions) {
  function clearTransientMode(status?: string): void {
    state.keybindController.clearTransientMode(status);
  }

  function clearLeaderMode(status?: string): void {
    state.keybindController.clearLeaderMode(status);
  }

  function clearModalPickerMode(status?: string): void {
    state.keybindController.clearModalPickerMode(status);
  }

  function enterLeaderMode(options: { preserveFocus?: boolean } = {}): void {
    state.keybindController.enterLeaderMode({
      preserveFocus: options.preserveFocus,
      status: `Leader key active. Awaiting a ${leaderKeyLabel} command.`,
      timeoutStatus: "Leader key timed out.",
    });
  }

  function enterModalPickerMode(): void {
    state.keybindController.enterModalPickerMode({
      preserveFocus: true,
      status: "Modal picker active. Awaiting a space command.",
      timeoutStatus: "Modal picker timed out.",
    });
  }

  function runCommand(command: AppCommand): void {
    if (command.enabled === false) {
      state.setStatusMessage(
        command.disabledReason ?? `${command.title} is not available right now.`,
      );
      return;
    }

    clearTransientMode();
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "command-palette"));
    state.setCommandQuery("");
    state.setCommandIndex(0);
    command.run();
  }

  function runCommandByValue(value: string): void {
    const command = findAppCommandByValue(getCommands(), value);
    if (command != null) {
      runCommand(command);
    }
  }

  function openCommandModal(): void {
    clearTransientMode();
    state.setCommandQuery("");
    state.setCommandIndex(0);
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "command-palette"));
    state.setStatusMessage("Opened command palette.");
  }

  function closeCommandModal(): void {
    state.setDialogStack((currentStack) =>
      closeAppDialog(currentStack, "command-palette", "dismiss"),
    );
    state.setCommandQuery("");
    state.setCommandIndex(0);
    state.setStatusMessage("Closed command palette.");
  }

  function handleTextInputLeaderKey(
    key: KeyboardInput,
    options: TextInputLeaderOptions = {},
  ): boolean {
    if (matchCommandKeybind(LEADER_KEYBIND, key)) {
      enterLeaderMode({ preserveFocus: true });
      return true;
    }

    if (!state.keybindController.isLeaderActive()) {
      return false;
    }

    if (key.name === "escape") {
      clearLeaderMode("Canceled leader key.");
      return true;
    }

    if (key.name === "j" && options.onLeaderDown != null) {
      clearLeaderMode();
      options.onLeaderDown();
      return true;
    }

    if (key.name === "k" && options.onLeaderUp != null) {
      clearLeaderMode();
      options.onLeaderUp();
      return true;
    }

    const command = getCommands().find(
      (candidate) =>
        candidate.enabled !== false && matchCommandKeybind(candidate.keybind, key, true),
    );
    if (command != null) {
      runCommand(command);
      return true;
    }

    clearLeaderMode(`No command is bound to ${leaderKeyLabel} ${key.name}.`);
    return true;
  }

  return {
    clearModalPickerMode,
    clearLeaderMode,
    clearTransientMode,
    closeCommandModal,
    enterLeaderMode,
    enterModalPickerMode,
    handleTextInputLeaderKey,
    openCommandModal,
    runCommand,
    runCommandByValue,
  };
}
