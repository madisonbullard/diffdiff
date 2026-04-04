import type { GitHubReviewSession } from "@diffdiff/core";
import { matchCommandKeybind, type CommandDefinition, type KeyboardInput } from "../commands.ts";
import type { AppPane, FileTreeNode } from "../types.ts";
import { COMMAND_LIST_KEYBIND } from "./helpers.ts";

export type AppCommand = CommandDefinition & {
  keybindingContexts?: readonly AppPane[];
  keybindingPriority?: number;
  run: () => void;
};

function getGitHubDisabledReason(
  sessionGitHub: GitHubReviewSession | undefined,
  isGitHubAuthenticated: boolean,
  requiresAuth = false,
): string | undefined {
  if (sessionGitHub == null) {
    return "Open a GitHub pull request first.";
  }

  if (requiresAuth && !isGitHubAuthenticated) {
    return "GitHub auth is required. Run `diffdiff auth login --token-stdin` first.";
  }

  return undefined;
}

function matchesKeybindingContext(command: AppCommand, activePane: AppPane): boolean {
  return command.keybindingContexts == null || command.keybindingContexts.includes(activePane);
}

export function findAppCommandByKey(
  commands: readonly AppCommand[],
  key: KeyboardInput,
  options: {
    activePane: AppPane;
    leader?: boolean;
  },
): AppCommand | undefined {
  const { activePane, leader = false } = options;

  return commands
    .filter(
      (command) =>
        command.enabled !== false &&
        matchesKeybindingContext(command, activePane) &&
        matchCommandKeybind(command.keybind, key, leader),
    )
    .sort((left, right) => {
      const leftPriority = left.keybindingPriority ?? 0;
      const rightPriority = right.keybindingPriority ?? 0;
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

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

export function buildAppCommands({
  canClearReviewed,
  canMoveToNextUnreviewed,
  canOpenSelectedTreeFile,
  clearReviewed,
  copyFocusedReviewCommentUrl,
  copyPullRequestUrl,
  hasFiles,
  hasFocusedReviewComment,
  hasSelectedReviewThread,
  isGitHubAuthenticated,
  markAllReviewed,
  moveFocusedReviewComment,
  moveFocusedReviewThread,
  moveToNextUnreviewed,
  onExit,
  openBranchModal,
  openCommandModal,
  openCommentComposer,
  openFocusedReviewThreadReplyComposer,
  openGitHubPullRequestList,
  openHelp,
  openMergeModal,
  openPullRequestCommentsModal,
  openSelectedTreeFile,
  openSubmitReviewModal,
  refreshComparison,
  selectedTreeNode,
  sessionGitHub,
  showKeyLegend,
  toggleActivePane,
  toggleCollapsedSelectedFile,
  toggleDiffView,
  toggleFocusedReviewThreadCollapsed,
  toggleKeyLegend,
  toggleReviewedSelectedFile,
}: {
  canClearReviewed: boolean;
  canMoveToNextUnreviewed: boolean;
  canOpenSelectedTreeFile: boolean;
  clearReviewed: () => void;
  copyFocusedReviewCommentUrl: () => Promise<void>;
  copyPullRequestUrl: () => Promise<void>;
  hasFiles: boolean;
  hasFocusedReviewComment: boolean;
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
  openFocusedReviewThreadReplyComposer: () => void;
  openGitHubPullRequestList: () => void;
  openHelp: () => void;
  openMergeModal: () => void;
  openPullRequestCommentsModal: () => void;
  openSelectedTreeFile: () => void;
  openSubmitReviewModal: () => void;
  refreshComparison: () => void;
  selectedTreeNode?: FileTreeNode;
  sessionGitHub?: GitHubReviewSession;
  showKeyLegend: boolean;
  toggleActivePane: () => void;
  toggleCollapsedSelectedFile: () => void;
  toggleDiffView: () => void;
  toggleFocusedReviewThreadCollapsed: () => void;
  toggleKeyLegend: () => void;
  toggleReviewedSelectedFile: () => void;
}): AppCommand[] {
  const gitHubDisabledReason = getGitHubDisabledReason(sessionGitHub, isGitHubAuthenticated);
  const gitHubWriteDisabledReason = getGitHubDisabledReason(
    sessionGitHub,
    isGitHubAuthenticated,
    true,
  );
  const focusedReviewThreadDisabledReason =
    gitHubDisabledReason ?? "No focused review thread is available in the selected file.";
  const focusedReviewCommentDisabledReason =
    gitHubDisabledReason ?? "No focused review comment is available in the selected file.";
  const focusedReviewReplyDisabledReason =
    gitHubWriteDisabledReason ?? "No focused review comment is available in the selected file.";

  return [
    {
      category: "System",
      description: "Open the searchable command palette.",
      keybind: COMMAND_LIST_KEYBIND,
      suggested: true,
      title: "Open command palette",
      value: "system.command-palette",
      run: () => openCommandModal(),
    },
    {
      category: "System",
      description: "Show keyboard shortcuts and usage help.",
      keybind: "shift+/,<leader>h",
      keywords: ["?", "shortcuts"],
      suggested: true,
      title: "Open help",
      value: "system.help",
      run: () => openHelp(),
    },
    {
      category: "System",
      description: "Show or hide the shortcut legend in the sidebar.",
      keybind: "<leader>z,z",
      title: showKeyLegend ? "Hide key legend" : "Show key legend",
      value: "system.key-legend",
      run: () => toggleKeyLegend(),
    },
    {
      category: "System",
      description: "Close diffdiff.",
      keybind: "<leader>q,q",
      title: "Quit",
      value: "system.quit",
      run: () => onExit(),
    },
    {
      category: "Comparison",
      description: "Reload refs, branches, and pull request metadata.",
      keybind: "shift+f",
      title: "Refresh comparison",
      value: "comparison.refresh",
      run: () => refreshComparison(),
    },
    {
      category: "View",
      description: "Move focus between the file tree and diff panes.",
      keybind: "<leader>p,tab",
      suggested: true,
      title: "Switch active pane",
      value: "view.pane-toggle",
      run: () => toggleActivePane(),
    },
    {
      category: "View",
      description: "Toggle between unified and side-by-side diffs.",
      keybind: "<leader>v,v",
      suggested: true,
      title: "Toggle diff view",
      value: "view.diff-toggle",
      run: () => toggleDiffView(),
    },
    {
      category: "View",
      description: "Open the selected file from the tree in the diff pane.",
      disabledReason:
        selectedTreeNode?.kind === "directory"
          ? "Select a file in the tree first."
          : !canOpenSelectedTreeFile
            ? "No file is selected in the tree."
            : undefined,
      enabled: canOpenSelectedTreeFile,
      keybind: "return,right,space",
      keybindingContexts: ["tree"],
      keybindingPriority: 20,
      title: "Open selected file",
      value: "view.open-selected-file",
      run: () => openSelectedTreeFile(),
    },
    {
      category: "Comparison",
      description: "Browse the working tree, branches, PRs, and commits.",
      keybind: "<leader>l,l",
      suggested: true,
      title: "Open comparison list",
      value: "comparison.list",
      run: () => openBranchModal(),
    },
    {
      category: "Review",
      description: "Mark the selected file as reviewed or not reviewed.",
      disabledReason: hasFiles ? undefined : "No files are available to review.",
      enabled: hasFiles,
      keybind: "<leader>r,r",
      keybindingContexts: ["diff"],
      suggested: true,
      title: "Toggle reviewed",
      value: "review.toggle-reviewed",
      run: () => toggleReviewedSelectedFile(),
    },
    {
      category: "Review",
      description: "Jump to the next file that is not marked reviewed.",
      disabledReason: !canMoveToNextUnreviewed
        ? hasFiles
          ? "All files are already reviewed."
          : "No files are available to review."
        : undefined,
      enabled: canMoveToNextUnreviewed,
      keybind: "u",
      suggested: canMoveToNextUnreviewed,
      title: "Jump to next unreviewed file",
      value: "review.next-unreviewed",
      run: () => moveToNextUnreviewed(),
    },
    {
      category: "Review",
      description: "Mark every file in the current comparison as reviewed.",
      disabledReason: hasFiles ? undefined : "No files are available to review.",
      enabled: hasFiles,
      keybind: "shift+r",
      title: "Mark all reviewed",
      value: "review.mark-all-reviewed",
      run: () => markAllReviewed(),
    },
    {
      category: "Review",
      description: "Clear the reviewed state from every file in the current comparison.",
      disabledReason: canClearReviewed ? undefined : "No files are marked reviewed.",
      enabled: canClearReviewed,
      keybind: "alt+r",
      title: "Unmark all reviewed",
      value: "review.clear-reviewed",
      run: () => clearReviewed(),
    },
    {
      category: "Review",
      description: "Collapse or expand the selected file diff.",
      disabledReason: hasFiles ? undefined : "No files are available to review.",
      enabled: hasFiles,
      keybind: "<leader>c,c,return",
      keybindingContexts: ["diff"],
      title: "Toggle collapsed",
      value: "review.toggle-collapsed",
      run: () => toggleCollapsedSelectedFile(),
    },
    {
      category: "GitHub",
      description: "Browse your open and review-requested pull requests across repositories.",
      disabledReason: isGitHubAuthenticated
        ? undefined
        : "GitHub auth is required. Run `diffdiff auth login --token-stdin` first.",
      enabled: isGitHubAuthenticated,
      keywords: ["pr", "pull request", "review requested", "inbox"],
      suggested: isGitHubAuthenticated,
      title: "Open GitHub PR list",
      value: "github.pull-request-list",
      run: () => openGitHubPullRequestList(),
    },
    {
      category: "GitHub",
      description: "Show the pull request conversation timeline.",
      disabledReason: gitHubDisabledReason,
      enabled: sessionGitHub != null,
      keybind: "<leader>t,t",
      suggested: sessionGitHub != null,
      title: "Open PR comments",
      value: "github.comments",
      run: () => openPullRequestCommentsModal(),
    },
    {
      category: "GitHub",
      description: "Copy the current pull request URL to the clipboard.",
      disabledReason: gitHubDisabledReason,
      enabled: sessionGitHub != null,
      keybind: "<leader>y,y",
      title: "Copy PR URL",
      value: "github.copy-url",
      run: () => {
        void copyPullRequestUrl();
      },
    },
    {
      category: "GitHub",
      description: "Move focus to the previous inline review thread.",
      disabledReason: focusedReviewThreadDisabledReason,
      enabled: sessionGitHub != null && hasSelectedReviewThread,
      hidden: true,
      keybind: "i",
      keybindingContexts: ["diff"],
      keybindingPriority: 20,
      title: "Focus previous thread",
      value: "github.focus-previous-thread",
      run: () => moveFocusedReviewThread(-1),
    },
    {
      category: "GitHub",
      description: "Move focus to the next inline review thread.",
      disabledReason: focusedReviewThreadDisabledReason,
      enabled: sessionGitHub != null && hasSelectedReviewThread,
      hidden: true,
      keybind: "o",
      keybindingContexts: ["diff"],
      keybindingPriority: 20,
      title: "Focus next thread",
      value: "github.focus-next-thread",
      run: () => moveFocusedReviewThread(1),
    },
    {
      category: "GitHub",
      description: "Move focus to the previous comment in the active thread.",
      disabledReason: focusedReviewThreadDisabledReason,
      enabled: sessionGitHub != null && hasSelectedReviewThread,
      hidden: true,
      keybind: "[",
      keybindingContexts: ["diff"],
      keybindingPriority: 20,
      title: "Focus previous thread comment",
      value: "github.focus-previous-comment",
      run: () => moveFocusedReviewComment(-1),
    },
    {
      category: "GitHub",
      description: "Move focus to the next comment in the active thread.",
      disabledReason: focusedReviewThreadDisabledReason,
      enabled: sessionGitHub != null && hasSelectedReviewThread,
      hidden: true,
      keybind: "]",
      keybindingContexts: ["diff"],
      keybindingPriority: 20,
      title: "Focus next thread comment",
      value: "github.focus-next-comment",
      run: () => moveFocusedReviewComment(1),
    },
    {
      category: "GitHub",
      description: "Create a review comment on the selected diff line.",
      disabledReason: gitHubWriteDisabledReason,
      enabled: sessionGitHub != null && isGitHubAuthenticated,
      keybind: "<leader>a,a",
      suggested: sessionGitHub != null && isGitHubAuthenticated,
      title: "Add review comment",
      value: "github.add-comment",
      run: () => openCommentComposer(),
    },
    {
      category: "GitHub",
      description: "Reply to the focused inline review thread.",
      disabledReason: focusedReviewReplyDisabledReason,
      enabled: sessionGitHub != null && isGitHubAuthenticated && hasFocusedReviewComment,
      keybind: "r",
      keybindingContexts: ["diff"],
      keybindingPriority: 20,
      title: "Reply to focused thread",
      value: "github.reply-thread",
      run: () => openFocusedReviewThreadReplyComposer(),
    },
    {
      category: "GitHub",
      description: "Collapse or expand the focused inline review thread.",
      disabledReason: focusedReviewThreadDisabledReason,
      enabled: sessionGitHub != null && hasSelectedReviewThread,
      keybind: "c",
      keybindingContexts: ["diff"],
      keybindingPriority: 20,
      title: "Toggle focused thread",
      value: "github.toggle-thread",
      run: () => toggleFocusedReviewThreadCollapsed(),
    },
    {
      category: "GitHub",
      description: "Copy the URL for the focused inline review comment.",
      disabledReason: focusedReviewCommentDisabledReason,
      enabled: sessionGitHub != null && hasFocusedReviewComment,
      keybind: "y",
      keybindingContexts: ["diff"],
      keybindingPriority: 20,
      title: "Copy focused comment URL",
      value: "github.copy-comment-url",
      run: () => {
        void copyFocusedReviewCommentUrl();
      },
    },
    {
      category: "GitHub",
      description: "Submit the pending review to GitHub.",
      disabledReason: gitHubWriteDisabledReason,
      enabled: sessionGitHub != null && isGitHubAuthenticated,
      keybind: "<leader>s,s",
      suggested: sessionGitHub != null && isGitHubAuthenticated,
      title: "Submit review",
      value: "github.submit-review",
      run: () => openSubmitReviewModal(),
    },
    {
      category: "GitHub",
      description: "Merge the pull request with the selected merge strategy.",
      disabledReason: gitHubWriteDisabledReason,
      enabled: sessionGitHub != null && isGitHubAuthenticated,
      keybind: "<leader>m,m",
      suggested: sessionGitHub != null && isGitHubAuthenticated,
      title: "Merge pull request",
      value: "github.merge",
      run: () => openMergeModal(),
    },
  ];
}
