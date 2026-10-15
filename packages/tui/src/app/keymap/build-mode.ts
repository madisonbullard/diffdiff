import { serializeKeyEvent, parseKeyString } from "./key-event.ts";
import { MutableTrieNode } from "./trie.ts";
import type { KeyTrieNode } from "./types.ts";

export type BindingTuple = readonly [key: string, actionId: string];
const key = (raw: string) => serializeKeyEvent(parseKeyString(raw));

export function buildMode(
  bindings: readonly BindingTuple[],
  options?: { label?: string },
): KeyTrieNode {
  const root = new MutableTrieNode({ label: options?.label });
  for (const [binding, action] of bindings) root.setAction(key(binding), action);
  return root.freeze();
}

export function buildModeWithPrefixes(
  directBindings: readonly BindingTuple[],
  prefixes: readonly { trigger: string; label?: string; bindings: readonly BindingTuple[] }[],
): KeyTrieNode {
  const root = new MutableTrieNode();
  if (directBindings.some(([, action]) => action === "list.move-down")) {
    root.setAction(key("ctrl+n"), "list.move-down");
    root.setAction(key("ctrl+p"), "list.move-up");
  }
  for (const [binding, action] of directBindings) root.setAction(key(binding), action);
  for (const prefix of prefixes) {
    const child = root.getOrCreateChild(key(prefix.trigger), { label: prefix.label });
    for (const [binding, action] of prefix.bindings) child.setAction(key(binding), action);
  }
  return root.freeze();
}
