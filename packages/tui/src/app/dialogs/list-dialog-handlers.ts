import type { KeyboardInput } from "../../commands.ts";
import { findInitialBranchListSelection } from "../../view-model.ts";
import { openDialog as openAppDialog } from "./stack.ts";
import { findAppCommandByKey, type AppCommand } from "../commands/registry.ts";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { createBranchListKeyHandler } from "./handlers/branch-list-keymap.ts";
import { createCommandPaletteKeyHandler } from "./handlers/command-palette-keymap.ts";
import { createListFilterKeyHandler } from "./handlers/list-filter-keymap.ts";
import { createPullRequestListKeyHandler } from "./handlers/pull-request-list-keymap.ts";

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
  toggleBranchFilter: (key: keyof import("../../types.ts").BranchListFilters) => void;
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

  const handlePullRequestListModalKey = createPullRequestListKeyHandler({
    applyDashboardPullRequestSelection,
    derived,
    handleTextInputLeaderKey,
    refreshGitHubPullRequestList,
    state,
  });
  const handleBranchModalKey = createBranchListKeyHandler({
    applyBranchSelection,
    applyCommitSelection,
    applyPullRequestSelection,
    applyWorkingTreeSelection,
    derived,
    handleTextInputLeaderKey,
    state,
    toggleBranchFilter,
  });
  const handleListFilterModalKey = createListFilterKeyHandler({ state, toggleBranchFilter });
  const handleCommandModalKey = createCommandPaletteKeyHandler({
    filteredCommands,
    handleTextInputLeaderKey,
    runCommand,
    state,
  });

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
