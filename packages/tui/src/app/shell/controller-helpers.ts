import { openDialog as openAppDialog } from "../dialogs/stack.ts";
import type { DiffdiffAppDerived } from "./use-app-models.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { canSubmitMerge } from "../../review/merge-eligibility.ts";

export function openHelpDialog(state: DiffdiffAppState): void {
  state.setHelpLeaderOnly(state.activePrefix === "leader");
  state.setCommandInput({
    value: "",
    cursorOffset: 0,
    preferredColumn: null,
    undoStack: [],
    redoStack: [],
  });
  state.setCommandIndex(0);
  state.setDialogStack((currentStack) => openAppDialog(currentStack, "help"));
}

export function openMergeConfirmDialog(
  derived: Pick<DiffdiffAppDerived, "displaySession">,
  state: Pick<
    DiffdiffAppState,
    "mergeMethod" | "mergeAutoMerge" | "setMergeConfirmOpen" | "setStatusMessage"
  >,
): void {
  if (
    derived.displaySession.github == null ||
    !canSubmitMerge(
      derived.displaySession.github.pullRequest,
      state.mergeMethod,
      state.mergeAutoMerge,
    )
  ) {
    return;
  }

  state.setMergeConfirmOpen(true);
  state.setStatusMessage(
    state.mergeMethod === "close"
      ? "Press enter again to close the pull request without merging. Branches will be kept."
      : state.mergeAutoMerge
        ? `Press enter again to confirm enabling auto-merge with ${state.mergeMethod}.`
        : `Press enter again to confirm the ${state.mergeMethod} merge.`,
  );
}
