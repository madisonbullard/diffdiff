import type { UiTheme } from "../theme.ts";
import type { ModalPickerCommand } from "../app/commands/modal-picker.ts";
import { KeyCap } from "./shared.tsx";

export function ModalPickerOverlay({
  commands,
  theme,
}: {
  commands: readonly ModalPickerCommand[];
  theme: UiTheme;
}) {
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
        Modal Picker
      </text>
      <text fg={theme.textMuted} wrapMode="none">
        Press a key to open a modal.
      </text>
      {commands.map(({ command, label }) => {
        const enabled = command.enabled !== false;
        const textColor = enabled ? theme.text : theme.textMuted;
        return (
          <text key={command.value} fg={textColor} wrapMode="none">
            <KeyCap label={label} theme={theme} />
            <span>{` ${command.title}`}</span>
          </text>
        );
      })}
    </box>
  );
}
