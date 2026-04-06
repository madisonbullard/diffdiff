/**
 * Maps action ID strings to handler functions with optional count support.
 *
 * This bridges the trie-based keymap system (which resolves key sequences to
 * action IDs) with the imperative handler functions that implement each
 * behavior. Commands that accept a numeric count prefix (Helix-style `5gg`)
 * receive it through the `count` parameter.
 *
 * ## Design
 *
 * - `ActionHandler` is a function that receives an optional numeric count.
 *   The count is `null` when the user did not type a numeric prefix.
 * - `ActionDispatchMap` is a `Map<string, ActionHandler>` keyed by action ID.
 * - `dispatchAction` resolves an action ID to its handler and calls it.
 *
 * This is intentionally separate from the `AppCommand` system, which serves
 * the command palette and prefix-menu overlay. The dispatch map is the
 * primary execution path for keys resolved through the trie runtime.
 */

export type ActionHandler = (count: number | null) => void;

export type ActionDispatchMap = Map<string, ActionHandler>;

/**
 * Look up and execute the handler for the given action ID.
 * Returns `true` if a handler was found and executed.
 */
export function dispatchAction(
  map: ActionDispatchMap,
  actionId: string,
  count: number | null,
): boolean {
  const handler = map.get(actionId);
  if (handler == null) {
    return false;
  }
  handler(count);
  return true;
}
