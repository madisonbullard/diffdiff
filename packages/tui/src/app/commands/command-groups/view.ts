import type { AppCommand, BuildAppCommandsOptions } from "../registry.ts";

export function buildViewCommands({
  activePane,
  canOpenFocusedFileInEditor,
  canOpenSelectedTreeFile,
  hasFiles,
  openFocusedFileInEditor,
  openSelectedTreeFile,
  selectedTreeNode,
  toggleActivePane,
  toggleDiffView,
}: Pick<
  BuildAppCommandsOptions,
  | "activePane"
  | "canOpenFocusedFileInEditor"
  | "canOpenSelectedTreeFile"
  | "hasFiles"
  | "openFocusedFileInEditor"
  | "openSelectedTreeFile"
  | "selectedTreeNode"
  | "toggleActivePane"
  | "toggleDiffView"
>): AppCommand[] {
  return [
    {
      category: "View",
      description: "Move focus between the file tree and diff panes.",
      suggested: true,
      title: "Switch active pane",
      value: "view.pane-toggle",
      run: () => toggleActivePane(),
    },
    {
      category: "View",
      description: "Toggle between unified and side-by-side diffs.",
      suggested: true,
      title: "Toggle diff view",
      value: "view.diff-toggle",
      run: () => toggleDiffView(),
    },
    {
      category: "View",
      description: "Open the focused file in $VISUAL or $EDITOR.",
      disabledReason:
        activePane === "tree" && selectedTreeNode?.kind === "directory"
          ? "Select a file in the tree first."
          : !hasFiles
            ? "No files are available to open."
            : !canOpenFocusedFileInEditor
              ? "No file is focused right now."
              : undefined,
      enabled: canOpenFocusedFileInEditor,
      keywords: ["editor", "visual", "open file"],
      title: "Open focused file in editor",
      value: "view.open-file-in-editor",
      run: () => {
        void openFocusedFileInEditor();
      },
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
      hidden: true,
      title: "Open selected file",
      value: "view.open-selected-file",
      run: () => openSelectedTreeFile(),
    },
  ];
}
