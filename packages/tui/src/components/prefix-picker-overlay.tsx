import type { PrefixMenuCommand, PrefixMenuConfig } from "../app/commands/prefix-menus.ts";
import type { UiTheme } from "../theme.ts";
import { KeyCap } from "./shared.tsx";

export function PrefixPickerOverlay({
  commands,
  prefixMenu,
  theme,
}: {
  commands: readonly PrefixMenuCommand[];
  prefixMenu: PrefixMenuConfig;
  theme: UiTheme;
}) {
  if (prefixMenu.pickerTitle == null || prefixMenu.pickerDescription == null) {
    return null;
  }

  return (
    <box
      position="absolute"
      right={2}
      bottom={1}
      width={40}
      zIndex={15}
      backgroundColor={theme.modalBg}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={0}
    >
      <text fg={theme.accent} wrapMode="none">
        {prefixMenu.pickerTitle}
      </text>
      <text fg={theme.textMuted} wrapMode="none">
        {prefixMenu.pickerDescription}
      </text>
      {commands.map(({ command, label }) => {
        const enabled = command.enabled !== false;
        const textColor = enabled ? theme.text : theme.textMuted;
        return (
          <text key={command.value} fg={textColor} wrapMode="none">
            <KeyCap label={label.replace(/^[^ ]+ /u, "") || label} theme={theme} />
            <span>{` ${command.title}`}</span>
          </text>
        );
      })}
    </box>
  );
}
