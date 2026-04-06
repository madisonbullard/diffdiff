import { describe, expect, test } from "vite-plus/test";
import { mergeUserKeymaps } from "../../src/app/keymap/merge.ts";
import { MutableTrieNode, searchTrie, createAction } from "../../src/app/keymap/trie.ts";
import { parseKeyString } from "../../src/app/keymap/key-event.ts";
import type { KeyTrieNode, ResolvedKeymaps, UserKeymapConfig } from "../../src/app/keymap/types.ts";
import type { KeymapMode } from "../../src/app/shell/keymap-mode.ts";

function buildDefaults(): ResolvedKeymaps {
  const root = new MutableTrieNode();
  root.setAction("j", "next-file");
  root.setAction("k", "prev-file");
  const leader = root.getOrCreateChild("ctrl+x", { label: "Leader" });
  leader.setAction("l", "open-list");
  leader.setAction("v", "toggle-diff-view");
  return new Map<KeymapMode, KeyTrieNode>([["diff", root.freeze()]]);
}

describe("mergeUserKeymaps", () => {
  test("returns defaults when user config is undefined", () => {
    const defaults = buildDefaults();
    const result = mergeUserKeymaps(defaults, undefined);
    expect(result).toBe(defaults);
  });

  test("replaces a leaf binding", () => {
    const result = mergeUserKeymaps(buildDefaults(), {
      diff: { j: "custom-action" },
    });

    const entry = searchTrie(result.get("diff")!, [parseKeyString("j")]);
    expect(entry).toEqual(createAction("custom-action"));
  });

  test("preserves unmodified bindings", () => {
    const result = mergeUserKeymaps(buildDefaults(), {
      diff: { j: "custom-action" },
    });

    const entry = searchTrie(result.get("diff")!, [parseKeyString("k")]);
    expect(entry).toEqual(createAction("prev-file"));
  });

  test("unbinds a key via no_op", () => {
    const result = mergeUserKeymaps(buildDefaults(), {
      diff: { j: "no_op" },
    });

    const entry = searchTrie(result.get("diff")!, [parseKeyString("j")]);
    expect(entry).toBeUndefined();
  });

  test("recursively merges a prefix node", () => {
    const result = mergeUserKeymaps(buildDefaults(), {
      diff: {
        "ctrl+x": {
          l: "custom-list",
        },
      },
    } as UserKeymapConfig);

    // Overridden
    const l = searchTrie(result.get("diff")!, [parseKeyString("ctrl+x"), parseKeyString("l")]);
    expect(l).toEqual(createAction("custom-list"));

    // Preserved from defaults
    const v = searchTrie(result.get("diff")!, [parseKeyString("ctrl+x"), parseKeyString("v")]);
    expect(v).toEqual(createAction("toggle-diff-view"));
  });

  test("adds a new binding in user config", () => {
    const result = mergeUserKeymaps(buildDefaults(), {
      diff: { z: "new-action" },
    });

    const entry = searchTrie(result.get("diff")!, [parseKeyString("z")]);
    expect(entry).toEqual(createAction("new-action"));
  });

  test("leaves untouched modes alone", () => {
    const defaults = buildDefaults();
    const result = mergeUserKeymaps(defaults, {
      tree: { j: "tree-down" },
    } as UserKeymapConfig);

    // diff mode should be the same object
    expect(result.get("diff")).toBe(defaults.get("diff"));

    // tree mode should exist now
    const treeEntry = searchTrie(result.get("tree")!, [parseKeyString("j")]);
    expect(treeEntry).toEqual(createAction("tree-down"));
  });
});
