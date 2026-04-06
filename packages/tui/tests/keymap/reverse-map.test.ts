import { describe, expect, test } from "vite-plus/test";
import { buildReverseKeymap } from "../../src/app/keymap/reverse-map.ts";
import { MutableTrieNode } from "../../src/app/keymap/trie.ts";
import { parseKeyString } from "../../src/app/keymap/key-event.ts";

describe("buildReverseKeymap", () => {
  test("maps action IDs to their key sequences", () => {
    const root = new MutableTrieNode();
    root.setAction("j", "next-file");
    root.setAction("down", "next-file");
    root.setAction("k", "prev-file");
    const frozen = root.freeze();

    const reverse = buildReverseKeymap(frozen);

    expect(reverse.get("next-file")).toHaveLength(2);
    expect(reverse.get("prev-file")).toHaveLength(1);
  });

  test("includes keys through prefix nodes", () => {
    const root = new MutableTrieNode();
    const leader = root.getOrCreateChild("ctrl+x");
    leader.setAction("l", "open-list");
    const frozen = root.freeze();

    const reverse = buildReverseKeymap(frozen);
    const bindings = reverse.get("open-list");

    expect(bindings).toHaveLength(1);
    expect(bindings![0]).toEqual([parseKeyString("ctrl+x"), parseKeyString("l")]);
  });

  test("handles sequence entries", () => {
    const root = new MutableTrieNode();
    root.setSequence("x", ["first-action", "second-action"]);
    const frozen = root.freeze();

    const reverse = buildReverseKeymap(frozen);

    // Attributed to the first action
    expect(reverse.get("first-action")).toHaveLength(1);
    expect(reverse.has("second-action")).toBe(false);
  });

  test("returns empty map for empty trie", () => {
    const root = new MutableTrieNode();
    const reverse = buildReverseKeymap(root.freeze());
    expect(reverse.size).toBe(0);
  });
});
