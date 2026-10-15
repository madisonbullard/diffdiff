import type { CommandDefinition } from "../commands.ts";
import type { UiTheme } from "../theme.ts";
import type { TextInputSurface } from "../text-input-surface.ts";
import { TextInputContent } from "./text-input-content.tsx";
import { DialogPanel } from "./dialog/panel.tsx";
import { DialogList, DialogRow } from "./dialog/list-view.tsx";
import { useDialogUi } from "./dialog/context.tsx";
import { fitText } from "./dialog/text.ts";
import * as A from "../app/keymap/actions.ts";

export function CommandPaletteModal({
  commands,
  commandBindingLabels,
  querySurface,
  selectedIndex,
  theme,
}: {
  commands: readonly CommandDefinition[];
  commandBindingLabels: ReadonlyMap<string, string | undefined>;
  querySurface: TextInputSurface;
  selectedIndex: number;
  theme: UiTheme;
}) {
  const ui = useDialogUi();
  const selected = commands[selectedIndex];
  return (
    <DialogPanel
      title="Commands"
      tabs={[
        { label: "Commands", active: true, action: A.COMMANDS_SWITCH_TAB },
        { label: "Keys", active: false, action: A.COMMANDS_SWITCH_TAB },
      ]}
      theme={theme}
      family="picker"
      position={`${commands.length === 0 ? 0 : selectedIndex + 1}/${commands.length}`}
      context={
        querySurface.value.trim()
          ? `Filtering commands for "${querySurface.value.trim()}".`
          : "Run an action"
      }
      actions={[
        { action: A.COMMAND_PALETTE_RUN, label: "run", primary: true },
        { action: A.LIST_MOVE_DOWN, label: "move" },
        { action: A.COMMANDS_SWITCH_TAB, label: "keys" },
        { action: A.SYSTEM_HELP, label: "keys" },
      ]}
    >
      {(rect) => (
        <>
          <text height={1} flexShrink={0} fg={theme.accent} wrapMode="none">
            {"› "}
            <TextInputContent
              cursorColor={theme.accent}
              cursorTextColor={theme.inverseText}
              placeholder="Search commands…"
              placeholderColor={theme.textMuted}
              surface={querySurface}
            />
          </text>
          <DialogList
            items={commands}
            index={selectedIndex}
            height={rect.bodyRows - 3}
            theme={theme}
            empty="No matching commands."
            section={(command) =>
              querySurface.value === "" && command.suggested
                ? "Suggested"
                : command.enabled === false
                  ? `Unavailable · ${command.category}`
                  : command.category
            }
            onMove={(delta) =>
              ui.run(delta > 0 ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(delta))
            }
            render={(command, index) => (
              <DialogRow
                selected={index === selectedIndex}
                label={command.title}
                disabled={command.enabled === false}
                right={commandBindingLabels.get(command.value)}
                width={rect.innerWidth}
                theme={theme}
                onSelect={() =>
                  ui.run(
                    index > selectedIndex ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP,
                    Math.abs(index - selectedIndex),
                  )
                }
                onActivate={() => ui.run(A.COMMAND_PALETTE_RUN)}
              />
            )}
          />
          <text
            height={2}
            flexShrink={0}
            fg={selected?.enabled === false ? theme.warning : theme.textMuted}
            wrapMode="word"
          >
            {fitText(selected?.disabledReason ?? selected?.description ?? "", rect.innerWidth * 2)}
          </text>
        </>
      )}
    </DialogPanel>
  );
}
