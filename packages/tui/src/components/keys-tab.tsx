import type { UiTheme } from "../theme.ts";
import type { TextInputSurface } from "../text-input-surface.ts";
import { TextInputContent } from "./text-input-content.tsx";
import { DialogPanel } from "./dialog/panel.tsx";
import { DialogList, DialogRow } from "./dialog/list-view.tsx";
import { useDialogUi } from "./dialog/context.tsx";
import { keyRows } from "./dialog/key-rows.ts";
import { fitText } from "./dialog/text.ts";
import * as A from "../app/keymap/actions.ts";
export function KeysTab({
  theme,
  query,
  index,
  leaderOnly,
}: {
  theme: UiTheme;
  query: TextInputSurface;
  index: number;
  leaderOnly: boolean;
}) {
  const ui = useDialogUi();
  const rows = keyRows(ui.reverse, query.value, leaderOnly);
  return (
    <DialogPanel
      title="Keys"
      tabs={[
        { label: "Commands", active: false, action: A.COMMANDS_SWITCH_TAB },
        { label: "Keys", active: true, action: A.COMMANDS_SWITCH_TAB },
      ]}
      context={leaderOnly ? "Leader · ctrl+x" : "Resolved bindings · includes your overrides"}
      family="picker"
      theme={theme}
      position={`${rows.length ? Math.min(index + 1, rows.length) : 0}/${rows.length}`}
      actions={[
        { action: A.LIST_MOVE_DOWN, label: "move" },
        { action: A.COMMANDS_SWITCH_TAB, label: "commands" },
      ]}
    >
      {(rect) => (
        <>
          <text height={1} flexShrink={0} fg={theme.text}>
            <TextInputContent
              surface={query}
              cursorColor={theme.accent}
              placeholder="Search keys, modes, or actions…"
              placeholderColor={theme.textMuted}
            />
          </text>
          <DialogList
            items={rows}
            index={index}
            height={rect.bodyRows - 2}
            theme={theme}
            section={(row) => row.mode}
            render={(row, i) => (
              <DialogRow
                selected={i === index}
                label={row.action.replace(/[.-]/gu, " ")}
                right={row.binding}
                width={rect.innerWidth}
                theme={theme}
              />
            )}
          />
          <text height={1} flexShrink={0} fg={theme.textMuted}>
            {fitText(
              "Ctrl+X is a silent leader. Space, g, and s show next-key menus.",
              rect.innerWidth,
            )}
          </text>
        </>
      )}
    </DialogPanel>
  );
}
