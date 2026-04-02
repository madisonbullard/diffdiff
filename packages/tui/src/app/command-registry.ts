import type { GitHubReviewSession } from "@diffdiff/core";
import type { CommandDefinition } from "../commands.ts";

export type AppCommand = CommandDefinition & { run: () => void };

export function buildAppCommands({
  onExit,
  openBranchModal,
  openCommandModal,
  openCommentComposer,
  openMergeModal,
  openSubmitReviewModal,
  selectedFileIndex,
  sessionGitHub,
  showKeyLegend,
  showOutdatedReviewThreads,
  toggleActivePane,
  toggleCollapsed,
  toggleDiffView,
  toggleKeyLegend,
  toggleOutdatedReviewThreads,
  toggleReviewed,
  copyPullRequestUrl,
}: {
  onExit: () => void;
  openBranchModal: () => void;
  openCommandModal: () => void;
  openCommentComposer: () => void;
  openMergeModal: () => void;
  openSubmitReviewModal: () => void;
  selectedFileIndex: number;
  sessionGitHub?: GitHubReviewSession;
  showKeyLegend: boolean;
  showOutdatedReviewThreads: boolean;
  toggleActivePane: () => void;
  toggleCollapsed: (fileIndex: number) => void;
  toggleDiffView: () => void;
  toggleKeyLegend: () => void;
  toggleOutdatedReviewThreads: () => void;
  toggleReviewed: (fileIndex: number) => void;
  copyPullRequestUrl: () => Promise<void>;
}): AppCommand[] {
  return [
    {
      category: "System",
      description: "Open the searchable command palette.",
      keybind: "ctrl+p",
      suggested: true,
      title: "Open command palette",
      value: "system.command-palette",
      run: () => openCommandModal(),
    },
    {
      category: "System",
      description: "Show keyboard shortcuts and usage help.",
      keybind: "<leader>h",
      suggested: true,
      title: "Open help",
      value: "system.help",
      run: () => openCommandModal(),
      hidden: true,
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
      keybind: "<leader>r,r",
      suggested: true,
      title: "Toggle reviewed",
      value: "review.toggle-reviewed",
      run: () => toggleReviewed(selectedFileIndex),
    },
    {
      category: "Review",
      description: "Collapse or expand the selected file diff.",
      keybind: "<leader>c,c,return",
      title: "Toggle collapsed",
      value: "review.toggle-collapsed",
      run: () => toggleCollapsed(selectedFileIndex),
    },
    {
      category: "GitHub",
      description: "Show the pull request conversation timeline.",
      enabled: sessionGitHub != null,
      keybind: "<leader>t,t",
      suggested: sessionGitHub != null,
      title: "Open PR comments",
      value: "github.comments",
      run: () => openCommandModal(),
      hidden: true,
    },
    {
      category: "GitHub",
      description: "Show or hide outdated review threads in the diff.",
      enabled: sessionGitHub != null,
      keybind: "<leader>u,u",
      title: showOutdatedReviewThreads ? "Hide outdated PR threads" : "Show outdated PR threads",
      value: "github.outdated-threads",
      run: () => toggleOutdatedReviewThreads(),
    },
    {
      category: "GitHub",
      description: "Copy the current pull request URL to the clipboard.",
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
      description: "Create a review comment on the selected diff line.",
      enabled: sessionGitHub != null,
      keybind: "<leader>a,a",
      suggested: sessionGitHub != null,
      title: "Add review comment",
      value: "github.add-comment",
      run: () => openCommentComposer(),
    },
    {
      category: "GitHub",
      description: "Submit the pending review to GitHub.",
      enabled: sessionGitHub != null,
      keybind: "<leader>s,s",
      suggested: sessionGitHub != null,
      title: "Submit review",
      value: "github.submit-review",
      run: () => openSubmitReviewModal(),
    },
    {
      category: "GitHub",
      description: "Merge the pull request with the selected merge strategy.",
      enabled: sessionGitHub != null,
      keybind: "<leader>m,m",
      suggested: sessionGitHub != null,
      title: "Merge pull request",
      value: "github.merge",
      run: () => openMergeModal(),
    },
  ];
}
