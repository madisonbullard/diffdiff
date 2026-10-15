import { serializeKeyEvent, parseKeyString } from "./key-event.ts";
import { MutableTrieNode } from "./trie.ts";
import * as A from "./actions.ts";

const root = new MutableTrieNode();
for (const [key, action] of [
  ["escape", A.MODAL_DISMISS],
  ["tab", A.INSPECTOR_FOCUS],
  ["shift+tab", A.INSPECTOR_FOCUS],
  ["q", A.MODAL_DISMISS],
  ["j", A.LIST_MOVE_DOWN],
  ["down", A.LIST_MOVE_DOWN],
  ["k", A.LIST_MOVE_UP],
  ["up", A.LIST_MOVE_UP],
  ["home", A.LIST_FIRST],
  ["end", A.LIST_LAST],
  ["r", A.COMPARISON_REFRESH],
  ["y", A.CHECKS_COPY_URL],
  ["pagedown", A.SCROLL_PAGE_DOWN],
  ["pageup", A.SCROLL_PAGE_UP],
] as const)
  root.setAction(serializeKeyEvent(parseKeyString(key)), action);
export const checksMode = root.freeze();
