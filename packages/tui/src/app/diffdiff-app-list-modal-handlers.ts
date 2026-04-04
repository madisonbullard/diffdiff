import { isPrintableKey, type KeyboardInput } from "../commands.ts";
import { clampIndex, findInitialBranchListSelection } from "../view-model.ts";
import { closeDialog as closeAppDialog, openDialog as openAppDialog } from "./dialog-stack.ts";
import { findAppCommandByKey, type AppCommand } from "./command-registry.ts";
import type { DiffdiffAppDerived } from "./diffdiff-app-derived.ts";
import type { DiffdiffAppState } from "./diffdiff-app-state.ts";
import { LIST_FILTER_KEYS } from "./diffdiff-app-shared.ts";

interface CreateListModalHandlersOptions {
  applyBranchSelection: (
    target: "base" | "head",
    branch: import("@diffdiff/core").BranchInfo,
  ) => Promise<void>;
  applyCommitSelection: (target: "base" | "head", sha: string, shortSha: string) => Promise<void>;
  applyDashboardPullRequestSelection: (
    pullRequest: import("@diffdiff/core").GitHubDashboardPullRequest,
  ) => Promise<void>;
  applyPullRequestSelection: (branch: import("@diffdiff/core").BranchInfo) => Promise<void>;
  applyWorkingTreeSelection: () => Promise<void>;
  commands: readonly AppCommand[];
  filteredCommands: readonly AppCommand[];
  handleTextInputLeaderKey: (
    key: KeyboardInput,
    options?: { onLeaderDown?: () => void; onLeaderUp?: () => void },
  ) => boolean;
  openHelp: () => void;
  refreshGitHubPullRequestList: () => Promise<void>;
  runCommand: (command: AppCommand) => void;
  state: DiffdiffAppState;
  derived: DiffdiffAppDerived;
  toggleBranchFilter: (key: keyof import("../types.ts").BranchListFilters) => void;
}

export function createListModalHandlers({
  applyBranchSelection,
  applyCommitSelection,
  applyDashboardPullRequestSelection,
  applyPullRequestSelection,
  applyWorkingTreeSelection,
  commands,
  derived,
  filteredCommands,
  handleTextInputLeaderKey,
  openHelp,
  refreshGitHubPullRequestList,
  runCommand,
  state,
  toggleBranchFilter,
}: CreateListModalHandlersOptions) {
  function openBranchModal(): void {
    state.setBranchListIndex(
      findInitialBranchListSelection({
        comparison: state.session.comparison,
        currentBranch: state.session.repository.currentBranch,
        items: derived.branchItems,
      }),
    );
    state.setCommitListIndex(0);
    state.setCommitSearchQuery("");
    state.setCommitSearchActive(false);
    state.setActiveListView("branch");
    state.setDialogStack((currentStack) => openAppDialog(currentStack, "branch", { clear: true }));
    state.setStatusMessage("Opened list modal.");
  }

  function findCommandByKey(key: KeyboardInput, leader = false): AppCommand | undefined {
    return findAppCommandByKey(commands, key, { activePane: state.activePane, leader });
  }

  function handlePullRequestListModalKey(key: KeyboardInput): void {
    if (state.pullRequestSearchActive) {
      if (
        handleTextInputLeaderKey(key, {
          onLeaderDown: () => {
            state.setPullRequestListIndex((currentIndex) =>
              clampIndex(currentIndex + 1, derived.filteredPullRequests.length),
            );
          },
          onLeaderUp: () => {
            state.setPullRequestListIndex((currentIndex) =>
              clampIndex(currentIndex - 1, derived.filteredPullRequests.length),
            );
          },
        })
      ) {
        return;
      }

      if (key.name === "escape") {
        state.setPullRequestSearchActive(false);
        state.setPullRequestSearchQuery("");
        state.setPullRequestListIndex(0);
        return;
      }

      if (key.name === "return") {
        state.setPullRequestSearchActive(false);
        return;
      }

      if (key.name === "backspace") {
        state.setPullRequestSearchQuery((query) => query.slice(0, -1));
        state.setPullRequestListIndex(0);
        return;
      }

      if (key.name === "down") {
        state.setPullRequestListIndex((currentIndex) =>
          clampIndex(currentIndex + 1, derived.filteredPullRequests.length),
        );
        return;
      }

      if (key.name === "up") {
        state.setPullRequestListIndex((currentIndex) =>
          clampIndex(currentIndex - 1, derived.filteredPullRequests.length),
        );
        return;
      }

      if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
        state.setPullRequestSearchQuery((query) => query + key.sequence);
        state.setPullRequestListIndex(0);
      }

      return;
    }

    if (key.name === "escape" || key.name === "q") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "pull-request-list", "dismiss"),
      );
      state.setPullRequestSearchActive(false);
      state.setPullRequestSearchQuery("");
      state.setStatusMessage("Closed pull request list.");
      return;
    }

    if (key.name === "f" && key.shift) {
      void refreshGitHubPullRequestList();
      return;
    }

    if (key.name === "j" || key.name === "down") {
      state.setPullRequestListIndex((currentIndex) =>
        clampIndex(currentIndex + 1, derived.filteredPullRequests.length),
      );
      return;
    }

    if (key.name === "k" || key.name === "up") {
      state.setPullRequestListIndex((currentIndex) =>
        clampIndex(currentIndex - 1, derived.filteredPullRequests.length),
      );
      return;
    }

    if (key.name === "home") {
      state.setPullRequestListIndex(0);
      return;
    }

    if (key.name === "end") {
      state.setPullRequestListIndex(Math.max(derived.filteredPullRequests.length - 1, 0));
      return;
    }

    if (key.sequence === "/") {
      state.setPullRequestSearchActive(true);
      return;
    }

    if (key.name === "return" && derived.selectedPullRequest != null) {
      void applyDashboardPullRequestSelection(derived.selectedPullRequest);
    }
  }

  function handleBranchModalKey(key: KeyboardInput): void {
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
  }

  function handleListFilterModalKey(key: KeyboardInput): void {
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
  }

  function handleCommandModalKey(key: KeyboardInput): void {
    if (
      handleTextInputLeaderKey(key, {
        onLeaderDown: () => {
          state.setCommandIndex((currentIndex) =>
            clampIndex(currentIndex + 1, filteredCommands.length),
          );
        },
        onLeaderUp: () => {
          state.setCommandIndex((currentIndex) =>
            clampIndex(currentIndex - 1, filteredCommands.length),
          );
        },
      })
    ) {
      return;
    }

    if (key.name === "escape") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "command-palette", "dismiss"),
      );
      state.setCommandQuery("");
      state.setCommandIndex(0);
      state.setStatusMessage("Closed command palette.");
      return;
    }

    if (key.name === "down") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex + 1, filteredCommands.length),
      );
      return;
    }

    if (key.name === "up") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex - 1, filteredCommands.length),
      );
      return;
    }

    if (key.name === "pageup") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex - 10, filteredCommands.length),
      );
      return;
    }

    if (key.name === "pagedown") {
      state.setCommandIndex((currentIndex) =>
        clampIndex(currentIndex + 10, filteredCommands.length),
      );
      return;
    }

    if (key.name === "home") {
      state.setCommandIndex(0);
      return;
    }

    if (key.name === "end") {
      state.setCommandIndex(Math.max(filteredCommands.length - 1, 0));
      return;
    }

    if (key.name === "backspace") {
      state.setCommandQuery((currentQuery) => currentQuery.slice(0, -1));
      state.setCommandIndex(0);
      return;
    }

    if (key.name === "return") {
      const command = filteredCommands[clampIndex(state.commandIndex, filteredCommands.length)];
      if (command != null) {
        runCommand(command);
      }
      return;
    }

    if (isPrintableKey(key)) {
      state.setCommandQuery((currentQuery) => currentQuery + key.sequence);
      state.setCommandIndex(0);
    }
  }

  return {
    findCommandByKey,
    handleBranchModalKey,
    handleCommandModalKey,
    handleListFilterModalKey,
    handlePullRequestListModalKey,
    openBranchModal,
    openHelp,
  };
}
