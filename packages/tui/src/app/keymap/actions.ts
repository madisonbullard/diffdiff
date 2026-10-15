/**
 * Canonical action IDs for every remappable behavior in the app.
 *
 * These are stable string identifiers. The default keymaps in `defaults.ts`
 * bind key sequences to these IDs, and user config can remap any key to any
 * action ID listed here.
 *
 * Naming convention: `<category>.<verb>[-<object>]`
 */

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------
export const SYSTEM_HELP = "system.help";
export const SYSTEM_COMMAND_PALETTE = "system.command-palette";
export const SYSTEM_DIAGNOSTICS = "system.diagnostics";
export const SYSTEM_QUIT = "system.quit";

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------
export const COMPARISON_REFRESH = "comparison.refresh";
export const COMPARISON_LIST = "comparison.list";

// ---------------------------------------------------------------------------
// View / pane
// ---------------------------------------------------------------------------
export const VIEW_PANE_TOGGLE = "view.pane-toggle";
export const SCROLL_PAGE_DOWN = "scroll.page-down";
export const SCROLL_PAGE_UP = "scroll.page-up";
export const SCROLL_HALF_PAGE_DOWN = "scroll.half-page-down";
export const SCROLL_HALF_PAGE_UP = "scroll.half-page-up";
export const VIEW_DIFF_TOGGLE = "view.diff-toggle";
export const VIEW_COPY_REOPEN_COMMAND = "view.copy-reopen-command";
export const VIEW_OPEN_FILE_IN_EDITOR = "view.open-file-in-editor";

// ---------------------------------------------------------------------------
// Review / file navigation (diff pane)
// ---------------------------------------------------------------------------
export const REVIEW_NEXT_FILE = "review.next-file";
export const REVIEW_PREVIOUS_FILE = "review.previous-file";
export const REVIEW_FIRST_FILE = "review.first-file";
export const REVIEW_LAST_FILE = "review.last-file";
export const REVIEW_TOGGLE_REVIEWED = "review.toggle-reviewed";
export const REVIEW_TOGGLE_COLLAPSED = "review.toggle-collapsed";
export const REVIEW_NEXT_UNREVIEWED = "review.next-unreviewed";
export const REVIEW_CLEAR_REVIEWED = "review.clear-reviewed";
export const REVIEW_NEXT_ANCHOR = "review.next-anchor";
export const REVIEW_PREVIOUS_ANCHOR = "review.previous-anchor";
export const REVIEW_EXTEND_PREVIOUS_LINE = "review.extend-previous-line";
export const REVIEW_EXTEND_NEXT_LINE = "review.extend-next-line";

// ---------------------------------------------------------------------------
// Tree pane
// ---------------------------------------------------------------------------
export const TREE_MOVE_DOWN = "tree.move-down";
export const TREE_MOVE_UP = "tree.move-up";
export const TREE_FIRST = "tree.first";
export const TREE_LAST = "tree.last";
export const TREE_EXPAND_OR_CHILD = "tree.expand-or-child";
export const TREE_COLLAPSE_OR_PARENT = "tree.collapse-or-parent";
export const TREE_TOGGLE_OR_OPEN = "tree.toggle-or-open";

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------
export const GITHUB_PULL_REQUEST_LIST = "github.pull-request-list";
export const GITHUB_REQUEST_REVIEWERS = "github.request-reviewers";
export const GITHUB_TOGGLE_DRAFT = "github.toggle-draft";
export const REVIEWERS_SUBMIT = "reviewers.submit";
export const REVIEWERS_TOGGLE_AT = "reviewers.toggle-at";
export const REVIEWERS_REFRESH = "reviewers.refresh";
export const GITHUB_COMMENTS = "github.comments";
export const GITHUB_COPY_URL = "github.copy-url";
export const GITHUB_FOCUS_PREVIOUS_THREAD = "github.focus-previous-thread";
export const GITHUB_FOCUS_NEXT_THREAD = "github.focus-next-thread";
export const GITHUB_FOCUS_PREVIOUS_COMMENT = "github.focus-previous-comment";
export const GITHUB_FOCUS_NEXT_COMMENT = "github.focus-next-comment";
export const GITHUB_ADD_COMMENT = "github.add-comment";
export const GITHUB_REPLY_THREAD = "github.reply-thread";
export const GITHUB_TOGGLE_THREAD = "github.toggle-thread";
export const GITHUB_COPY_COMMENT_URL = "github.copy-comment-url";
export const GITHUB_SUBMIT_REVIEW = "github.submit-review";
export const GITHUB_MERGE = "github.merge";
export const GITHUB_CHECKS = "github.checks";
export const CHECKS_COPY_URL = "checks.copy-url";

// ---------------------------------------------------------------------------
// Goto / positional navigation (g prefix menu)
// ---------------------------------------------------------------------------
export const GOTO_FIRST_FILE = "goto.first-file";
export const GOTO_LAST_FILE = "goto.last-file";
export const GOTO_WINDOW_TOP = "goto.window-top";
export const GOTO_WINDOW_CENTER = "goto.window-center";
export const GOTO_WINDOW_BOTTOM = "goto.window-bottom";
export const GOTO_NEXT_HUNK = "goto.next-hunk";
export const GOTO_PREVIOUS_HUNK = "goto.previous-hunk";
export const GOTO_LAST_ACCESSED_FILE = "goto.last-accessed-file";
export const GOTO_SELECTED_FILE_LINE = "goto.selected-file-line";

// ---------------------------------------------------------------------------
// Generic list/modal navigation (shared across many modals)
// ---------------------------------------------------------------------------
export const LIST_MOVE_DOWN = "list.move-down";
export const LIST_MOVE_UP = "list.move-up";
export const LIST_FIRST = "list.first";
export const LIST_LAST = "list.last";
export const LIST_PAGE_DOWN = "list.page-down";
export const LIST_PAGE_UP = "list.page-up";
export const LIST_ACCEPT = "list.accept";

// ---------------------------------------------------------------------------
// Modal lifecycle
// ---------------------------------------------------------------------------
export const MODAL_DISMISS = "modal.dismiss";

// ---------------------------------------------------------------------------
// Text input (shared across text-entry modals)
// ---------------------------------------------------------------------------
export const TEXT_BACKSPACE = "text.backspace";
export const TEXT_NEWLINE = "text.newline";
export const REVIEW_SWITCH_FIELD = "review.switch-field";
export const COMMANDS_SWITCH_TAB = "commands.switch-tab";
export const INSPECTOR_FOCUS = "inspector.focus";
export const MERGE_TOGGLE_CLEANUP = "merge.toggle-cleanup";
export const MERGE_PREVIOUS_FIELD = "merge.previous-field";
export const TEXT_ACCEPT_COMPLETION = "text.accept-completion";
export const TEXT_OPEN_EXTERNAL_EDITOR = "text.open-external-editor";

// ---------------------------------------------------------------------------
// Command palette specific
// ---------------------------------------------------------------------------
export const COMMAND_PALETTE_RUN = "command-palette.run";

// ---------------------------------------------------------------------------
// Branch list specific
// ---------------------------------------------------------------------------
export const BRANCH_SWITCH_TAB = "branch.switch-tab";
export const BRANCH_GO_TO_BRANCHES = "branch.go-to-branches";
export const BRANCH_GO_TO_COMMITS = "branch.go-to-commits";
export const BRANCH_OPEN_FILTERS = "branch.open-filters";
export const BRANCH_TOGGLE_REMOTE = "branch.toggle-remote";
export const BRANCH_SELECT_HEAD = "branch.select-head";
export const BRANCH_SELECT_BASE = "branch.select-base";
export const BRANCH_SELECT_WORKING_TREE = "branch.select-working-tree";
export const BRANCH_SEARCH = "branch.search";

// ---------------------------------------------------------------------------
// Pull request list specific
// ---------------------------------------------------------------------------
export const PR_LIST_REFRESH = "pr-list.refresh";
export const PR_LIST_SEARCH = "pr-list.search";

// ---------------------------------------------------------------------------
// List filter specific
// ---------------------------------------------------------------------------
export const FILTER_TOGGLE = "filter.toggle";
export const FILTER_ENABLE_ALL = "filter.enable-all";
export const FILTER_DISABLE_ALL = "filter.disable-all";

// ---------------------------------------------------------------------------
// Conversation modal specific
// ---------------------------------------------------------------------------
export const CONVERSATION_REPLY = "conversation.reply";
export const CONVERSATION_COPY_URL = "conversation.copy-url";

// ---------------------------------------------------------------------------
// Submit review modal specific
// ---------------------------------------------------------------------------
export const SUBMIT_REVIEW_SUBMIT = "submit-review.submit";

// ---------------------------------------------------------------------------
// Merge modal specific
// ---------------------------------------------------------------------------
export const MERGE_NEXT_FIELD = "merge.next-field";
export const MERGE_TOGGLE_AUTO = "merge.toggle-auto";
export const MERGE_CONFIRM = "merge.confirm";

// ---------------------------------------------------------------------------
// Cleanup modal specific
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Clear-reviewed modal specific
// ---------------------------------------------------------------------------
export const CLEAR_REVIEWED_CONFIRM = "clear-reviewed.confirm";

// ---------------------------------------------------------------------------
// Help modal specific
// ---------------------------------------------------------------------------
export const HELP_DISMISS = "help.dismiss";
