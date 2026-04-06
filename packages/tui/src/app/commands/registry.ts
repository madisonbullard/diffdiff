import type { GitHubReviewSession } from "@diffdiff/core";
import {
  matchCommandKeybind,
  type CommandDefinition,
  type CommandKeybindPrefix,
  type KeyboardInput,
} from "../../commands.ts";
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

function matchesKeybindingContext(command: AppCommand, activePane: AppPane): boolean {
  return command.keybindingContexts == null || command.keybindingContexts.includes(activePane);
}

export function findAppCommandByKey(
  commands: readonly AppCommand[],
  key: KeyboardInput,
  options: {
    activePane: AppPane;
    prefix?: CommandKeybindPrefix | null;
  },
): AppCommand | undefined {
  const { activePane, prefix = null } = options;

  return commands
    .filter(
      (command) =>
        command.enabled !== false &&
        matchesKeybindingContext(command, activePane) &&
        matchCommandKeybind(command.keybind, key, { prefix }),
    )
    .sort((left, right) => {
      const leftSpecific = left.keybindingContexts == null ? 0 : 1;
      const rightSpecific = right.keybindingContexts == null ? 0 : 1;
      return rightSpecific - leftSpecific;
    })[0];
}

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
