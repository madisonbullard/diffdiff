import type { AppCommand, BuildAppCommandsOptions } from "../registry.ts";

export function buildSystemCommands({
  onExit,
  openCommandModal,
  openHelp,
  showKeyLegend,
  toggleKeyLegend,
}: Pick<
  BuildAppCommandsOptions,
  "onExit" | "openCommandModal" | "openHelp" | "showKeyLegend" | "toggleKeyLegend"
>): AppCommand[] {
  return [
    {
      category: "System",
      description: "Open the searchable command palette.",
      keybind: "ctrl+p",
      suggested: true,
      title: "Open command palette",
      value: "system.command-palette",
      run: () => openCommandModal(),
    },
    {
      category: "System",
      description: "Show keyboard shortcuts and usage help.",
      keybind: "shift+/,<leader>shift+/,<leader>h",
      keywords: ["?", "shortcuts"],
      suggested: true,
      title: "Open help",
      value: "system.help",
      run: () => openHelp(),
    },
    {
      category: "System",
      description: "Show or hide the shortcut legend in the sidebar.",
      keybind: "z,<leader>z",
      title: showKeyLegend ? "Hide key legend" : "Show key legend",
      value: "system.key-legend",
      run: () => toggleKeyLegend(),
    },
    {
      category: "System",
      description: "Close diffdiff.",
      keybind: "q,<leader>q",
      title: "Quit",
      value: "system.quit",
      run: () => onExit(),
    },
  ];
}
