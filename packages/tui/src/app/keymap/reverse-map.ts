/**
 * Build a reverse map from action IDs to all key sequences that trigger them.
 * Used by the help modal, command palette, prefix-picker overlay, and footer
 * to show bindings derived from the live resolved keymap rather than from
 * static annotation strings.
 */

import type {
  KeyEvent,
  KeyTrieEntry,
  KeyTrieNode,
  ResolvedKeymaps,
  ReverseKeymap,
  ReverseKeymaps,
  ReverseModeKeymap,
} from "./types.ts";

export function buildReverseKeymap(root: KeyTrieNode): ReverseKeymap {
  return buildReverseModeKeymap(root).actions;
}

export function buildReverseModeKeymap(root: KeyTrieNode): ReverseModeKeymap {
  const actions = new Map<string, KeyEvent[][]>();
  const nodes = new Map<string, KeyEvent[][]>();

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
        const existing = actions.get(entry.actionId) ?? [];
        existing.push(path);
        actions.set(entry.actionId, existing);
        break;
      }
      case "sequence": {
        // Attribute the sequence to the first action in it.
        if (entry.actionIds.length > 0) {
          const first = entry.actionIds[0]!;
          const existing = actions.get(first) ?? [];
          existing.push(path);
          actions.set(first, existing);
        }
        break;
      }
      case "node": {
        if (entry.label != null) {
          const existing = nodes.get(entry.label) ?? [];
          existing.push(path);
          nodes.set(entry.label, existing);
        }
        walk(entry, path);
        break;
      }
    }
  }

  walk(root, []);
  return {
    actions,
    nodes,
  } satisfies ReverseModeKeymap;
}

export function buildReverseKeymaps(keymaps: ResolvedKeymaps): ReverseKeymaps {
  return new Map(
    [...keymaps.entries()].map(([mode, root]) => [mode, buildReverseModeKeymap(root)]),
  );
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
