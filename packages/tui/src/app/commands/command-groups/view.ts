import type { AppCommand, BuildAppCommandsOptions } from "../registry.ts";
import { withLeaderKeybind } from "../../shared/constants.ts";

export function buildViewCommands({
  canOpenSelectedTreeFile,
  openSelectedTreeFile,
  selectedTreeNode,
  toggleActivePane,
  toggleDiffView,
}: Pick<
  BuildAppCommandsOptions,
  | "canOpenSelectedTreeFile"
  | "openSelectedTreeFile"
  | "selectedTreeNode"
  | "toggleActivePane"
  | "toggleDiffView"
>): AppCommand[] {
  return [
    {
      category: "View",
      description: "Move focus between the file tree and diff panes.",
      keybind: withLeaderKeybind("p", "tab"),
      suggested: true,
      title: "Switch active pane",
      value: "view.pane-toggle",
      run: () => toggleActivePane(),
    },
    {
      category: "View",
      description: "Toggle between unified and side-by-side diffs.",
      keybind: withLeaderKeybind("v"),
      suggested: true,
      title: "Toggle diff view",
      value: "view.diff-toggle",
      run: () => toggleDiffView(),
    },
    {
      category: "View",
      description: "Open the selected file from the tree in the diff pane.",
      disabledReason:
        selectedTreeNode?.kind === "directory"
          ? "Select a file in the tree first."
          : !canOpenSelectedTreeFile
            ? "No file is selected in the tree."
            : undefined,
      enabled: canOpenSelectedTreeFile,
      keybind: "return,right,space",
      keybindingContexts: ["tree"],
      keybindingPriority: 20,
      title: "Open selected file",
      value: "view.open-selected-file",
      run: () => openSelectedTreeFile(),
    },
  ];
}
