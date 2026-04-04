import type { AppCommand, BuildAppCommandsOptions } from "../registry.ts";
import { withLeaderKeybind } from "../../shared/constants.ts";

export function buildComparisonCommands({
  openBranchModal,
  refreshComparison,
}: Pick<BuildAppCommandsOptions, "openBranchModal" | "refreshComparison">): AppCommand[] {
  return [
    {
      category: "Comparison",
      description: "Reload refs, branches, and pull request metadata.",
      keybind: withLeaderKeybind("shift+f"),
      title: "Refresh comparison",
      value: "comparison.refresh",
      run: () => refreshComparison(),
    },
    {
      category: "Comparison",
      description: "Browse the working tree, branches, PRs, and commits.",
      keybind: withLeaderKeybind("l"),
      suggested: true,
      title: "Open comparison list",
      value: "comparison.list",
      run: () => openBranchModal(),
    },
  ];
}
