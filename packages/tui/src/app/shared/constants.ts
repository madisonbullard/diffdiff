import type { CommandKeybind, CommandKeybindPrefix } from "../../commands.ts";

export const LIST_FILTER_KEYS = ["workingTree", "localBranch", "openPr", "remoteBranch"] as const;
export const LOADING_INDICATOR_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
export const TERMINAL_FOCUS_EVENT = "focus";
export const TERMINAL_BLUR_EVENT = "blur";
export const ALIGN_SELECTED_FILE_SCROLL_OFFSET = 6;
export const LIVE_REFRESH_INTERVAL_MS = 5_000;
export const INITIAL_FILE_BODY_RENDER_COUNT = 8;
export const FILE_PREVIEW_HYDRATION_DISTANCE = 24;
export const LEADER_KEYBIND = "ctrl+x";
export const COMMAND_LIST_KEYBIND = "ctrl+p";
export const GITHUB_DIALOGS = new Set<import("../dialogs/stack.ts").AppDialog>([
  "cleanup",
  "comment-composer",
  "comments",
  "merge",
  "submit-review",
]);

export function withKeybindPrefixes(
  keybind: string,
  prefixes: readonly CommandKeybindPrefix[],
): CommandKeybind {
  return prefixes.map((prefix) => `<${prefix}>${keybind}`).join(",");
}

export function withPrefixedKeybind(
  keybind: string,
  prefixes: readonly CommandKeybindPrefix[],
  ...additionalKeybinds: string[]
): CommandKeybind {
  return [keybind, withKeybindPrefixes(keybind, prefixes), ...additionalKeybinds].join(",");
}

export function withLeaderKeybind(
  keybind: string,
  ...additionalKeybinds: string[]
): CommandKeybind {
  return withPrefixedKeybind(keybind, ["leader"], ...additionalKeybinds);
}
