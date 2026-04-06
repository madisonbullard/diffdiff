import { describe, expect, test } from "vite-plus/test";
import {
  createAction,
  createSequence,
  MutableTrieNode,
  searchTrie,
} from "../../src/app/keymap/trie.ts";
import { parseKeyString } from "../../src/app/keymap/key-event.ts";

describe("MutableTrieNode", () => {
  test("builds a frozen trie with action leaves", () => {
    const root = new MutableTrieNode();
    root.setAction("j", "move-down");
    root.setAction("k", "move-up");
    const frozen = root.freeze();

    expect(frozen.children.size).toBe(2);
    expect(frozen.children.get("j")).toEqual(createAction("move-down"));
    expect(frozen.children.get("k")).toEqual(createAction("move-up"));
  });

  test("builds nested nodes via getOrCreateChild", () => {
    const root = new MutableTrieNode();
    const child = root.getOrCreateChild("ctrl+x", { label: "Leader" });
    child.setAction("l", "open-list");
    const frozen = root.freeze();

    const leaderNode = frozen.children.get("ctrl+x");
    expect(leaderNode?.kind).toBe("node");
    if (leaderNode?.kind === "node") {
      expect(leaderNode.label).toBe("Leader");
      expect(leaderNode.children.get("l")).toEqual(createAction("open-list"));
    }
  });

  test("supports sequence leaves", () => {
    const root = new MutableTrieNode();
    root.setSequence("x", ["first", "second"]);
    const frozen = root.freeze();

    expect(frozen.children.get("x")).toEqual(createSequence(["first", "second"]));
  });

  test("delete removes a binding", () => {
    const root = new MutableTrieNode();
    root.setAction("j", "move-down");
    root.delete("j");
    const frozen = root.freeze();

    expect(frozen.children.size).toBe(0);
  });
});

describe("searchTrie", () => {
  test("finds a direct leaf", () => {
    const root = new MutableTrieNode();
    root.setAction("j", "move-down");
    const frozen = root.freeze();

    const result = searchTrie(frozen, [parseKeyString("j")]);
    expect(result).toEqual(createAction("move-down"));
  });

  test("finds a nested leaf through a prefix", () => {
    const root = new MutableTrieNode();
    const child = root.getOrCreateChild("ctrl+x");
    child.setAction("l", "open-list");
    const frozen = root.freeze();

    const result = searchTrie(frozen, [parseKeyString("ctrl+x"), parseKeyString("l")]);
    expect(result).toEqual(createAction("open-list"));
  });

  test("returns undefined for missing key", () => {
    const root = new MutableTrieNode();
    root.setAction("j", "move-down");
    const frozen = root.freeze();

    expect(searchTrie(frozen, [parseKeyString("z")])).toBeUndefined();
  });

  test("returns the intermediate node for a partial sequence", () => {
    const root = new MutableTrieNode();
    const child = root.getOrCreateChild("ctrl+x");
    child.setAction("l", "open-list");
    const frozen = root.freeze();

    const result = searchTrie(frozen, [parseKeyString("ctrl+x")]);
    expect(result?.kind).toBe("node");
  });
});
