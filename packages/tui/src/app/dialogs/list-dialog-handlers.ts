import { findInitialBranchListSelection } from "../../view-model.ts";
import { openDialog as openAppDialog } from "./stack.ts";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";

export function openBranchListModal(
  state: DiffdiffAppState,
  branchItems: DiffdiffAppDerived["branchItems"],
): void {
  state.setBranchListIndex(
    findInitialBranchListSelection({
      comparison: state.session.comparison,
      currentBranch: state.session.repository.currentBranch,
      items: branchItems,
    }),
  );
  state.setCommitListIndex(0);
  state.setCommitSearchQuery("");
  state.setCommitSearchActive(false);
  state.setActiveListView("branch");
  state.setDialogStack((currentStack) => openAppDialog(currentStack, "branch", { clear: true }));
  state.setStatusMessage("Opened list modal.");
}
