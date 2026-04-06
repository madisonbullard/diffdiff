export type AppDialog =
  | "branch"
  | "clear-reviewed"
  | "cleanup"
  | "command-palette"
  | "comment-composer"
  | "comments"
  | "diagnostics"
  | "pull-request-list"
  | "help"
  | "list-filter"
  | "merge"
  | "submit-review";

type AppDialogExitReason = "dismiss" | "complete";
type AppDialogExitAction = "close-all" | "restore-parent";

export interface AppDialogStackEntry {
  dialog: AppDialog;
  triggeredBy: AppDialog | null;
}

const APP_DIALOG_EXIT_ACTIONS: Record<
  AppDialog,
  Partial<Record<AppDialogExitReason, AppDialogExitAction>>
> = {
  branch: {
    dismiss: "close-all",
  },
  "clear-reviewed": {
    complete: "restore-parent",
    dismiss: "restore-parent",
  },
  cleanup: {
    complete: "close-all",
    dismiss: "close-all",
  },
  "command-palette": {
    dismiss: "restore-parent",
  },
  "comment-composer": {
    complete: "restore-parent",
    dismiss: "restore-parent",
  },
  comments: {
    dismiss: "restore-parent",
  },
  diagnostics: {
    dismiss: "close-all",
  },
  help: {
    dismiss: "restore-parent",
  },
  "list-filter": {
    dismiss: "restore-parent",
  },
  merge: {
    complete: "close-all",
    dismiss: "restore-parent",
  },
  "pull-request-list": {
    dismiss: "close-all",
  },
  "submit-review": {
    complete: "close-all",
    dismiss: "restore-parent",
  },
};

export function getActiveDialog(stack: readonly AppDialogStackEntry[]): AppDialog | null {
  return stack.at(-1)?.dialog ?? null;
}

export function getActiveDialogEntry(
  stack: readonly AppDialogStackEntry[],
): AppDialogStackEntry | null {
  return stack.at(-1) ?? null;
}

export function openDialog(
  stack: readonly AppDialogStackEntry[],
  dialog: AppDialog,
  options: { clear?: boolean; replace?: boolean; triggeredBy?: AppDialog | null } = {},
): readonly AppDialogStackEntry[] {
  const nextEntry: AppDialogStackEntry = {
    dialog,
    triggeredBy: options.clear ? null : (options.triggeredBy ?? getActiveDialog(stack)),
  };

  if (options.clear) {
    const currentEntry = stack[0];
    return stack.length === 1 && currentEntry?.dialog === dialog && currentEntry.triggeredBy == null
      ? stack
      : [nextEntry];
  }

  if (options.replace) {
    if (stack.length === 0) {
      return [nextEntry];
    }

    const currentEntry = stack[stack.length - 1];
    if (currentEntry?.dialog === dialog && currentEntry.triggeredBy === nextEntry.triggeredBy) {
      return stack;
    }

    return [...stack.slice(0, -1), nextEntry];
  }

  const currentEntry = stack[stack.length - 1];
  if (currentEntry?.dialog === dialog && currentEntry.triggeredBy === nextEntry.triggeredBy) {
    return stack;
  }

  return [...stack, nextEntry];
}

export function closeDialog(
  stack: readonly AppDialogStackEntry[],
  dialog: AppDialog,
  reason: AppDialogExitReason = "dismiss",
): readonly AppDialogStackEntry[] {
  const activeEntry = stack.at(-1);
  if (activeEntry?.dialog !== dialog) {
    return stack;
  }

  const exitAction = getDialogExitAction(dialog, reason);
  if (exitAction === "restore-parent" && stack.length > 1) {
    return stack.slice(0, -1);
  }

  return [];
}

export function getDialogExitAction(
  dialog: AppDialog,
  reason: AppDialogExitReason,
): AppDialogExitAction {
  return APP_DIALOG_EXIT_ACTIONS[dialog][reason] ?? "close-all";
}
