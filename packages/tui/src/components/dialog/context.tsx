import { createContext, useContext, type ReactNode } from "react";
import type { MutableRefObject } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { KeymapMode } from "../../app/shell/keymap-mode.ts";
import type { ReverseKeymaps } from "../../app/keymap/types.ts";
import { getActionBindingSequences } from "../../app/keymap/display.ts";
import { formatKeySequence } from "../../app/keymap/key-event.ts";

export interface DialogUi {
  detailScrollRef?: MutableRefObject<ScrollBoxRenderable | null>;
  detailFocused?: boolean;
  mode: KeymapMode;
  reverse: ReverseKeymaps;
  run: (action: string, count?: number) => void;
  error?: string | null;
  newline: "extended" | "legacy";
}
const Context = createContext<DialogUi>({
  mode: "diff",
  reverse: new Map(),
  run: () => undefined,
  newline: "legacy",
});
export function DialogUiProvider({ value, children }: { value: DialogUi; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDialogUi() {
  return useContext(Context);
}
export function primaryBinding(ui: DialogUi, action: string, mode = ui.mode): string | undefined {
  if (action === "text.newline" && ui.newline === "legacy") {
    const sequences = getActionBindingSequences(ui.reverse, action, [mode]);
    if (sequences.some((sequence) => sequence.length === 1 && sequence[0]?.key === "linefeed"))
      return "ctrl+j";
  }
  const sequences = getActionBindingSequences(ui.reverse, action, [mode]).filter(
    (s) => !(s.length === 1 && s[0]?.key === "linefeed"),
  );
  const sequence = [...sequences].sort((left, right) => {
    const cost = (keys: typeof left) =>
      keys.length * 10 +
      keys.reduce((sum, key) => sum + Number(key.ctrl) + Number(key.meta) + Number(key.shift), 0);
    return cost(left) - cost(right);
  })[0];
  if (sequence == null) return undefined;
  return formatKeySequence(sequence)
    .replace(/shift\+([a-z])\b/gu, (_all, letter: string) => letter.toUpperCase())
    .replace(/return/gu, "enter");
}
