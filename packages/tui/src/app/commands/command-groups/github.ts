import type { AppCommand, BuildAppCommandsOptions } from "../registry.ts";
import { withLeaderKeybind, withPrefixedKeybind } from "../../shared/constants.ts";

export function buildGitHubCommands({
  copyFocusedReviewCommentUrl,
  copyPullRequestUrl,
  hasFocusedReviewComment,
  hasFocusedReviewThread,
  hasReviewThreads,
  hasSelectedReviewThread,
  isGitHubAuthenticated,
  moveFocusedReviewComment,
  moveFocusedReviewThread,
  openCommentComposer,
  openFocusedReviewThreadReplyComposer,
  openGitHubPullRequestList,
  openMergeModal,
  openPullRequestCommentsModal,
  openSubmitReviewModal,
  sessionGitHub,
  toggleFocusedReviewThreadCollapsed,
}: Pick<
  BuildAppCommandsOptions,
  | "copyFocusedReviewCommentUrl"
  | "copyPullRequestUrl"
  | "hasFocusedReviewComment"
  | "hasFocusedReviewThread"
  | "hasReviewThreads"
  | "hasSelectedReviewThread"
  | "isGitHubAuthenticated"
  | "moveFocusedReviewComment"
  | "moveFocusedReviewThread"
  | "openCommentComposer"
  | "openFocusedReviewThreadReplyComposer"
  | "openGitHubPullRequestList"
  | "openMergeModal"
  | "openPullRequestCommentsModal"
  | "openSubmitReviewModal"
  | "sessionGitHub"
  | "toggleFocusedReviewThreadCollapsed"
>): AppCommand[] {
  const gitHubDisabledReason = getGitHubDisabledReason(sessionGitHub, isGitHubAuthenticated);
  const gitHubWriteDisabledReason = getGitHubDisabledReason(
    sessionGitHub,
    isGitHubAuthenticated,
    true,
  );
  const reviewThreadsDisabledReason =
    gitHubDisabledReason ?? "No review threads are available in the selected file.";
  const focusedReviewThreadDisabledReason =
    gitHubDisabledReason ?? "No focused review thread is available in the selected file.";
  const focusedReviewCommentDisabledReason =
    gitHubDisabledReason ?? "No focused review comment is available in the selected file.";
  const focusedReviewReplyDisabledReason =
    gitHubWriteDisabledReason ?? "No focused review comment is available in the selected file.";

  return [
    {
      category: "GitHub",
      description: "Browse your open and review-requested pull requests across repositories.",
      disabledReason: isGitHubAuthenticated
        ? undefined
        : "GitHub auth is required. Run `diffdiff auth login --token-stdin` first.",
      enabled: isGitHubAuthenticated,
      keybind: withPrefixedKeybind("shift+p", ["leader", "space"]),
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
      keybind: withPrefixedKeybind("t", ["leader", "space"]),
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
      keybind: withLeaderKeybind("y"),
      title: "Copy PR URL",
      value: "github.copy-url",
      run: () => {
        void copyPullRequestUrl();
      },
    },
    {
      category: "GitHub",
      description: "Move focus to the previous inline review thread.",
      disabledReason: reviewThreadsDisabledReason,
      enabled: sessionGitHub != null && hasReviewThreads,
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
      disabledReason: reviewThreadsDisabledReason,
      enabled: sessionGitHub != null && hasReviewThreads,
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
      enabled: sessionGitHub != null && hasFocusedReviewThread,
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
      enabled: sessionGitHub != null && hasFocusedReviewThread,
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
      keybind: withPrefixedKeybind("a", ["leader", "space"]),
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
      keybind: withPrefixedKeybind("shift+a", ["leader", "space"]),
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
      keybind: withPrefixedKeybind("m", ["leader", "space"]),
      suggested: sessionGitHub != null && isGitHubAuthenticated,
      title: "Merge pull request",
      value: "github.merge",
      run: () => openMergeModal(),
    },
  ];
}

function getGitHubDisabledReason(
  sessionGitHub: import("@diffdiff/core").GitHubReviewSession | undefined,
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
