import type { AppCommand } from "./registry.ts";
import { findAppCommandByKey, findAppCommandByValue } from "./registry.ts";
import type { CommandKeybindPrefix, KeyboardInput } from "../../commands.ts";
import { matchCommandKeybind } from "../../commands.ts";
import { closeDialog as closeAppDialog, openDialog as openAppDialog } from "../dialogs/stack.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { TextInputPrefixOptions } from "../state/app-props.ts";
import { getPrefixMenuConfig } from "./prefix-menus.ts";

interface CreateCommandActionsOptions {
  getCommands: () => readonly AppCommand[];
  leaderTriggerLabel: string;
  state: DiffdiffAppState;
}

export function createCommandActions({
  getCommands,
  leaderTriggerLabel,
  state,
}: CreateCommandActionsOptions) {
  function clearPrefixMode(status?: string): void {
    state.keybindController.clearPrefixMode(status);
  }

  function enterPrefixMode(
    prefix: CommandKeybindPrefix,
    options: { preserveFocus?: boolean } = {},
  ): void {
    const prefixMenu = getPrefixMenuConfig(prefix);
    if (prefixMenu == null) {
      return;
    }

    state.keybindController.enterPrefixMode(prefix, {
      preserveFocus: options.preserveFocus ?? prefixMenu.preserveFocusByDefault,
      status: prefixMenu.getActivateStatus(
        prefix === "leader" ? leaderTriggerLabel : prefixMenu.statusLabel,
      ),
      onEnter: prefixMenu.onEnterMode,
    });
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
    clearPrefixMode();
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

  function handleTextInputPrefixKey(
    prefix: CommandKeybindPrefix,
    key: KeyboardInput,
    options: TextInputPrefixOptions,
  ): boolean {
    const prefixMenu = getPrefixMenuConfig(prefix);
    if (prefixMenu == null) {
      return false;
    }

    if (matchCommandKeybind(prefixMenu.triggerKeybind, key)) {
      enterPrefixMode(prefix, { preserveFocus: true });
      return true;
    }

    if (!state.keybindController.isPrefixActive(prefix)) {
      return false;
    }

    if (key.name === "escape") {
      clearPrefixMode(prefixMenu.cancelStatus);
      return true;
    }

    if (key.name === "j" && options.onPrefixDown != null) {
      clearPrefixMode();
      options.onPrefixDown();
      return true;
    }

    if (key.name === "k" && options.onPrefixUp != null) {
      clearPrefixMode();
      options.onPrefixUp();
      return true;
    }

    const command = findAppCommandByKey(getCommands(), key, {
      activePane: state.activePane,
      prefix,
    });
    if (command != null) {
      runCommand(command);
      return true;
    }

    clearPrefixMode(prefixMenu.getUnboundStatus(key.name));
    return true;
  }

  function handleTextInputPrefixKeypress(
    key: KeyboardInput,
    options: TextInputPrefixOptions = {},
  ): boolean {
    return handleTextInputPrefixKey("leader", key, options);
  }

  return {
    clearPrefixMode,
    closeCommandModal,
    enterPrefixMode,
    handleTextInputPrefixKeypress,
    openCommandModal,
    runCommand,
    runCommandByValue,
  };
}
