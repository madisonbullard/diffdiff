import type { KeyboardInput } from "../../commands.ts";
import { findInitialBranchListSelection } from "../../view-model.ts";
import { openDialog as openAppDialog } from "./stack.ts";
import type { AppCommand } from "../commands/registry.ts";
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
  filteredCommands: readonly AppCommand[];
  handleTextInputPrefixKeypress: (
    key: KeyboardInput,
    options?: { onPrefixDown?: () => void; onPrefixUp?: () => void },
  ) => boolean;
  openHelp: () => void;
  refreshGitHubPullRequestList: () => Promise<void>;
  runCommand: (command: AppCommand) => void;
  state: DiffdiffAppState;
  derived: DiffdiffAppDerived;
  toggleBranchFilter: (key: keyof import("../../types.ts").BranchListFilters) => void;
}

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

export function createListModalHandlers({
  applyBranchSelection,
  applyCommitSelection,
  applyDashboardPullRequestSelection,
  applyPullRequestSelection,
  applyWorkingTreeSelection,
  derived,
  filteredCommands,
  handleTextInputPrefixKeypress,
  openHelp,
  refreshGitHubPullRequestList,
  runCommand,
  state,
  toggleBranchFilter,
}: CreateListModalHandlersOptions) {
  function openBranchModal(): void {
    openBranchListModal(state, derived.branchItems);
  }

  const handlePullRequestListModalKey = createPullRequestListKeyHandler({
    applyDashboardPullRequestSelection,
    derived,
    handleTextInputPrefixKeypress,
    refreshGitHubPullRequestList,
    state,
  });
  const handleBranchModalKey = createBranchListKeyHandler({
    applyBranchSelection,
    applyCommitSelection,
    applyPullRequestSelection,
    applyWorkingTreeSelection,
    derived,
    handleTextInputPrefixKeypress,
    state,
    toggleBranchFilter,
  });
  const handleListFilterModalKey = createListFilterKeyHandler({ state, toggleBranchFilter });
  const handleCommandModalKey = createCommandPaletteKeyHandler({
    filteredCommands,
    handleTextInputPrefixKeypress,
    runCommand,
    state,
  });

  return {
    handleBranchModalKey,
    handleCommandModalKey,
    handleListFilterModalKey,
    handlePullRequestListModalKey,
    openBranchModal,
    openHelp,
  };
}
