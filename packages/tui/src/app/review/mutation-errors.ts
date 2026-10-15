import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { AppDialogStackEntry } from "../dialogs/stack.ts";
import { formatActionBindings } from "../keymap/display.ts";
export function mutationErrorOptions(
  state: DiffdiffAppState,
  owner: AppDialogStackEntry | undefined,
  error: unknown,
  pr: number,
  action: string,
) {
  const binding = formatActionBindings(state.reverseKeymaps, action, [
    "diff",
    "thread",
    "tree",
    "conversation",
  ])?.split(" / ")[0];
  const background = state.dialogStackRef.current.at(-1) !== owner;
  return {
    dialogOwner: owner,
    ...(background
      ? {
          displayMessage: `PR #${pr}: ${error instanceof Error ? error.message : "Write failed"}. Draft kept${binding ? `; ${binding} reopens to retry` : "; reopen from Commands to retry"}.`,
        }
      : {}),
  };
}
