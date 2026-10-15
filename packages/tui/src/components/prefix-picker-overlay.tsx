import { useTerminalDimensions } from "@opentui/react";
import type { PrefixMenuCommand, PrefixMenuConfig } from "../app/commands/prefix-menus.ts";
import type { UiTheme } from "../theme.ts";
import { dialogTokens } from "./dialog/tokens.ts";
import { fitText } from "./dialog/text.ts";
import { useDialogUi } from "./dialog/context.tsx";
export function PrefixPickerOverlay({
  commands,
  prefixMenu,
  theme,
}: {
  commands: readonly PrefixMenuCommand[];
  prefixMenu: PrefixMenuConfig;
  theme: UiTheme;
}) {
  const { width, height } = useTerminalDimensions();
  const ui = useDialogUi();
  if (!prefixMenu.picker || prefixMenu.prefix === "leader") return null;
  if (width < 30 || height < 8)
    return (
      <box
        position="absolute"
        left={0}
        bottom={1}
        width={Math.max(1, width)}
        height={1}
        zIndex={55}
        backgroundColor={dialogTokens(theme).popover}
      >
        <text wrapMode="none" fg={theme.text}>
          {fitText("Menu needs 30×8 · Escape closes", width)}
        </text>
      </box>
    );
  const columns = commands.length + 3 > height - 2 && width >= 70 ? 2 : 1;
  const panelWidth = Math.min(width - 2, columns === 2 ? 76 : 42);
  const count = Math.max(1, Math.min(Math.ceil(commands.length / columns), height - 5));
  return (
    <box
      position="absolute"
      right={1}
      bottom={1}
      width={panelWidth}
      height={count + 3}
      zIndex={55}
      backgroundColor={dialogTokens(theme).popover}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      <text
        height={1}
        fg={theme.text}
        attributes={1}
      >{`${prefixMenu.picker.title}  ·  esc cancel`}</text>
      {Array.from({ length: count }, (_, row) => (
        <box key={row} height={1} flexShrink={0} flexDirection="row">
          {Array.from({ length: columns }, (_, col) => {
            const command = commands[row + col * count];
            return (
              <text
                key={col}
                width={Math.floor((panelWidth - 2) / columns)}
                wrapMode="none"
                fg={command?.enabled ? theme.text : theme.textMuted}
                onMouseUp={() => {
                  if (command?.enabled) ui.run(command.actionId);
                }}
              >
                <span fg={theme.accent}>{command ? `${command.label}  ` : ""}</span>
                {command
                  ? fitText(
                      command.title,
                      Math.floor((panelWidth - 2) / columns) - command.label.length - 2,
                    )
                  : ""}
              </text>
            );
          })}
        </box>
      ))}
      <text height={1} fg={theme.textMuted}>
        {fitText(
          commands.length > count * columns
            ? `${commands.length - count * columns} more in Keys · next keys still work`
            : prefixMenu.picker.description,
          panelWidth - 2,
        )}
      </text>
    </box>
  );
}
