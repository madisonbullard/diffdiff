import { describe, expect, test } from "vite-plus/test";
import { buildReverseKeymaps } from "../../src/app/keymap/reverse-map.ts";
import {
  formatCommandBindings,
  formatPrefixedActionBindings,
} from "../../src/app/keymap/display.ts";
import { MutableTrieNode } from "../../src/app/keymap/trie.ts";
import type { KeyTrieNode, ResolvedKeymaps } from "../../src/app/keymap/types.ts";
import type { KeymapMode } from "../../src/app/shell/keymap-mode.ts";

function buildKeymaps(): ResolvedKeymaps {
  const diff = new MutableTrieNode();
  diff.setAction("z", "comparison.list");
  diff.setAction("y", "system.help");
  diff.getOrCreateChild("ctrl+x", { label: "Leader" }).setAction("l", "comparison.list");
  diff.getOrCreateChild("space", { label: "Modal Picker" }).setAction("o", "comparison.list");

  const thread = new MutableTrieNode();
  thread.setAction("r", "github.reply-thread");

  return new Map<KeymapMode, KeyTrieNode>([
    ["diff", diff.freeze()],
    ["thread", thread.freeze()],
  ]);
}

describe("keymap display labels", () => {
  test("formats command labels from live reverse keymaps instead of command metadata", () => {
    const reverseKeymaps = buildReverseKeymaps(buildKeymaps());

    expect(
      formatCommandBindings(reverseKeymaps, {
        keybindingContexts: ["diff"],
        value: "comparison.list",
      }),
    ).toBe("z / ctrl+x l / space o");
  });

  test("derives prefixed overlay labels from the live prefix node path", () => {
    const reverseKeymaps = buildReverseKeymaps(buildKeymaps());

    expect(
      formatPrefixedActionBindings(reverseKeymaps, "comparison.list", "Modal Picker", "diff"),
    ).toBe("o");
  });

  test("includes thread-mode bindings for diff-context commands", () => {
    const reverseKeymaps = buildReverseKeymaps(buildKeymaps());

    expect(
      formatCommandBindings(reverseKeymaps, {
        keybindingContexts: ["diff"],
        value: "github.reply-thread",
      }),
    ).toBe("r");
  });
});
