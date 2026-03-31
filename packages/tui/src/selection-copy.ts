import { spawnSync } from "node:child_process";
import type { Selection } from "@opentui/core";

interface ClipboardCommand {
  command: string;
  args: string[];
}

export interface SelectionClipboardRenderer {
  on(event: "selection", listener: (selection: Selection) => void): void;
  off(event: "selection", listener: (selection: Selection) => void): void;
  clearSelection(): void;
  copyToClipboardOSC52(text: string): boolean;
}

export interface ClipboardCommandRunner {
  (command: string, args: string[], text: string): boolean;
}

export interface ClipboardCopyOptions {
  platform?: NodeJS.Platform;
  runCommand?: ClipboardCommandRunner;
}

const LINUX_CLIPBOARD_COMMANDS: readonly ClipboardCommand[] = [
  { command: "wl-copy", args: [] },
  { command: "xclip", args: ["-selection", "clipboard"] },
  { command: "xsel", args: ["--clipboard", "--input"] },
];

export function installSelectionAutoCopy(
  renderer: SelectionClipboardRenderer,
  copyText: (text: string, renderer: SelectionClipboardRenderer) => boolean = copyTextToClipboard,
): () => void {
  const handleSelection = (selection: Selection) => {
    const selectedText = selection.getSelectedText();

    try {
      if (selectedText.length > 0) {
        try {
          copyText(selectedText, renderer);
        } catch {
          // Ignore clipboard failures so selection never crashes the app.
        }
      }
    } finally {
      renderer.clearSelection();
    }
  };

  renderer.on("selection", handleSelection);

  return () => {
    renderer.off("selection", handleSelection);
  };
}

export function copyTextToClipboard(
  text: string,
  renderer: Pick<SelectionClipboardRenderer, "copyToClipboardOSC52">,
  options: ClipboardCopyOptions = {},
): boolean {
  if (text.length === 0) {
    return false;
  }

  try {
    if (renderer.copyToClipboardOSC52(text)) {
      return true;
    }
  } catch {
    // Fall back to platform clipboard commands.
  }

  return copyTextWithPlatformClipboard(text, options);
}

export function copyTextWithPlatformClipboard(
  text: string,
  options: ClipboardCopyOptions = {},
): boolean {
  if (text.length === 0) {
    return false;
  }

  const runCommand = options.runCommand ?? runClipboardCommand;

  for (const candidate of getClipboardCommands(options.platform ?? process.platform)) {
    if (runCommand(candidate.command, candidate.args, text)) {
      return true;
    }
  }

  return false;
}

function getClipboardCommands(platform: NodeJS.Platform): readonly ClipboardCommand[] {
  switch (platform) {
    case "darwin":
      return [{ command: "pbcopy", args: [] }];
    case "linux":
      return LINUX_CLIPBOARD_COMMANDS;
    case "win32":
      return [{ command: "clip", args: [] }];
    default:
      return [];
  }
}

function runClipboardCommand(command: string, args: string[], text: string): boolean {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      input: text,
    });

    return result.status === 0 && result.error == null;
  } catch {
    return false;
  }
}
