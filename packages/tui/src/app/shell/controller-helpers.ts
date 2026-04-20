import { openDialog as openAppDialog } from "../dialogs/stack.ts";
import type { DiffdiffAppDerived } from "./use-app-models.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";

export function openHelpDialog(state: DiffdiffAppState): void {
  state.setDialogStack((currentStack) => openAppDialog(currentStack, "help"));
  state.setStatusMessage("Opened help.");
}

export function openMergeConfirmDialog(
  derived: Pick<DiffdiffAppDerived, "displaySession">,
  state: Pick<DiffdiffAppState, "mergeMethod" | "setMergeConfirmOpen" | "setStatusMessage">,
): void {
  if (
    derived.displaySession.github == null ||
    state.mergeMethod == null ||
    !derived.displaySession.github.pullRequest.merge.canMerge
  ) {
    return;
  }

  state.setMergeConfirmOpen(true);
  state.setStatusMessage(`Press enter again to confirm the ${state.mergeMethod} merge.`);
}
