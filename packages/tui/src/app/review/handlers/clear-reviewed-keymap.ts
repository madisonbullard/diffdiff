import type { KeyboardInput } from "../../../commands.ts";
import { closeDialog as closeAppDialog } from "../../dialogs/stack.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

export function createClearReviewedKeyHandler({
  clearReviewed,
  state,
}: {
  clearReviewed: () => void;
  state: DiffdiffAppState;
}) {
  return function handleClearReviewedModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "clear-reviewed", "dismiss"),
      );
      state.setStatusMessage("Canceled clearing review marks.");
      return;
    }

    if (key.name === "return") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "clear-reviewed", "complete"),
      );
      clearReviewed();
    }
  };
}
