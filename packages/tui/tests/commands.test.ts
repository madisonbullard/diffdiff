import { expect, test } from "vite-plus/test";
import { filterCommands, formatCommandKeybind, type CommandDefinition } from "../src/commands.ts";

const commands: CommandDefinition[] = [
  {
    category: "System",
    description: "Show keyboard shortcuts and usage help.",
    keybind: "shift+/,<leader>h",
    keywords: ["shortcuts"],
    title: "Open help",
    value: "system.help",
  },
  {
    category: "GitHub",
    disabledReason: "Open a GitHub pull request first.",
    enabled: false,
    keybind: "<leader>m,m",
    title: "Merge pull request",
    value: "github.merge",
  },
];

test("filterCommands matches command ids and keywords", () => {
  expect(filterCommands(commands, "system.help").map((command) => command.value)).toEqual([
    "system.help",
  ]);
  expect(filterCommands(commands, "shortcuts").map((command) => command.value)).toEqual([
    "system.help",
  ]);
});

test("filterCommands keeps enabled commands ahead of disabled ones", () => {
  expect(filterCommands(commands, "").map((command) => command.value)).toEqual([
    "system.help",
    "github.merge",
  ]);
});

test("formatCommandKeybind prints question mark shortcuts cleanly", () => {
  expect(formatCommandKeybind("shift+/,<leader>h", "ctrl+x")).toBe("?");
});
