import type { PrefixMenuCommand, PrefixMenuConfig } from "../app/commands/prefix-menus.ts";
import type { UiTheme } from "../theme.ts";
import { CommandBindingLabel, CommandListItem, CommandListRow } from "./command-list.tsx";

export function PrefixPickerOverlay({
  commands,
  prefixMenu,
  theme,
}: {
  commands: readonly PrefixMenuCommand[];
  prefixMenu: PrefixMenuConfig;
  theme: UiTheme;
}) {
  if (prefixMenu.picker == null) {
    return null;
  }

  return (
    <box
      position="absolute"
      right={2}
      bottom={1}
      width={52}
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
        {prefixMenu.picker.title}
      </text>
      <text fg={theme.textMuted} wrapMode="none">
        {prefixMenu.picker.description}
      </text>
      {commands.map(({ actionId, enabled, label, title }, index) => {
        const textColor = enabled ? theme.text : theme.textMuted;
        return (
          <CommandListItem key={actionId} accentColor={theme.accent} index={index} theme={theme}>
            <CommandListRow
              left={
                <text fg={textColor} wrapMode="word">
                  {title}
                </text>
              }
              right={<CommandBindingLabel label={label} dimmed={!enabled} theme={theme} />}
            />
          </CommandListItem>
        );
      })}
    </box>
  );
}
