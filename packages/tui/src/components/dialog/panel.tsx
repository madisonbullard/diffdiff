import { useRef, type ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import type { UiTheme } from "../../theme.ts";
import { resolveDialogRect, type DialogFamily, type DialogRect } from "./geometry.ts";
import { dialogTokens } from "./tokens.ts";
import { cellWidth, fitText } from "./text.ts";
import { primaryBinding, useDialogUi } from "./context.tsx";
import * as A from "../../app/keymap/actions.ts";

export interface DialogAction {
  action: string;
  label: string;
  primary?: boolean;
  disabled?: boolean;
  warning?: boolean;
}
export function DialogPanel({
  title,
  context,
  position,
  family = "picker",
  contentRows,
  status,
  tone,
  theme,
  actions = [],
  tabs,
  children,
}: {
  title: string;
  context?: string;
  position?: string;
  family?: DialogFamily;
  contentRows?: number;
  status?: string;
  tone?: "warning" | "danger";
  theme: UiTheme;
  actions?: readonly DialogAction[];
  tabs?: readonly { label: string; active: boolean; action: string }[];
  children: ReactNode | ((rect: DialogRect) => ReactNode);
}) {
  const { width, height } = useTerminalDimensions();
  const ui = useDialogUi();
  const initialRows = useRef(contentRows);
  const error = ui.error;
  const message = error ?? status;
  const baseRect = resolveDialogRect(family, width, height, initialRows.current, Boolean(message));
  const statusRows =
    message && (family === "confirm" || tone != null)
      ? Math.min(3, Math.ceil((cellWidth(message) + 2) / baseRect.innerWidth))
      : 1;
  const rect = { ...baseRect, bodyRows: Math.max(1, baseRect.bodyRows - statusRows + 1) };
  const colors = dialogTokens(theme);
  const cancelAction = ui.mode === "help" ? A.HELP_DISMISS : A.MODAL_DISMISS;
  const cancel = primaryBinding(ui, cancelAction) ?? primaryBinding(ui, A.MODAL_DISMISS) ?? "";
  const right = [position, cancel].filter(Boolean).join("  ");
  const leadWidth =
    tabs?.reduce((n, tab) => n + cellWidth(tab.label) + 2, 0) ?? cellWidth(title) + (tone ? 2 : 0);
  const contextText = fitText(context ?? "", rect.innerWidth - leadWidth - cellWidth(right) - 4);
  const bandTone = error != null ? "danger" : tone;
  return (
    <box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={50}
      backgroundColor={colors.scrim}
    >
      <box
        id="dialog-panel"
        position="absolute"
        left={rect.left}
        top={rect.top}
        width={rect.width}
        height={rect.height}
        backgroundColor={colors.panel}
        flexDirection="column"
        paddingLeft={rect.padX}
        paddingRight={rect.padX}
        paddingTop={rect.padY}
        paddingBottom={rect.padY}
        overflow="hidden"
      >
        <box height={1} flexShrink={0} flexDirection="row">
          <box flexGrow={1} flexDirection="row">
            {tone ? <text fg={theme.warning}>{"▲ "}</text> : null}
            {tabs ? (
              tabs.map((tab) => (
                <text
                  key={tab.label}
                  fg={tab.active ? colors.panel : theme.textMuted}
                  bg={tab.active ? theme.accent : colors.panel}
                  attributes={tab.active ? 1 : 0}
                  onMouseUp={() => {
                    if (!tab.active) ui.run(tab.action);
                  }}
                >{` ${tab.label} `}</text>
              ))
            ) : (
              <text fg={theme.text} attributes={1}>
                {title}
              </text>
            )}
            {contextText ? <text fg={theme.textMuted}>{`  ${contextText}`}</text> : null}
          </box>
          <text
            flexShrink={0}
            wrapMode="none"
            fg={theme.textMuted}
            onMouseUp={() => ui.run(cancelAction)}
          >
            {right}
          </text>
        </box>
        <box flexDirection="column" flexGrow={1} overflow="hidden">
          {rect.tooSmall ? (
            <text
              fg={theme.text}
              wrapMode="word"
            >{`${title} needs more space. Enlarge this ${width}×${height} terminal or close the dialog.`}</text>
          ) : typeof children === "function" ? (
            children(rect)
          ) : (
            children
          )}
        </box>
        {message ? (
          <box
            height={statusRows}
            flexShrink={0}
            backgroundColor={bandTone ? colors[bandTone] : colors.panel}
            marginLeft={-rect.padX}
            marginRight={-rect.padX}
            paddingLeft={rect.padX}
            paddingRight={rect.padX}
          >
            <text fg={theme.text} wrapMode={statusRows > 1 ? "word" : "none"}>
              <span
                fg={
                  bandTone === "danger"
                    ? theme.danger
                    : bandTone === "warning"
                      ? theme.warning
                      : theme.accent
                }
              >
                {error ? "✗ " : bandTone ? "▲ " : "◐ "}
              </span>
              {fitText(message, rect.innerWidth * statusRows - 2)}
            </text>
          </box>
        ) : null}
        <DialogActionBar
          actions={rect.tooSmall ? [] : actions}
          theme={theme}
          width={rect.innerWidth}
        />
      </box>
    </box>
  );
}

export function DialogActionBar({
  actions,
  theme,
  width,
}: {
  actions: readonly DialogAction[];
  theme: UiTheme;
  width: number;
}) {
  const ui = useDialogUi();
  let remaining = width;
  return (
    <box height={1} flexShrink={0} flexDirection="row">
      {[...actions]
        .sort((left, right) => Number(Boolean(right.primary)) - Number(Boolean(left.primary)))
        .map((hint) => {
          const binding = primaryBinding(ui, hint.action);
          if (binding == null) return null;
          const cost = cellWidth(`${binding} ${hint.label}  `);
          if (cost > remaining && !hint.primary) return null;
          remaining -= cost;
          return (
            <text
              key={`${hint.action}:${hint.label}`}
              wrapMode="none"
              flexShrink={0}
              onMouseUp={() => {
                if (!hint.disabled) ui.run(hint.action);
              }}
            >
              <span
                fg={hint.disabled ? theme.textMuted : theme.accent}
                attributes={hint.primary ? 1 : 0}
              >
                {binding}
              </span>
              <span
                fg={
                  hint.disabled
                    ? theme.textMuted
                    : hint.warning
                      ? theme.warning
                      : hint.primary
                        ? theme.text
                        : theme.textMuted
                }
              >{` ${hint.label}  `}</span>
            </text>
          );
        })}
    </box>
  );
}

export function DialogRule({ theme }: { theme: UiTheme }) {
  return <box height={1} flexShrink={0} border={["top"]} borderColor={dialogTokens(theme).rule} />;
}
