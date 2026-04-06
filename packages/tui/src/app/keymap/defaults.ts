/**
 * Default keymaps for every KeymapMode.
 *
 * These encode every hardcoded key binding that previously lived in
 * imperative `if (key.name === ...)` handlers. User config in
 * `~/.diffdiff/preferences.json` merges on top of these via `merge.ts`.
 */

import type { KeymapMode } from "../shell/keymap-mode.ts";
import { serializeKeyEvent, parseKeyString } from "./key-event.ts";
import { MutableTrieNode } from "./trie.ts";
import type { KeyTrieNode, ResolvedKeymaps } from "./types.ts";
import * as A from "./actions.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function k(raw: string): string {
  return serializeKeyEvent(parseKeyString(raw));
}

type BindingTuple = readonly [key: string, actionId: string];

function buildMode(bindings: readonly BindingTuple[], options?: { label?: string }): KeyTrieNode {
  const root = new MutableTrieNode({ label: options?.label });

  for (const [keyStr, actionId] of bindings) {
    root.setAction(k(keyStr), actionId);
  }

  return root.freeze();
}

/**
 * Build a mode that contains a prefix sub-node (e.g. `ctrl+x` as leader,
 * `space` as modal picker).
 */
function buildModeWithPrefixes(
  directBindings: readonly BindingTuple[],
  prefixes: readonly {
    trigger: string;
    label?: string;
    bindings: readonly BindingTuple[];
  }[],
): KeyTrieNode {
  const root = new MutableTrieNode();

  for (const [keyStr, actionId] of directBindings) {
    root.setAction(k(keyStr), actionId);
  }

  for (const prefix of prefixes) {
    const child = root.getOrCreateChild(k(prefix.trigger), { label: prefix.label });
    for (const [keyStr, actionId] of prefix.bindings) {
      child.setAction(k(keyStr), actionId);
    }
  }

  return root.freeze();
}

// ---------------------------------------------------------------------------
// Shared binding sets
// ---------------------------------------------------------------------------

const LIST_NAVIGATION: readonly BindingTuple[] = [
  ["j", A.LIST_MOVE_DOWN],
  ["down", A.LIST_MOVE_DOWN],
  ["k", A.LIST_MOVE_UP],
  ["up", A.LIST_MOVE_UP],
  ["home", A.LIST_FIRST],
  ["end", A.LIST_LAST],
];

const MODAL_DISMISS: readonly BindingTuple[] = [
  ["escape", A.MODAL_DISMISS],
  ["q", A.MODAL_DISMISS],
];

// ---------------------------------------------------------------------------
// Diff pane (default/main)
// ---------------------------------------------------------------------------

const DIFF_LEADER_BINDINGS: readonly BindingTuple[] = [
  ["d", A.SYSTEM_DIAGNOSTICS],
  ["shift+r", A.COMPARISON_REFRESH],
  ["l", A.COMPARISON_LIST],
  ["v", A.VIEW_DIFF_TOGGLE],
  ["e", A.VIEW_OPEN_FILE_IN_EDITOR],
  ["y", A.GITHUB_COPY_URL],
  ["r", A.REVIEW_TOGGLE_REVIEWED],
  ["u", A.REVIEW_NEXT_UNREVIEWED],
  ["c", A.REVIEW_TOGGLE_COLLAPSED],
  ["alt+r", A.REVIEW_CLEAR_REVIEWED],
  ["p", A.GITHUB_PULL_REQUEST_LIST],
  ["t", A.GITHUB_COMMENTS],
  ["a", A.GITHUB_ADD_COMMENT],
  ["shift+a", A.GITHUB_SUBMIT_REVIEW],
  ["m", A.GITHUB_MERGE],
  ["q", A.SYSTEM_QUIT],
  ["shift+/", A.SYSTEM_HELP],
  ["h", A.SYSTEM_HELP],
];

const DIFF_SPACE_BINDINGS: readonly BindingTuple[] = [
  ["d", A.SYSTEM_DIAGNOSTICS],
  ["h", A.SYSTEM_HELP],
  ["p", A.GITHUB_PULL_REQUEST_LIST],
  ["t", A.GITHUB_COMMENTS],
  ["a", A.GITHUB_ADD_COMMENT],
  ["shift+a", A.GITHUB_SUBMIT_REVIEW],
  ["m", A.GITHUB_MERGE],
  ["l", A.COMPARISON_LIST],
];

const GOTO_BINDINGS: readonly BindingTuple[] = [
  ["g", A.GOTO_FIRST_FILE],
  ["e", A.GOTO_LAST_FILE],
  ["t", A.GOTO_WINDOW_TOP],
  ["c", A.GOTO_WINDOW_CENTER],
  ["b", A.GOTO_WINDOW_BOTTOM],
  ["n", A.GOTO_NEXT_HUNK],
  ["p", A.GOTO_PREVIOUS_HUNK],
  ["a", A.GOTO_LAST_ACCESSED_FILE],
];

const diffMode = buildModeWithPrefixes(
  [
    // System
    ["ctrl+p", A.SYSTEM_COMMAND_PALETTE],
    ["shift+/", A.SYSTEM_HELP],
    ["d", A.SYSTEM_DIAGNOSTICS],

    // Navigation
    ["tab", A.VIEW_PANE_TOGGLE],
    ["j", A.REVIEW_NEXT_FILE],
    ["down", A.REVIEW_NEXT_FILE],
    ["k", A.REVIEW_PREVIOUS_FILE],
    ["up", A.REVIEW_PREVIOUS_FILE],
    ["home", A.REVIEW_FIRST_FILE],
    ["end", A.REVIEW_LAST_FILE],

    // Review
    ["r", A.REVIEW_TOGGLE_REVIEWED],
    ["x", A.REVIEW_TOGGLE_REVIEWED],
    ["c", A.REVIEW_TOGGLE_COLLAPSED],
    ["z", A.REVIEW_TOGGLE_COLLAPSED],
    ["u", A.REVIEW_NEXT_UNREVIEWED],
    ["alt+r", A.REVIEW_CLEAR_REVIEWED],
    ["e", A.VIEW_OPEN_FILE_IN_EDITOR],
    ["v", A.VIEW_DIFF_TOGGLE],

    // Review anchors
    ["]", A.REVIEW_NEXT_ANCHOR],
    ["[", A.REVIEW_PREVIOUS_ANCHOR],

    // Inline thread focus (entry from diff into thread mode)
    ["i", A.GITHUB_FOCUS_PREVIOUS_THREAD],
    ["o", A.GITHUB_FOCUS_NEXT_THREAD],

    // Comparison
    ["shift+r", A.COMPARISON_REFRESH],
    ["l", A.COMPARISON_LIST],

    // GitHub shortcuts (prefixed versions also exist)
    ["p", A.GITHUB_PULL_REQUEST_LIST],
    ["t", A.GITHUB_COMMENTS],
    ["a", A.GITHUB_ADD_COMMENT],
    ["shift+a", A.GITHUB_SUBMIT_REVIEW],
    ["m", A.GITHUB_MERGE],
    ["y", A.GITHUB_COPY_URL],

    // System
    ["q", A.SYSTEM_QUIT],
  ],
  [
    { trigger: "ctrl+x", label: "Leader", bindings: DIFF_LEADER_BINDINGS },
    { trigger: "space", label: "Modal Picker", bindings: DIFF_SPACE_BINDINGS },
    { trigger: "g", label: "Goto", bindings: GOTO_BINDINGS },
  ],
);

// ---------------------------------------------------------------------------
// Thread mode (diff pane with a focused review thread)
// ---------------------------------------------------------------------------

const THREAD_LEADER_BINDINGS = DIFF_LEADER_BINDINGS;
const THREAD_SPACE_BINDINGS = DIFF_SPACE_BINDINGS;

const threadMode = buildModeWithPrefixes(
  [
    // System
    ["ctrl+p", A.SYSTEM_COMMAND_PALETTE],
    ["shift+/", A.SYSTEM_HELP],
    ["d", A.SYSTEM_DIAGNOSTICS],

    // Pane toggle
    ["tab", A.VIEW_PANE_TOGGLE],

    // File navigation
    ["j", A.REVIEW_NEXT_FILE],
    ["down", A.REVIEW_NEXT_FILE],
    ["k", A.REVIEW_PREVIOUS_FILE],
    ["up", A.REVIEW_PREVIOUS_FILE],
    ["home", A.REVIEW_FIRST_FILE],
    ["end", A.REVIEW_LAST_FILE],

    // Review
    ["x", A.REVIEW_TOGGLE_REVIEWED],
    ["z", A.REVIEW_TOGGLE_COLLAPSED],
    ["u", A.REVIEW_NEXT_UNREVIEWED],
    ["alt+r", A.REVIEW_CLEAR_REVIEWED],
    ["e", A.VIEW_OPEN_FILE_IN_EDITOR],
    ["v", A.VIEW_DIFF_TOGGLE],

    // Anchors
    ["]", A.REVIEW_NEXT_ANCHOR],
    ["[", A.REVIEW_PREVIOUS_ANCHOR],

    // Thread-specific
    ["i", A.GITHUB_FOCUS_PREVIOUS_THREAD],
    ["o", A.GITHUB_FOCUS_NEXT_THREAD],
    ["[", A.GITHUB_FOCUS_PREVIOUS_COMMENT],
    ["]", A.GITHUB_FOCUS_NEXT_COMMENT],
    ["r", A.GITHUB_REPLY_THREAD],
    ["c", A.GITHUB_TOGGLE_THREAD],
    ["y", A.GITHUB_COPY_COMMENT_URL],

    // Comparison
    ["shift+r", A.COMPARISON_REFRESH],
    ["l", A.COMPARISON_LIST],
    ["p", A.GITHUB_PULL_REQUEST_LIST],
    ["t", A.GITHUB_COMMENTS],
    ["a", A.GITHUB_ADD_COMMENT],
    ["shift+a", A.GITHUB_SUBMIT_REVIEW],
    ["m", A.GITHUB_MERGE],

    // System
    ["q", A.SYSTEM_QUIT],
  ],
  [
    { trigger: "ctrl+x", label: "Leader", bindings: THREAD_LEADER_BINDINGS },
    { trigger: "space", label: "Modal Picker", bindings: THREAD_SPACE_BINDINGS },
    { trigger: "g", label: "Goto", bindings: GOTO_BINDINGS },
  ],
);

// ---------------------------------------------------------------------------
// Tree pane
// ---------------------------------------------------------------------------

const TREE_LEADER_BINDINGS = DIFF_LEADER_BINDINGS;
const TREE_SPACE_BINDINGS = DIFF_SPACE_BINDINGS;

const treeMode = buildModeWithPrefixes(
  [
    // System
    ["ctrl+p", A.SYSTEM_COMMAND_PALETTE],
    ["shift+/", A.SYSTEM_HELP],
    ["d", A.SYSTEM_DIAGNOSTICS],

    // Pane toggle
    ["tab", A.VIEW_PANE_TOGGLE],

    // Tree navigation
    ["j", A.TREE_MOVE_DOWN],
    ["down", A.TREE_MOVE_DOWN],
    ["k", A.TREE_MOVE_UP],
    ["up", A.TREE_MOVE_UP],
    ["home", A.TREE_FIRST],
    ["end", A.TREE_LAST],
    ["right", A.TREE_EXPAND_OR_CHILD],
    ["l", A.TREE_EXPAND_OR_CHILD],
    ["left", A.TREE_COLLAPSE_OR_PARENT],
    ["h", A.TREE_COLLAPSE_OR_PARENT],
    ["return", A.TREE_TOGGLE_OR_OPEN],

    // Review (still accessible from tree)
    ["x", A.REVIEW_TOGGLE_REVIEWED],
    ["z", A.REVIEW_TOGGLE_COLLAPSED],
    ["u", A.REVIEW_NEXT_UNREVIEWED],
    ["alt+r", A.REVIEW_CLEAR_REVIEWED],
    ["e", A.VIEW_OPEN_FILE_IN_EDITOR],
    ["v", A.VIEW_DIFF_TOGGLE],

    // Comparison
    ["shift+r", A.COMPARISON_REFRESH],
    ["p", A.GITHUB_PULL_REQUEST_LIST],
    ["t", A.GITHUB_COMMENTS],
    ["a", A.GITHUB_ADD_COMMENT],
    ["shift+a", A.GITHUB_SUBMIT_REVIEW],
    ["m", A.GITHUB_MERGE],
    ["y", A.GITHUB_COPY_URL],

    // System
    ["q", A.SYSTEM_QUIT],
  ],
  [
    { trigger: "ctrl+x", label: "Leader", bindings: TREE_LEADER_BINDINGS },
    { trigger: "space", label: "Modal Picker", bindings: TREE_SPACE_BINDINGS },
    { trigger: "g", label: "Goto", bindings: GOTO_BINDINGS },
  ],
);

// ---------------------------------------------------------------------------
// Help modal
// ---------------------------------------------------------------------------

const helpMode = buildMode([
  ["escape", A.HELP_DISMISS],
  ["q", A.HELP_DISMISS],
  ["shift+/", A.HELP_DISMISS],
]);

// ---------------------------------------------------------------------------
// Command palette
// ---------------------------------------------------------------------------

const commandsMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ["down", A.LIST_MOVE_DOWN],
  ["up", A.LIST_MOVE_UP],
  ["pagedown", A.LIST_PAGE_DOWN],
  ["pageup", A.LIST_PAGE_UP],
  ["home", A.LIST_FIRST],
  ["end", A.LIST_LAST],
  ["backspace", A.TEXT_BACKSPACE],
  ["return", A.COMMAND_PALETTE_RUN],
]);

// ---------------------------------------------------------------------------
// Pull request list
// ---------------------------------------------------------------------------

const pullRequestListMode = buildMode([
  ...MODAL_DISMISS,
  ...LIST_NAVIGATION,
  ["shift+f", A.PR_LIST_REFRESH],
  ["/", A.PR_LIST_SEARCH],
  ["return", A.LIST_ACCEPT],
]);

// ---------------------------------------------------------------------------
// Pull request search
// ---------------------------------------------------------------------------

const pullRequestSearchMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ["return", A.LIST_ACCEPT],
  ["backspace", A.TEXT_BACKSPACE],
  ["down", A.LIST_MOVE_DOWN],
  ["up", A.LIST_MOVE_UP],
]);

// ---------------------------------------------------------------------------
// Compare branches
// ---------------------------------------------------------------------------

const compareBranchesMode = buildMode([
  ...MODAL_DISMISS,
  ...LIST_NAVIGATION,
  ["tab", A.BRANCH_SWITCH_TAB],
  ["left", A.BRANCH_GO_TO_BRANCHES],
  ["right", A.BRANCH_GO_TO_COMMITS],
  ["l", A.BRANCH_GO_TO_COMMITS],
  ["f", A.BRANCH_OPEN_FILTERS],
  ["o", A.BRANCH_TOGGLE_REMOTE],
  ["return", A.LIST_ACCEPT],
  ["h", A.BRANCH_SELECT_HEAD],
  ["b", A.BRANCH_SELECT_BASE],
  ["w", A.BRANCH_SELECT_WORKING_TREE],
]);

// ---------------------------------------------------------------------------
// Compare commits
// ---------------------------------------------------------------------------

const compareCommitsMode = buildMode([
  ...MODAL_DISMISS,
  ...LIST_NAVIGATION,
  ["tab", A.BRANCH_SWITCH_TAB],
  ["left", A.BRANCH_GO_TO_BRANCHES],
  ["/", A.BRANCH_SEARCH],
  ["h", A.BRANCH_SELECT_HEAD],
  ["b", A.BRANCH_SELECT_BASE],
]);

// ---------------------------------------------------------------------------
// Commit search
// ---------------------------------------------------------------------------

const commitSearchMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ["return", A.LIST_ACCEPT],
  ["backspace", A.TEXT_BACKSPACE],
  ["down", A.LIST_MOVE_DOWN],
  ["up", A.LIST_MOVE_UP],
]);

// ---------------------------------------------------------------------------
// List filter
// ---------------------------------------------------------------------------

const filtersMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ["q", A.MODAL_DISMISS],
  ["f", A.MODAL_DISMISS],
  ...LIST_NAVIGATION,
  ["return", A.FILTER_TOGGLE],
  ["space", A.FILTER_TOGGLE],
  ["a", A.FILTER_ENABLE_ALL],
  ["n", A.FILTER_DISABLE_ALL],
]);

// ---------------------------------------------------------------------------
// Comment composer
// ---------------------------------------------------------------------------

const commentMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ["backspace", A.TEXT_BACKSPACE],
  ["shift+return", A.TEXT_NEWLINE],
  ["return", A.LIST_ACCEPT],
]);

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

const conversationMode = buildMode([
  ...MODAL_DISMISS,
  ["t", A.MODAL_DISMISS],
  ...LIST_NAVIGATION,
  ["r", A.CONVERSATION_REPLY],
  ["y", A.CONVERSATION_COPY_URL],
]);

// ---------------------------------------------------------------------------
// Submit review
// ---------------------------------------------------------------------------

const submitReviewMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ["down", A.LIST_MOVE_DOWN],
  ["up", A.LIST_MOVE_UP],
  ["backspace", A.TEXT_BACKSPACE],
  ["shift+return", A.TEXT_NEWLINE],
  ["return", A.SUBMIT_REVIEW_SUBMIT],
]);

// ---------------------------------------------------------------------------
// Merge (method, title, body)
// ---------------------------------------------------------------------------

const mergeMethodMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ["tab", A.MERGE_NEXT_FIELD],
  ["j", A.LIST_MOVE_DOWN],
  ["down", A.LIST_MOVE_DOWN],
  ["k", A.LIST_MOVE_UP],
  ["up", A.LIST_MOVE_UP],
  ["return", A.MERGE_CONFIRM],
]);

const mergeTitleMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ["tab", A.MERGE_NEXT_FIELD],
  ["backspace", A.TEXT_BACKSPACE],
  ["return", A.MERGE_CONFIRM],
]);

const mergeBodyMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ["tab", A.MERGE_NEXT_FIELD],
  ["backspace", A.TEXT_BACKSPACE],
  ["shift+return", A.TEXT_NEWLINE],
  ["return", A.MERGE_CONFIRM],
]);

// ---------------------------------------------------------------------------
// Confirm merge
// ---------------------------------------------------------------------------

const confirmMergeMode = buildMode([...MODAL_DISMISS, ["return", A.MERGE_CONFIRM]]);

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

const cleanupMode = buildMode([
  ["escape", A.MODAL_DISMISS],
  ...LIST_NAVIGATION,
  ["space", A.CLEANUP_TOGGLE_OPTION],
  ["return", A.CLEANUP_APPLY],
]);

// ---------------------------------------------------------------------------
// Clear reviewed
// ---------------------------------------------------------------------------

const clearReviewedMode = buildMode([...MODAL_DISMISS, ["return", A.CLEAR_REVIEWED_CONFIRM]]);

// ---------------------------------------------------------------------------
// Diagnostics — uses same dismiss/navigation bindings
// ---------------------------------------------------------------------------

const diagnosticsMode = buildMode([...MODAL_DISMISS, ...LIST_NAVIGATION]);

// ---------------------------------------------------------------------------
// Assembled default keymaps
// ---------------------------------------------------------------------------

export function getDefaultKeymaps(): ResolvedKeymaps {
  const map = new Map<KeymapMode, KeyTrieNode>();

  map.set("diff", diffMode);
  map.set("thread", threadMode);
  map.set("tree", treeMode);
  map.set("help", helpMode);
  map.set("commands", commandsMode);
  map.set("pull-request-list", pullRequestListMode);
  map.set("pull-request-search", pullRequestSearchMode);
  map.set("compare-branches", compareBranchesMode);
  map.set("compare-commits", compareCommitsMode);
  map.set("commit-search", commitSearchMode);
  map.set("filters", filtersMode);
  map.set("comment", commentMode);
  map.set("conversation", conversationMode);
  map.set("submit-review", submitReviewMode);
  map.set("merge-method", mergeMethodMode);
  map.set("merge-title", mergeTitleMode);
  map.set("merge-body", mergeBodyMode);
  map.set("confirm-merge", confirmMergeMode);
  map.set("cleanup", cleanupMode);
  map.set("clear-reviewed", clearReviewedMode);
  map.set("diagnostics", diagnosticsMode);

  return map;
}
