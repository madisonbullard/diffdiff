export const LIST_FILTER_KEYS = ["workingTree", "localBranch", "openPr", "remoteBranch"] as const;
export const LOADING_INDICATOR_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
export const TERMINAL_FOCUS_EVENT = "focus";
export const TERMINAL_BLUR_EVENT = "blur";
export const ALIGN_SELECTED_FILE_SCROLL_OFFSET = 6;
export const LIVE_REFRESH_INTERVAL_MS = 5_000;
export const INITIAL_FILE_BODY_RENDER_COUNT = 8;
export const FILE_PREVIEW_HYDRATION_DISTANCE = 24;
export const FOOTER_HEIGHT_ROWS = 1;
export const SHELL_OVERLAY_MARGIN = 2;
export const ERROR_TOAST_Z_INDEX = 60;
export const GITHUB_DIALOGS = new Set<import("../dialogs/stack.ts").AppDialog>([
  "cleanup",
  "comment-composer",
  "comments",
  "merge",
  "submit-review",
]);
