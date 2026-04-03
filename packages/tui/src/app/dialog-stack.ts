export type AppDialog =
  | "branch"
  | "cleanup"
  | "command-palette"
  | "comment-composer"
  | "comments"
  | "help"
  | "list-filter"
  | "merge"
  | "submit-review";

export function getActiveDialog(stack: readonly AppDialog[]): AppDialog | null {
  return stack.at(-1) ?? null;
}

export function hasOpenDialog(stack: readonly AppDialog[], dialog: AppDialog): boolean {
  return stack.includes(dialog);
}

export function openDialog(
  stack: readonly AppDialog[],
  dialog: AppDialog,
  options: { clear?: boolean; replace?: boolean } = {},
): readonly AppDialog[] {
  if (options.clear) {
    return stack.length === 1 && stack[0] === dialog ? stack : [dialog];
  }

  if (options.replace) {
    if (stack.length === 0) {
      return [dialog];
    }

    if (stack[stack.length - 1] === dialog) {
      return stack;
    }

    return [...stack.slice(0, -1), dialog];
  }

  if (stack[stack.length - 1] === dialog) {
    return stack;
  }

  return [...stack, dialog];
}

export function closeDialog(stack: readonly AppDialog[], dialog: AppDialog): readonly AppDialog[] {
  const index = stack.lastIndexOf(dialog);
  return index < 0 ? stack : stack.slice(0, index);
}
