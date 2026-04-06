/**
 * Core keymap types modeled after Helix's trie-based keymap system.
 *
 * Every keyboard interaction in the app routes through a mode-scoped keymap
 * that maps key sequences to named action IDs. User configuration overrides
 * are merged recursively on top of the built-in defaults.
 */

import type { KeymapMode } from "../shell/keymap-mode.ts";

// ---------------------------------------------------------------------------
// Key events
// ---------------------------------------------------------------------------

/** Normalized representation of a single key press. */
export interface KeyEvent {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

// ---------------------------------------------------------------------------
// Keymap trie
// ---------------------------------------------------------------------------

/**
 * A single leaf action or a `no_op` sentinel used to unbind a key.
 *
 * When `actionId` is `"no_op"`, the binding is explicitly removed so the key
 * falls through to fallback behavior (e.g. text insertion in input modes).
 */
export interface KeymapAction {
  readonly kind: "action";
  readonly actionId: string;
}

/** An ordered sequence of actions executed for a single binding. */
export interface KeymapSequence {
  readonly kind: "sequence";
  readonly actionIds: readonly string[];
}

/**
 * An interior node in the trie. Maps the next key press to a child
 * `KeyTrieEntry`. Optionally carries a `label` shown in the prefix-picker
 * overlay and a `sticky` flag that keeps the node active after executing a
 * child action (Helix "sticky" behavior).
 */
export interface KeyTrieNode {
  readonly kind: "node";
  readonly label?: string;
  readonly sticky?: boolean;
  readonly children: ReadonlyMap<string, KeyTrieEntry>;
}

/** Any entry that can appear inside a keymap trie. */
export type KeyTrieEntry = KeymapAction | KeymapSequence | KeyTrieNode;

// ---------------------------------------------------------------------------
// Resolved keymaps
// ---------------------------------------------------------------------------

/** The full set of resolved keymaps, one trie root per mode. */
export type ResolvedKeymaps = ReadonlyMap<KeymapMode, KeyTrieNode>;

// ---------------------------------------------------------------------------
// Keymap runtime results
// ---------------------------------------------------------------------------

export interface KeymapMatched {
  readonly kind: "matched";
  readonly actionId: string;
  /** The numeric count accumulated before this action (e.g. `5gg` → count=5). */
  readonly count: number | null;
}

export interface KeymapMatchedSequence {
  readonly kind: "matched-sequence";
  readonly actionIds: readonly string[];
  /** The numeric count accumulated before this sequence. */
  readonly count: number | null;
}

export interface KeymapPending {
  readonly kind: "pending";
  readonly node: KeyTrieNode;
}

export interface KeymapNotFound {
  readonly kind: "not-found";
}

export interface KeymapCancelled {
  readonly kind: "cancelled";
  readonly pending: readonly KeyEvent[];
}

export type KeymapResult =
  | KeymapMatched
  | KeymapMatchedSequence
  | KeymapPending
  | KeymapNotFound
  | KeymapCancelled;

// ---------------------------------------------------------------------------
// Reverse map (for help / palette display)
// ---------------------------------------------------------------------------

/** Maps action IDs to all key sequences that trigger them. */
export type ReverseKeymap = ReadonlyMap<string, readonly (readonly KeyEvent[])[]>;

// ---------------------------------------------------------------------------
// User config schema
// ---------------------------------------------------------------------------

/**
 * The shape users write in `~/.diffdiff/preferences.json` under the `"keys"`
 * field. Each top-level key is a `KeymapMode` name, and values are nested
 * objects whose leaves are action ID strings, arrays of action IDs, or the
 * literal `"no_op"`.
 */
export type UserKeymapConfig = Partial<Record<KeymapMode, UserKeymapNode>>;

export interface UserKeymapNode {
  [key: string]: UserKeymapEntry;
}

export type UserKeymapEntry = string | readonly string[] | UserKeymapNode;

// ---------------------------------------------------------------------------
// Action registry
// ---------------------------------------------------------------------------

export interface ActionDefinition {
  id: string;
  title: string;
  category: string;
  description?: string;
}

/** Sentinel action ID used to unbind a key in user config. */
export const NO_OP_ACTION = "no_op" as const;
