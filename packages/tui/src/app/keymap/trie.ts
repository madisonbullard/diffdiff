/**
 * Constructors, lookup, and mutation helpers for the keymap trie.
 */

import { serializeKeyEvent } from "./key-event.ts";
import type { KeyEvent, KeymapAction, KeymapSequence, KeyTrieEntry, KeyTrieNode } from "./types.ts";

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export function createAction(actionId: string): KeymapAction {
  return { kind: "action", actionId };
}

export function createSequence(actionIds: readonly string[]): KeymapSequence {
  return { kind: "sequence", actionIds };
}

export function createNode(
  children: ReadonlyMap<string, KeyTrieEntry>,
  options?: { label?: string; sticky?: boolean },
): KeyTrieNode {
  return {
    kind: "node",
    label: options?.label,
    sticky: options?.sticky,
    children,
  };
}

export function emptyNode(options?: { label?: string; sticky?: boolean }): KeyTrieNode {
  return createNode(new Map(), options);
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/**
 * Walk a trie from `root` following the given key sequence.
 * Returns the deepest entry reached, or `undefined` if any step fails.
 */
export function searchTrie(root: KeyTrieNode, keys: readonly KeyEvent[]): KeyTrieEntry | undefined {
  let current: KeyTrieEntry = root;

  for (const key of keys) {
    if (current.kind !== "node") {
      return undefined;
    }

    const serialized = serializeKeyEvent(key);
    const child = current.children.get(serialized);
    if (child == null) {
      return undefined;
    }

    current = child;
  }

  return current;
}

// ---------------------------------------------------------------------------
// Mutable builder
// ---------------------------------------------------------------------------

/**
 * Mutable wrapper around a `KeyTrieNode` used during default-map construction
 * and user-config merge. Call `freeze()` to obtain an immutable `KeyTrieNode`.
 */
export class MutableTrieNode {
  label?: string;
  sticky?: boolean;
  private _children: Map<string, KeyTrieEntry | MutableTrieNode>;

  constructor(options?: { label?: string; sticky?: boolean }) {
    this.label = options?.label;
    this.sticky = options?.sticky;
    this._children = new Map();
  }

  /** Get or create a mutable child node for the given serialized key. */
  getOrCreateChild(serializedKey: string, options?: { label?: string }): MutableTrieNode {
    const existing = this._children.get(serializedKey);
    if (existing instanceof MutableTrieNode) {
      return existing;
    }

    const child = new MutableTrieNode({ label: options?.label });
    this._children.set(serializedKey, child);
    return child;
  }

  /** Bind a serialized key to an action leaf. */
  setAction(serializedKey: string, actionId: string): void {
    this._children.set(serializedKey, createAction(actionId));
  }

  /** Bind a serialized key to a sequence leaf. */
  setSequence(serializedKey: string, actionIds: readonly string[]): void {
    this._children.set(serializedKey, createSequence(actionIds));
  }

  /** Set an arbitrary frozen entry (used during merge). */
  setEntry(serializedKey: string, entry: KeyTrieEntry): void {
    this._children.set(serializedKey, entry);
  }

  /** Remove a binding. */
  delete(serializedKey: string): void {
    this._children.delete(serializedKey);
  }

  has(serializedKey: string): boolean {
    return this._children.has(serializedKey);
  }

  /** Freeze into an immutable `KeyTrieNode`. */
  freeze(): KeyTrieNode {
    const frozenChildren = new Map<string, KeyTrieEntry>();

    for (const [key, value] of this._children) {
      frozenChildren.set(key, value instanceof MutableTrieNode ? value.freeze() : value);
    }

    return createNode(frozenChildren, { label: this.label, sticky: this.sticky });
  }
}
