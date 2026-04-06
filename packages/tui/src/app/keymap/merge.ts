/**
 * Recursive merge of user keymap overrides on top of built-in defaults.
 *
 * Follows the same semantics as Helix's `merge_keys`:
 *
 * - Leaf entries in the user map replace whatever exists in the default.
 * - Node entries are recursively merged so the user can override individual
 *   keys inside a prefix group without losing the rest.
 * - The `"no_op"` action ID removes a binding entirely.
 */

import type { KeymapMode } from "../shell/keymap-mode.ts";
import { parseKeyString, serializeKeyEvent } from "./key-event.ts";
import { createAction, createSequence, MutableTrieNode } from "./trie.ts";
import type {
  KeyTrieEntry,
  KeyTrieNode,
  ResolvedKeymaps,
  UserKeymapConfig,
  UserKeymapEntry,
  UserKeymapNode,
} from "./types.ts";
import { NO_OP_ACTION } from "./types.ts";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge user overrides into the default keymaps, returning new resolved
 * keymaps. The defaults are not mutated.
 */
export function mergeUserKeymaps(
  defaults: ResolvedKeymaps,
  userConfig: UserKeymapConfig | undefined,
): ResolvedKeymaps {
  if (userConfig == null) {
    return defaults;
  }

  const result = new Map<KeymapMode, KeyTrieNode>();

  for (const [mode, defaultRoot] of defaults) {
    const userNode = userConfig[mode];
    if (userNode == null) {
      result.set(mode, defaultRoot);
      continue;
    }

    result.set(mode, mergeNodes(defaultRoot, userNode));
  }

  // Handle modes that only exist in user config (unlikely but defensive).
  for (const modeKey of Object.keys(userConfig) as KeymapMode[]) {
    if (!result.has(modeKey)) {
      result.set(modeKey, buildNodeFromUserConfig(userConfig[modeKey]!));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mergeNodes(base: KeyTrieNode, overrides: UserKeymapNode): KeyTrieNode {
  const builder = toMutableNode(base);

  for (const [keyStr, entry] of Object.entries(overrides)) {
    const serialized = serializeKeyEvent(parseKeyString(keyStr));
    const resolved = resolveUserEntry(entry);

    if (resolved.kind === "action" && resolved.actionId === NO_OP_ACTION) {
      builder.delete(serialized);
      continue;
    }

    if (resolved.kind === "node") {
      // Recursive merge if the base also has a node at this key.
      const existing = findBaseChild(base, serialized);
      if (existing != null && existing.kind === "node" && isUserKeymapNode(entry)) {
        builder.setEntry(serialized, mergeNodes(existing, entry as UserKeymapNode));
        continue;
      }
    }

    builder.setEntry(serialized, resolved);
  }

  return builder.freeze();
}

function resolveUserEntry(entry: UserKeymapEntry): KeyTrieEntry {
  if (typeof entry === "string") {
    return createAction(entry);
  }

  if (Array.isArray(entry)) {
    return createSequence(entry as string[]);
  }

  // Nested object → node
  return buildNodeFromUserConfig(entry as UserKeymapNode);
}

function buildNodeFromUserConfig(config: UserKeymapNode): KeyTrieNode {
  const builder = new MutableTrieNode();

  for (const [keyStr, entry] of Object.entries(config)) {
    const serialized = serializeKeyEvent(parseKeyString(keyStr));
    const resolved = resolveUserEntry(entry);
    if (resolved.kind === "action" && resolved.actionId === NO_OP_ACTION) {
      continue;
    }
    builder.setEntry(serialized, resolved);
  }

  return builder.freeze();
}

function toMutableNode(node: KeyTrieNode): MutableTrieNode {
  const builder = new MutableTrieNode({ label: node.label, sticky: node.sticky });
  for (const [key, child] of node.children) {
    builder.setEntry(key, child);
  }
  return builder;
}

function findBaseChild(node: KeyTrieNode, serializedKey: string): KeyTrieEntry | undefined {
  return node.children.get(serializedKey);
}

function isUserKeymapNode(value: UserKeymapEntry): value is UserKeymapNode {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
