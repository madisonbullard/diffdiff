import type { GitHubReviewSession } from "@diffdiff/core";
import type { CommandDefinition } from "../../commands.ts";
import type { AppPane, FileTreeNode } from "../../types.ts";
import { buildComparisonCommands } from "./command-groups/comparison.ts";
import { buildGitHubCommands } from "./command-groups/github.ts";
import { buildReviewCommands } from "./command-groups/review.ts";
import { buildSystemCommands } from "./command-groups/system.ts";
import { buildViewCommands } from "./command-groups/view.ts";

export type AppCommand = CommandDefinition & {
  keybindingContexts?: readonly AppPane[];
  run: () => void;
};

export function findAppCommandByValue(
  commands: readonly AppCommand[],
  value: string,
): AppCommand | undefined {
  return commands.find((command) => command.value === value);
}

export function getPaletteCommands(commands: readonly AppCommand[]): AppCommand[] {
  return commands.filter((command) => command.hidden !== true);
}

export interface BuildAppCommandsOptions {
  activePane: AppPane;
  bulkReviewedActionsDisabledReason?: string;
  canClearReviewed: boolean;
  canOpenFocusedFileInEditor: boolean;
  canMoveToNextUnreviewed: boolean;
  canOpenSelectedTreeFile: boolean;
  clearReviewed: () => void;
  copyFocusedReviewCommentUrl: () => Promise<void>;
  copyPullRequestUrl: () => Promise<void>;
  hasFiles: boolean;
  hasFocusedReviewComment: boolean;
  hasFocusedReviewThread: boolean;
  hasReviewThreads: boolean;
  hasSelectedReviewThread: boolean;
  isGitHubAuthenticated: boolean;
  markAllReviewed: () => void;
  moveFocusedReviewComment: (delta: number) => void;
  moveFocusedReviewThread: (delta: number) => void;
  moveToNextUnreviewed: () => void;
  onExit: () => void;
  openBranchModal: () => void;
  openCommandModal: () => void;
  openCommentComposer: () => void;
  openDiagnostics: () => void;
  openFocusedReviewThreadReplyComposer: () => void;
  openGitHubPullRequestList: () => void;
  openHelp: () => void;
  openFocusedFileInEditor: () => Promise<void>;
  openMergeModal: () => void;
  openPullRequestCommentsModal: () => void;
  openSelectedTreeFile: () => void;
  openSubmitReviewModal: () => void;
  refreshComparison: () => void;
  selectedTreeNode?: FileTreeNode;
  sessionGitHub?: GitHubReviewSession;
  toggleActivePane: () => void;
  toggleCollapsedSelectedFile: () => void;
  toggleDiffView: () => void;
  toggleFocusedReviewThreadCollapsed: () => void;
  toggleReviewedSelectedFile: () => void;
}

export function buildAppCommands(options: BuildAppCommandsOptions): AppCommand[] {
  return [
    ...buildSystemCommands(options),
    ...buildComparisonCommands(options),
    ...buildViewCommands(options),
    ...buildReviewCommands(options),
    ...buildGitHubCommands(options),
  ];
}
