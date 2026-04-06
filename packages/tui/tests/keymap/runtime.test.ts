import { describe, expect, test } from "vite-plus/test";
import { createKeymapRuntime } from "../../src/app/keymap/runtime.ts";
import { MutableTrieNode } from "../../src/app/keymap/trie.ts";
import { parseKeyString } from "../../src/app/keymap/key-event.ts";
import type { KeyTrieNode, ResolvedKeymaps } from "../../src/app/keymap/types.ts";
import { NO_OP_ACTION } from "../../src/app/keymap/types.ts";
import type { KeymapMode } from "../../src/app/shell/keymap-mode.ts";

function buildTestKeymaps(bindings: Record<string, string>): ResolvedKeymaps {
  const root = new MutableTrieNode();
  for (const [key, action] of Object.entries(bindings)) {
    root.setAction(key, action);
  }
  return new Map<KeymapMode, KeyTrieNode>([["diff", root.freeze()]]);
}

function buildTestKeymapsWithPrefix(): ResolvedKeymaps {
  const root = new MutableTrieNode();
  root.setAction("j", "next-file");
  const leader = root.getOrCreateChild("ctrl+x", { label: "Leader" });
  leader.setAction("l", "open-list");
  leader.setAction("v", "toggle-diff-view");
  return new Map<KeymapMode, KeyTrieNode>([["diff", root.freeze()]]);
}

describe("keymap runtime", () => {
  test("matches a direct binding", () => {
    const runtime = createKeymapRuntime(buildTestKeymaps({ j: "next-file" }));
    const result = runtime.get("diff", parseKeyString("j"));
    expect(result).toEqual({ kind: "matched", actionId: "next-file", count: null });
  });

  test("returns not-found for unbound key", () => {
    const runtime = createKeymapRuntime(buildTestKeymaps({ j: "next-file" }));
    const result = runtime.get("diff", parseKeyString("z"));
    expect(result).toEqual({ kind: "not-found" });
  });

  test("returns pending for prefix key", () => {
    const runtime = createKeymapRuntime(buildTestKeymapsWithPrefix());
    const result = runtime.get("diff", parseKeyString("ctrl+x"));
    expect(result.kind).toBe("pending");
  });

  test("matches a two-key sequence through a prefix", () => {
    const runtime = createKeymapRuntime(buildTestKeymapsWithPrefix());
    runtime.get("diff", parseKeyString("ctrl+x"));
    const result = runtime.get("diff", parseKeyString("l"));
    expect(result).toEqual({ kind: "matched", actionId: "open-list", count: null });
  });

  test("cancels a pending prefix with an unbound follow-up key", () => {
    const runtime = createKeymapRuntime(buildTestKeymapsWithPrefix());
    runtime.get("diff", parseKeyString("ctrl+x"));
    const result = runtime.get("diff", parseKeyString("z"));
    expect(result.kind).toBe("cancelled");
    if (result.kind === "cancelled") {
      expect(result.pending).toHaveLength(2);
    }
  });

  test("pending() returns accumulated keys", () => {
    const runtime = createKeymapRuntime(buildTestKeymapsWithPrefix());
    expect(runtime.pending()).toHaveLength(0);
    runtime.get("diff", parseKeyString("ctrl+x"));
    expect(runtime.pending()).toHaveLength(1);
  });

  test("reset clears pending state", () => {
    const runtime = createKeymapRuntime(buildTestKeymapsWithPrefix());
    runtime.get("diff", parseKeyString("ctrl+x"));
    runtime.reset();
    expect(runtime.pending()).toHaveLength(0);
  });

  test("treats no_op as not-found", () => {
    const root = new MutableTrieNode();
    root.setAction("j", NO_OP_ACTION);
    const keymaps = new Map<KeymapMode, KeyTrieNode>([["diff", root.freeze()]]);
    const runtime = createKeymapRuntime(keymaps);
    const result = runtime.get("diff", parseKeyString("j"));
    expect(result).toEqual({ kind: "not-found" });
  });

  test("returns not-found for a mode with no keymap", () => {
    const runtime = createKeymapRuntime(new Map());
    const result = runtime.get("diff", parseKeyString("j"));
    expect(result).toEqual({ kind: "not-found" });
  });
});
