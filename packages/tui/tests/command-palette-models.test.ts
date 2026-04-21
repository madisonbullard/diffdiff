import { describe, expect, test, vi } from "vite-plus/test";
import { getCommandPaletteModels } from "../src/app/commands/command-palette-models.ts";
import { createTextInputSurface } from "../src/text-input-surface.ts";

describe("command palette models", () => {
  test("filters palette commands through the view model", () => {
    const models = getCommandPaletteModels({
      commands: [
        {
          category: "System",
          run: vi.fn(),
          title: "Open help",
          value: "system.help",
        },
        {
          category: "System",
          hidden: true,
          run: vi.fn(),
          title: "Hidden command",
          value: "system.hidden",
        },
        {
          category: "Review",
          run: vi.fn(),
          title: "Open review composer",
          value: "review.compose",
        },
      ],
      inputSurface: createTextInputSurface({ cursorOffset: 4, value: "help" }),
      reverseKeymaps: new Map(),
      selectedIndex: 2,
    });

    expect(models.inputSurface).toEqual({ cursorOffset: 4, value: "help" });
    expect(models.filteredCommands.map((command) => command.value)).toEqual(["system.help"]);
    expect(models.commandBindingLabels.get("system.help")).toBeUndefined();
    expect(models.commandBindingLabels.has("system.hidden")).toBe(true);
    expect(models.selectedIndex).toBe(2);
  });
});
