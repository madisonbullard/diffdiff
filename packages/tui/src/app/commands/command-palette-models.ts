import { useEffect, useMemo } from "react";
import { filterCommands } from "../../commands.ts";
import type { TextInputSurface } from "../../text-input-surface.ts";
import { formatCommandBindings } from "../keymap/display.ts";
import type { ReverseKeymaps } from "../keymap/types.ts";
import { getPaletteCommands, type AppCommand } from "./registry.ts";

export interface CommandPaletteModels {
  commandBindingLabels: ReadonlyMap<string, string | undefined>;
  filteredCommands: readonly AppCommand[];
  inputSurface: TextInputSurface;
  selectedIndex: number;
}

export function getCommandPaletteModels({
  commands,
  inputSurface,
  reverseKeymaps,
  selectedIndex,
}: {
  commands: readonly AppCommand[];
  inputSurface: TextInputSurface;
  reverseKeymaps: ReverseKeymaps;
  selectedIndex: number;
}): CommandPaletteModels {
  return {
    commandBindingLabels: new Map(
      commands.map((command) => [command.value, formatCommandBindings(reverseKeymaps, command)]),
    ),
    filteredCommands: filterCommands(getPaletteCommands(commands), inputSurface.value),
    inputSurface,
    selectedIndex,
  };
}

export function useCommandPaletteModels({
  commands,
  inputSurface,
  reverseKeymaps,
  selectedIndex,
  setSelectedIndex,
}: {
  commands: readonly AppCommand[];
  inputSurface: TextInputSurface;
  reverseKeymaps: ReverseKeymaps;
  selectedIndex: number;
  setSelectedIndex: (updater: number | ((currentIndex: number) => number)) => void;
}): CommandPaletteModels {
  const models = useMemo(
    () =>
      getCommandPaletteModels({
        commands,
        inputSurface,
        reverseKeymaps,
        selectedIndex,
      }),
    [commands, inputSurface, reverseKeymaps, selectedIndex],
  );

  useEffect(() => {
    setSelectedIndex((currentIndex) =>
      currentIndex >= models.filteredCommands.length
        ? Math.max(models.filteredCommands.length - 1, 0)
        : currentIndex,
    );
  }, [models.filteredCommands.length, setSelectedIndex]);

  return models;
}
