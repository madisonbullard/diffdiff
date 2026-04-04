import type { KeyboardInput } from "../../../commands.ts";
import { clampIndex } from "../../../view-model.ts";
import { closeDialog as closeAppDialog, openDialog as openAppDialog } from "../stack.ts";
import type { DiffdiffAppDerived } from "../../shell/use-app-models.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

interface BranchListKeymapOptions {
  applyBranchSelection: (
    target: "base" | "head",
    branch: import("@diffdiff/core").BranchInfo,
  ) => Promise<void>;
  applyCommitSelection: (target: "base" | "head", sha: string, shortSha: string) => Promise<void>;
  applyPullRequestSelection: (branch: import("@diffdiff/core").BranchInfo) => Promise<void>;
  applyWorkingTreeSelection: () => Promise<void>;
  derived: DiffdiffAppDerived;
  handleTextInputLeaderKey: (
    key: KeyboardInput,
    options?: { onLeaderDown?: () => void; onLeaderUp?: () => void },
  ) => boolean;
  state: DiffdiffAppState;
  toggleBranchFilter: (key: keyof import("../../../types.ts").BranchListFilters) => void;
}

export function createBranchListKeyHandler({
  applyBranchSelection,
  applyCommitSelection,
  applyPullRequestSelection,
  applyWorkingTreeSelection,
  derived,
  handleTextInputLeaderKey,
  state,
  toggleBranchFilter,
}: BranchListKeymapOptions) {
  return function handleBranchModalKey(key: KeyboardInput): void {
    if (state.commitSearchActive && state.activeListView === "commit") {
      if (
        handleTextInputLeaderKey(key, {
          onLeaderDown: () => {
            state.setCommitListIndex((currentIndex) =>
              clampIndex(currentIndex + 1, derived.filteredCommitItems.length),
            );
          },
          onLeaderUp: () => {
            state.setCommitListIndex((currentIndex) =>
              clampIndex(currentIndex - 1, derived.filteredCommitItems.length),
            );
          },
        })
      ) {
        return;
      }

      if (key.name === "escape") {
        state.setCommitSearchQuery("");
        state.setCommitSearchActive(false);
        state.setCommitListIndex(0);
        return;
      }

      if (key.name === "return") {
        state.setCommitSearchActive(false);
        return;
      }

      if (key.name === "backspace") {
        state.setCommitSearchQuery((query) => query.slice(0, -1));
        state.setCommitListIndex(0);
        return;
      }

      if (key.name === "up") {
        state.setCommitListIndex((currentIndex) =>
          clampIndex(currentIndex - 1, derived.filteredCommitItems.length),
        );
        return;
      }

      if (key.name === "down") {
        state.setCommitListIndex((currentIndex) =>
          clampIndex(currentIndex + 1, derived.filteredCommitItems.length),
        );
        return;
      }

      if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
        state.setCommitSearchQuery((query) => query + key.sequence);
        state.setCommitListIndex(0);
      }

      return;
    }

    if (key.name === "escape" || key.name === "q") {
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "branch", "dismiss"));
      state.setCommitSearchQuery("");
      state.setCommitSearchActive(false);
      state.setStatusMessage("Closed list modal.");
      return;
    }

    if (key.name === "tab") {
      state.setActiveListView((currentView) => (currentView === "branch" ? "commit" : "branch"));
      state.setCommitSearchActive(false);
      return;
    }

    if (key.name === "left" || key.name === "h") {
      state.setActiveListView("branch");
      state.setCommitSearchActive(false);
      return;
    }

    if (key.name === "right" || key.name === "l") {
      state.setActiveListView("commit");
      state.setCommitSearchActive(false);
      return;
    }

    if (state.activeListView === "branch" && key.name === "f") {
      state.setFilterIndex(0);
      state.setDialogStack((currentStack) => openAppDialog(currentStack, "list-filter"));
      state.setStatusMessage("Opened list filters.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      if (state.activeListView === "branch") {
        state.setBranchListIndex((currentIndex) =>
          clampIndex(currentIndex + 1, derived.branchItems.length),
        );
      } else {
        state.setCommitListIndex((currentIndex) =>
          clampIndex(currentIndex + 1, derived.filteredCommitItems.length),
        );
      }
      return;
    }

    if (key.name === "k" || key.name === "up") {
      if (state.activeListView === "branch") {
        state.setBranchListIndex((currentIndex) =>
          clampIndex(currentIndex - 1, derived.branchItems.length),
        );
      } else {
        state.setCommitListIndex((currentIndex) =>
          clampIndex(currentIndex - 1, derived.filteredCommitItems.length),
        );
      }
      return;
    }

    if (key.name === "home") {
      state.setBranchListIndex(state.activeListView === "branch" ? 0 : state.branchListIndex);
      state.setCommitListIndex(state.activeListView === "commit" ? 0 : state.commitListIndex);
      return;
    }

    if (key.name === "end") {
      if (state.activeListView === "branch") {
        state.setBranchListIndex(Math.max(derived.branchItems.length - 1, 0));
      } else {
        state.setCommitListIndex(Math.max(derived.filteredCommitItems.length - 1, 0));
      }
      return;
    }

    if (state.activeListView === "branch") {
      if (key.name === "o") {
        toggleBranchFilter("remoteBranch");
        return;
      }

      if (key.name === "return" || key.name === "b") {
        if (key.name === "return" && derived.selectedBranchItem?.kind === "open-pr") {
          if (derived.selectedBranchItem.branch != null) {
            void applyPullRequestSelection(derived.selectedBranchItem.branch);
          }
        } else if (derived.selectedBranchItem?.kind === "working-tree") {
          void applyWorkingTreeSelection();
        } else if (derived.selectedBranchItem?.branch != null) {
          void applyBranchSelection(
            key.name === "b" ? "base" : "head",
            derived.selectedBranchItem.branch,
          );
        }
        return;
      }

      if (key.name === "w") {
        void applyWorkingTreeSelection();
      }
      return;
    }

    if (key.sequence === "/") {
      state.setCommitSearchActive(true);
      return;
    }

    if (key.name === "return" && derived.selectedCommitItem != null) {
      void applyCommitSelection(
        "head",
        derived.selectedCommitItem.commit.sha,
        derived.selectedCommitItem.commit.shortSha,
      );
      return;
    }

    if (key.name === "b" && derived.selectedCommitItem != null) {
      void applyCommitSelection(
        "base",
        derived.selectedCommitItem.commit.sha,
        derived.selectedCommitItem.commit.shortSha,
      );
    }
  };
}
