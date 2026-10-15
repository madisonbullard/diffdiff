import type { ReverseKeymaps } from "../../app/keymap/types.ts";
import type { KeymapMode } from "../../app/shell/keymap-mode.ts";
import { formatKeySequence } from "../../app/keymap/key-event.ts";
export function keyRows(reverse: ReverseKeymaps, query: string, leaderOnly = false) {
  const rows: { mode: KeymapMode; binding: string; action: string }[] = [];
  for (const [mode, map] of reverse)
    for (const [action, sequences] of map.actions) {
      const bindings = sequences
        .map(formatKeySequence)
        .filter((key) => !leaderOnly || key.startsWith("ctrl+x "));
      if (!bindings.length) continue;
      const binding = bindings.join(" / ").replace(/return/gu, "enter");
      if (`${mode} ${binding} ${action}`.toLowerCase().includes(query.toLowerCase()))
        rows.push({ mode, binding, action });
    }
  return rows;
}
