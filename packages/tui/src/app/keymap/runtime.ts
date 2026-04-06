/**
 * Keymap runtime — the central matcher that tracks pending multi-key
 * sequences and resolves them against a mode-scoped trie.
 *
 * Modeled after Helix's `Keymaps` struct. Callers feed key events one at a
 * time via `get()` and receive a `KeymapResult` indicating whether to execute
 * an action, wait for more keys, or fall through.
 */

import { serializeKeyEvent } from "./key-event.ts";
import type {
  KeyEvent,
  KeymapResult,
  KeyTrieEntry,
  KeyTrieNode,
  ResolvedKeymaps,
} from "./types.ts";
import { NO_OP_ACTION } from "./types.ts";
import type { KeymapMode } from "../shell/keymap-mode.ts";

export interface KeymapRuntime {
  /**
   * Feed a key event for the given mode. Returns a `KeymapResult` describing
   * what happened.
   */
  get(mode: KeymapMode, event: KeyEvent): KeymapResult;

  /** The accumulated pending keys (empty when idle). */
  pending(): readonly KeyEvent[];

  /** If the runtime is sitting on a sticky node, return it. */
  sticky(): KeyTrieNode | null;

  /** Force-clear any pending state. */
  reset(): void;
}

export function createKeymapRuntime(keymaps: ResolvedKeymaps): KeymapRuntime {
  let pendingKeys: KeyEvent[] = [];
  let currentNode: KeyTrieNode | null = null;
  let stickyNode: KeyTrieNode | null = null;

  function resolveEntry(entry: KeyTrieEntry): KeymapResult {
    switch (entry.kind) {
      case "action": {
        const wasStickyContext = stickyNode != null;
        if (entry.actionId === NO_OP_ACTION) {
          // Explicit unbind — treat as not found so fallback behavior runs.
          reset();
          return { kind: "not-found" };
        }
        if (!wasStickyContext) {
          stickyNode = null;
        }
        pendingKeys = [];
        currentNode = null;
        return { kind: "matched", actionId: entry.actionId };
      }
      case "sequence": {
        stickyNode = null;
        pendingKeys = [];
        currentNode = null;
        return { kind: "matched-sequence", actionIds: entry.actionIds };
      }
      case "node": {
        currentNode = entry;
        if (entry.sticky) {
          stickyNode = entry;
        }
        return { kind: "pending", node: entry };
      }
    }
  }

  function reset(): void {
    pendingKeys = [];
    currentNode = null;
    stickyNode = null;
  }

  return {
    get(mode: KeymapMode, event: KeyEvent): KeymapResult {
      // Determine which node to search from.
      const root = currentNode ?? stickyNode ?? keymaps.get(mode);
      if (root == null) {
        reset();
        return { kind: "not-found" };
      }

      const serialized = serializeKeyEvent(event);
      const child = root.children.get(serialized);

      if (child != null) {
        pendingKeys.push(event);
        return resolveEntry(child);
      }

      // No match in current context.
      if (pendingKeys.length > 0) {
        // We had a pending prefix but the next key didn't continue it.
        const cancelled: KeymapResult = { kind: "cancelled", pending: [...pendingKeys, event] };
        pendingKeys = [];
        currentNode = null;
        // Keep sticky node alive across cancellations.
        if (stickyNode == null) {
          stickyNode = null;
        }
        return cancelled;
      }

      return { kind: "not-found" };
    },

    pending(): readonly KeyEvent[] {
      return pendingKeys;
    },

    sticky(): KeyTrieNode | null {
      return stickyNode;
    },

    reset,
  };
}
