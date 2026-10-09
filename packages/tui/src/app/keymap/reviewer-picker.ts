import { LEADER_PREFIX } from "./prefixes.ts";
import { serializeKeyEvent, parseKeyString } from "./key-event.ts";
import { MutableTrieNode } from "./trie.ts";
import * as A from "./actions.ts";

const root = new MutableTrieNode();
for (const [key, action] of [
  ["escape", A.MODAL_DISMISS],
  ["down", A.LIST_MOVE_DOWN],
  ["up", A.LIST_MOVE_UP],
  ["return", A.LIST_ACCEPT],
  ["backspace", A.TEXT_BACKSPACE],
  ["ctrl+s", A.REVIEWERS_SUBMIT],
  ["ctrl+r", A.REVIEWERS_REFRESH],
] as const)
  root.setAction(serializeKeyEvent(parseKeyString(key)), action);
const leader = root.getOrCreateChild(
  serializeKeyEvent(parseKeyString(LEADER_PREFIX.triggerKeybind)),
  { label: LEADER_PREFIX.nodeLabel },
);
leader.setAction(serializeKeyEvent(parseKeyString("j")), A.LIST_MOVE_DOWN);
leader.setAction(serializeKeyEvent(parseKeyString("k")), A.LIST_MOVE_UP);
export const reviewerPickerMode = root.freeze();
