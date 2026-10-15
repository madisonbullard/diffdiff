import * as A from "./actions.ts";
import type { BindingTuple } from "./build-mode.ts";
import { buildMode } from "./build-mode.ts";
export const PICKER_POSITION_KEYS: readonly BindingTuple[] = [
  ["home", A.LIST_FIRST],
  ["end", A.LIST_LAST],
  ["pagedown", A.LIST_PAGE_DOWN],
  ["pageup", A.LIST_PAGE_UP],
];
export const KEYS_NAVIGATION: readonly BindingTuple[] = [
  ...PICKER_POSITION_KEYS,
  ["up", A.LIST_MOVE_UP],
  ["down", A.LIST_MOVE_DOWN],
  ["ctrl+p", A.LIST_MOVE_UP],
  ["ctrl+n", A.LIST_MOVE_DOWN],
  ["backspace", A.TEXT_BACKSPACE],
];
export const helpMode = buildMode([
  ["escape", A.HELP_DISMISS],
  ["tab", A.COMMANDS_SWITCH_TAB],
  ...KEYS_NAVIGATION,
]);
