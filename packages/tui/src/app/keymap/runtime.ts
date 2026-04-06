/**
 * Keymap runtime — the central matcher that tracks pending multi-key
 * sequences, accumulates numeric count prefixes, and resolves them
 * against a mode-scoped trie.
 *
 * Modeled after Helix's `Keymaps` struct and `command_mode` numeric
 * accumulation logic. Callers feed key events one at a time via `get()`
 * and receive a `KeymapResult` indicating whether to execute an action,
 * wait for more keys, or fall through.
 *
 * ## Numeric count prefixes
 *
 * Digits 1-9 start a count when they are not bound in the current trie
 * context; once a count has started, any digit 0-9 continues it (e.g.
 * `50j` → count=50 then `j`). The count is capped at 100 000 000 to
 * prevent overflow. It is carried through pending sequences (e.g. `5gg`
 * accumulates count=5 while `g` is pending, then resolves on the second
 * `g`) and delivered on `KeymapMatched` / `KeymapMatchedSequence` results.
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

/** Maximum value for the accumulated count (prevents runaway input). */
const MAX_COUNT = 100_000_000;

function modeSupportsCounts(mode: KeymapMode): boolean {
  return mode === "diff" || mode === "thread" || mode === "tree";
}

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

  /** The in-progress numeric count, or null if none has started. */
  count(): number | null;

  /** Force-clear any pending state (including count). */
  reset(): void;
}

/**
 * Returns true when `key` is a digit that should start or continue a
 * numeric count rather than being dispatched as a command key.
 *
 * Rules (following Helix):
 *   - If a count is already accumulating, any digit 0-9 continues it.
 *   - Otherwise, digits 1-9 start a count *only if that key is not bound*
 *     in the current trie context. Digit 0 never starts a count (it
 *     falls through so it can be bound to "go to line start" etc.).
 */
function isCountDigit(
  key: string,
  currentCount: number | null,
  trieRoot: KeyTrieNode | undefined,
): { isCount: true; digit: number } | { isCount: false } {
  // Fast path: not a single ASCII digit.
  if (key.length !== 1 || key < "0" || key > "9") {
    return { isCount: false };
  }

  const digit = Number.parseInt(key, 10);

  // If count already started, any digit 0-9 continues it.
  if (currentCount != null) {
    return { isCount: true, digit };
  }

  // 0 never starts a count.
  if (digit === 0) {
    return { isCount: false };
  }

  // 1-9 starts a count only when the key is NOT bound in the trie root.
  if (trieRoot != null && trieRoot.children.has(key)) {
    return { isCount: false };
  }

  return { isCount: true, digit };
}

export function createKeymapRuntime(keymaps: ResolvedKeymaps): KeymapRuntime {
  let pendingKeys: KeyEvent[] = [];
  let currentNode: KeyTrieNode | null = null;
  let stickyNode: KeyTrieNode | null = null;
  let accumulatedCount: number | null = null;

  function consumeCount(): number | null {
    const c = accumulatedCount;
    accumulatedCount = null;
    return c;
  }

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
        const count = consumeCount();
        pendingKeys = [];
        currentNode = null;
        return { kind: "matched", actionId: entry.actionId, count };
      }
      case "sequence": {
        const count = consumeCount();
        stickyNode = null;
        pendingKeys = [];
        currentNode = null;
        return { kind: "matched-sequence", actionIds: entry.actionIds, count };
      }
      case "node": {
        currentNode = entry;
        if (entry.sticky) {
          stickyNode = entry;
        }
        // Count is NOT consumed on pending — it carries through to the
        // eventual matched action (e.g. `5gg`: count survives the first `g`).
        return { kind: "pending", node: entry };
      }
    }
  }

  function reset(): void {
    pendingKeys = [];
    currentNode = null;
    stickyNode = null;
    accumulatedCount = null;
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

      // ---------------------------------------------------------------
      // Numeric count accumulation (Helix three-branch logic)
      // ---------------------------------------------------------------
      // Only accumulate counts when we are NOT inside a pending
      // multi-key sequence (i.e. currentNode is null). Inside a pending
      // node (e.g. after pressing `g`), digits should resolve against
      // the sub-trie — they never extend a count.
      if (
        modeSupportsCounts(mode) &&
        currentNode == null &&
        !event.ctrl &&
        !event.meta &&
        !event.shift
      ) {
        const countResult = isCountDigit(event.key, accumulatedCount, root);
        if (countResult.isCount) {
          const base = accumulatedCount ?? 0;
          const next = base * 10 + countResult.digit;
          if (next <= MAX_COUNT) {
            accumulatedCount = next;
          }
          // Count digits are consumed silently — no pending key, no result.
          return { kind: "not-found" };
        }
      }

      // ---------------------------------------------------------------
      // Normal trie lookup
      // ---------------------------------------------------------------
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
        accumulatedCount = null;
        // Keep sticky node alive across cancellations.
        if (stickyNode == null) {
          stickyNode = null;
        }
        return cancelled;
      }

      // Clear count on unrecognized key with no pending prefix.
      accumulatedCount = null;
      return { kind: "not-found" };
    },

    pending(): readonly KeyEvent[] {
      return pendingKeys;
    },

    sticky(): KeyTrieNode | null {
      return stickyNode;
    },

    count(): number | null {
      return accumulatedCount;
    },

    reset,
  };
}
