import { describe, expect, test } from "vite-plus/test";
import { getDefaultKeymaps } from "../../src/app/keymap/defaults.ts";
import { searchTrie, createAction } from "../../src/app/keymap/trie.ts";
import { parseKeyString } from "../../src/app/keymap/key-event.ts";
import * as A from "../../src/app/keymap/actions.ts";

const defaults = getDefaultKeymaps();

describe("default keymaps", () => {
  test("provides a keymap for every expected mode", () => {
    const expectedModes = [
      "diff",
      "thread",
      "tree",
      "help",
      "commands",
      "pull-request-list",
      "pull-request-search",
      "compare-branches",
      "compare-commits",
      "commit-search",
      "filters",
      "comment",
      "conversation",
      "submit-review",
      "merge-method",
      "merge-title",
      "merge-body",
      "confirm-merge",
      "cleanup",
      "clear-reviewed",
      "diagnostics",
    ];

    for (const mode of expectedModes) {
      expect(defaults.has(mode as any), `missing mode: ${mode}`).toBe(true);
    }
  });

  test("diff mode binds j to next-file", () => {
    const entry = searchTrie(defaults.get("diff")!, [parseKeyString("j")]);
    expect(entry).toEqual(createAction(A.REVIEW_NEXT_FILE));
  });

  test("diff mode binds ctrl+p to command palette", () => {
    const entry = searchTrie(defaults.get("diff")!, [parseKeyString("ctrl+p")]);
    expect(entry).toEqual(createAction(A.SYSTEM_COMMAND_PALETTE));
  });

  test("diff mode has a leader prefix at ctrl+x", () => {
    const entry = searchTrie(defaults.get("diff")!, [parseKeyString("ctrl+x")]);
    expect(entry?.kind).toBe("node");
  });

  test("diff mode leader prefix contains open-list at l", () => {
    const entry = searchTrie(defaults.get("diff")!, [
      parseKeyString("ctrl+x"),
      parseKeyString("l"),
    ]);
    expect(entry).toEqual(createAction(A.COMPARISON_LIST));
  });

  test("diff mode space prefix contains PR list at p", () => {
    const entry = searchTrie(defaults.get("diff")!, [parseKeyString("space"), parseKeyString("p")]);
    expect(entry).toEqual(createAction(A.GITHUB_PULL_REQUEST_LIST));
  });

  test("tree mode binds j to tree move-down", () => {
    const entry = searchTrie(defaults.get("tree")!, [parseKeyString("j")]);
    expect(entry).toEqual(createAction(A.TREE_MOVE_DOWN));
  });

  test("tree mode binds return to toggle-or-open", () => {
    const entry = searchTrie(defaults.get("tree")!, [parseKeyString("return")]);
    expect(entry).toEqual(createAction(A.TREE_TOGGLE_OR_OPEN));
  });

  test("help mode binds escape to dismiss", () => {
    const entry = searchTrie(defaults.get("help")!, [parseKeyString("escape")]);
    expect(entry).toEqual(createAction(A.HELP_DISMISS));
  });

  test("commands mode binds escape to dismiss", () => {
    const entry = searchTrie(defaults.get("commands")!, [parseKeyString("escape")]);
    expect(entry).toEqual(createAction(A.MODAL_DISMISS));
  });

  test("conversation mode binds r to reply", () => {
    const entry = searchTrie(defaults.get("conversation")!, [parseKeyString("r")]);
    expect(entry).toEqual(createAction(A.CONVERSATION_REPLY));
  });

  test("thread mode binds i to focus-previous-thread", () => {
    const entry = searchTrie(defaults.get("thread")!, [parseKeyString("i")]);
    expect(entry).toEqual(createAction(A.GITHUB_FOCUS_PREVIOUS_THREAD));
  });
});
