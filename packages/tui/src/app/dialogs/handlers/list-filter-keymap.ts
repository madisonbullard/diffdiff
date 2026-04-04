import type { KeyboardInput } from "../../../commands.ts";
import { clampIndex } from "../../../view-model.ts";
import { closeDialog as closeAppDialog } from "../stack.ts";
import { LIST_FILTER_KEYS } from "../../shared/constants.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

export function createListFilterKeyHandler({
  state,
  toggleBranchFilter,
}: {
  state: DiffdiffAppState;
  toggleBranchFilter: (key: keyof import("../../../types.ts").BranchListFilters) => void;
}) {
  return function handleListFilterModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q" || key.name === "f") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "list-filter", "dismiss"),
      );
      state.setStatusMessage("Closed list filters.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      state.setFilterIndex((currentIndex) => clampIndex(currentIndex + 1, LIST_FILTER_KEYS.length));
      return;
    }

    if (key.name === "k" || key.name === "up") {
      state.setFilterIndex((currentIndex) => clampIndex(currentIndex - 1, LIST_FILTER_KEYS.length));
      return;
    }

    if (key.name === "home") {
      state.setFilterIndex(0);
      return;
    }

    if (key.name === "end") {
      state.setFilterIndex(Math.max(LIST_FILTER_KEYS.length - 1, 0));
      return;
    }

    if ((key.name === "return" || key.name === "space") && key.shift) {
      state.setBranchListFilters({
        workingTree: true,
        localBranch: true,
        openPr: true,
        remoteBranch: true,
      });
      state.setStatusMessage("Enabled all list filters.");
      return;
    }

    if ((key.name === "return" || key.name === "space") && key.meta) {
      state.setBranchListFilters({
        workingTree: false,
        localBranch: false,
        openPr: false,
        remoteBranch: false,
      });
      state.setStatusMessage("Disabled all list filters.");
      return;
    }

    if (key.name === "return" || key.name === "space") {
      const filterKey = LIST_FILTER_KEYS[state.filterIndex];
      if (filterKey != null) {
        toggleBranchFilter(filterKey);
      }
      return;
    }

    if (key.name === "a") {
      state.setBranchListFilters({
        workingTree: true,
        localBranch: true,
        openPr: true,
        remoteBranch: true,
      });
      state.setStatusMessage("Enabled all list filters.");
      return;
    }

    if (key.name === "n") {
      state.setBranchListFilters({
        workingTree: false,
        localBranch: false,
        openPr: false,
        remoteBranch: false,
      });
      state.setStatusMessage("Disabled all list filters.");
    }
  };
}
