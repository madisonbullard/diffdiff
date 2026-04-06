import { isPrintableKey, type KeyboardInput } from "../../../commands.ts";
import { clampIndex } from "../../../view-model.ts";
import { closeDialog as closeAppDialog } from "../stack.ts";
import type { AppCommand } from "../../commands/registry.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

interface CommandPaletteKeymapOptions {
  filteredCommands: readonly AppCommand[];
  handleTextInputPrefixKeypress: (
    key: KeyboardInput,
    options?: { onPrefixDown?: () => void; onPrefixUp?: () => void },
  ) => boolean;
  runCommand: (command: AppCommand) => void;
  state: DiffdiffAppState;
}

export function createCommandPaletteKeyHandler({
  filteredCommands,
  handleTextInputPrefixKeypress,
  runCommand,
  state,
}: CommandPaletteKeymapOptions) {
  return function handleCommandModalKey(key: KeyboardInput): void {
    if (
      handleTextInputPrefixKeypress(key, {
        onPrefixDown: () => {
          state.setCommandIndex((currentIndex) =>
            clampIndex(currentIndex + 1, filteredCommands.length),
          );
        },
        onPrefixUp: () => {
          state.setCommandIndex((currentIndex) =>
            clampIndex(currentIndex - 1, filteredCommands.length),
          );
        },
      })
    ) {
      return;
    }

    if (key.name === "escape") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "command-palette", "dismiss"),
      );
      state.setCommandQuery("");
      state.setCommandIndex(0);
      state.setStatusMessage("Closed command palette.");
      return;
    }

    if (key.name === "down") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex + 1, filteredCommands.length),
      );
      return;
    }

    if (key.name === "up") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex - 1, filteredCommands.length),
      );
      return;
    }

    if (key.name === "pageup") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex - 10, filteredCommands.length),
      );
      return;
    }

    if (key.name === "pagedown") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex + 10, filteredCommands.length),
      );
      return;
    }

    if (key.name === "home") {
      state.setCommandIndex(0);
      return;
    }

    if (key.name === "end") {
      state.setCommandIndex(Math.max(filteredCommands.length - 1, 0));
      return;
    }

    if (key.name === "backspace") {
      state.setCommandQuery((currentQuery) => currentQuery.slice(0, -1));
      state.setCommandIndex(0);
      return;
    }

    if (key.name === "return") {
      const command = filteredCommands[clampIndex(state.commandIndex, filteredCommands.length)];
      if (command != null) {
        runCommand(command);
      }
      return;
    }

    if (isPrintableKey(key)) {
      state.setCommandQuery((currentQuery) => currentQuery + key.sequence);
      state.setCommandIndex(0);
    }
  };
}
