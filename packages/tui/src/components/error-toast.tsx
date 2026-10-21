import type { UiTheme } from "../theme.ts";
import {
  ERROR_TOAST_Z_INDEX,
  FOOTER_HEIGHT_ROWS,
  SHELL_OVERLAY_MARGIN,
} from "../app/shared/constants.ts";
import { SPLIT_BORDER } from "./shared.tsx";

const ERROR_TOAST_MAX_WIDTH = 72;
const ERROR_TOAST_MIN_WIDTH = 28;

export function ErrorToast({
  message,
  terminalWidth,
  theme,
  onDismiss,
}: {
  message: string;
  terminalWidth: number;
  theme: UiTheme;
  onDismiss: () => void;
}) {
  const width = Math.max(
    Math.min(terminalWidth - 6, ERROR_TOAST_MAX_WIDTH),
    Math.min(ERROR_TOAST_MIN_WIDTH, terminalWidth - 4),
  );

  return (
    <box
      position="absolute"
      right={SHELL_OVERLAY_MARGIN}
      bottom={FOOTER_HEIGHT_ROWS + 1}
      width={width}
      zIndex={ERROR_TOAST_Z_INDEX}
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={theme.danger}
      backgroundColor={theme.modalBg}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={0}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.danger} wrapMode="none">
          Error
        </text>
        <text
          id="error-toast-dismiss"
          fg={theme.textMuted}
          onMouseUp={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          {" X "}
        </text>
      </box>
      <text fg={theme.text} wrapMode="word">
        {message}
      </text>
    </box>
  );
}
