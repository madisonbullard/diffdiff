import type { AppCommand, BuildAppCommandsOptions } from "../registry.ts";

export function buildSystemCommands({
  onExit,
  openCommandModal,
  openDiagnostics,
  openHelp,
}: Pick<
  BuildAppCommandsOptions,
  "onExit" | "openCommandModal" | "openDiagnostics" | "openHelp"
>): AppCommand[] {
  return [
    {
      category: "System",
      description: "Open the searchable command palette.",
      suggested: true,
      title: "Open command palette",
      value: "system.command-palette",
      run: () => openCommandModal(),
    },
    {
      category: "System",
      description: "Show keyboard shortcuts and usage help.",
      keywords: ["?", "shortcuts"],
      suggested: true,
      title: "Open help",
      value: "system.help",
      run: () => openHelp(),
    },
    {
      category: "System",
      description: "Inspect the full event log for the current session.",
      keywords: ["events", "logs"],
      title: "Open diagnostics",
      value: "system.diagnostics",
      run: () => openDiagnostics(),
    },
    {
      category: "System",
      description: "Close diffdiff.",
      title: "Quit",
      value: "system.quit",
      run: () => onExit(),
    },
  ];
}
