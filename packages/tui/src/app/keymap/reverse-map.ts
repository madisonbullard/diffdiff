/**
 * Build a reverse map from action IDs to all key sequences that trigger them.
 * Used by the help modal, command palette, prefix-picker overlay, and footer
 * to show bindings derived from the live resolved keymap rather than from
 * static annotation strings.
 */

import type { KeyEvent, KeyTrieEntry, KeyTrieNode, ReverseKeymap } from "./types.ts";

export function buildReverseKeymap(root: KeyTrieNode): ReverseKeymap {
  const result = new Map<string, KeyEvent[][]>();

  function walk(node: KeyTrieNode, prefix: KeyEvent[]): void {
    for (const [serializedKey, child] of node.children) {
      const keyEvent = deserializeKeyEvent(serializedKey);
      const currentPath = [...prefix, keyEvent];
      collectEntry(child, currentPath);
    }
  }

  function collectEntry(entry: KeyTrieEntry, path: KeyEvent[]): void {
    switch (entry.kind) {
      case "action": {
        const existing = result.get(entry.actionId) ?? [];
        existing.push(path);
        result.set(entry.actionId, existing);
        break;
      }
      case "sequence": {
        // Attribute the sequence to the first action in it.
        if (entry.actionIds.length > 0) {
          const first = entry.actionIds[0]!;
          const existing = result.get(first) ?? [];
          existing.push(path);
          result.set(first, existing);
        }
        break;
      }
      case "node":
        walk(entry, path);
        break;
    }
  }

  walk(root, []);
  return result;
}

// ---------------------------------------------------------------------------
// Key serialization round-trip
// ---------------------------------------------------------------------------

/**
 * The inverse of `serializeKeyEvent` from `key-event.ts`. Parses the compact
 * `"ctrl+shift+x"` format back into a `KeyEvent`.
 */
function deserializeKeyEvent(serialized: string): KeyEvent {
  const parts = serialized.split("+");
  const event: KeyEvent = { key: "", ctrl: false, meta: false, shift: false };

  for (const part of parts) {
    switch (part) {
      case "ctrl":
        event.ctrl = true;
        break;
      case "alt":
        event.meta = true;
        break;
      case "shift":
        event.shift = true;
        break;
      default:
        event.key = part;
    }
  }

  return event;
}
