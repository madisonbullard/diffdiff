import { AsciiLoadingPane } from "../../components/ascii-loading-pane.tsx";
import { Tag } from "../../components/shared.tsx";
import type { UiTheme } from "../../theme.ts";
import * as A from "../keymap/actions.ts";
import { getActionBindingLabels } from "../keymap/display.ts";
import type { ReverseKeymaps } from "../keymap/types.ts";
import type { KeymapMode } from "./keymap-mode.ts";

export interface FooterHint {
  key: string;
  label: string;
}

const FOOTER_HINT_ACTIONS: Partial<Record<KeymapMode, readonly [string, string][]>> = {
  commands: [[A.COMMANDS_SWITCH_TAB, "keys"]],
  help: [[A.COMMANDS_SWITCH_TAB, "commands"]],
};
const DEFAULT_FOOTER_HINT_ACTIONS: readonly [string, string][] = [
  [A.SYSTEM_HELP, "keys"],
  [A.SYSTEM_COMMAND_PALETTE, "commands"],
];

/** Each hint shows the action's shortest binding, or nothing when the mode lacks one. */
export function getFooterHints(reverseKeymaps: ReverseKeymaps, mode: KeymapMode): FooterHint[] {
  return (FOOTER_HINT_ACTIONS[mode] ?? DEFAULT_FOOTER_HINT_ACTIONS).flatMap(([action, label]) => {
    const key = getActionBindingLabels(reverseKeymaps, action, [mode])[0];
    return key == null ? [] : [{ key, label }];
  });
}

/** Columns the footer's left side uses beyond the mode badge label. */
export function getFooterHintsWidth(hints: readonly FooterHint[]): number {
  // Row padding, badge padding, the gap before the event message, and slack.
  return hints.reduce((width, hint) => width + hint.key.length + hint.label.length + 5, 11);
}

interface AppFooterProps {
  footerEvent: { color: string; message: string };
  footerEventMessage: string;
  footerModeBadge: { bg: string; fg: string; label: string };
  hints: readonly FooterHint[];
  showLoadingIndicator: boolean;
  theme: UiTheme;
}

export function AppFooter({
  footerEvent,
  footerEventMessage,
  footerModeBadge,
  hints,
  showLoadingIndicator,
  theme,
}: AppFooterProps) {
  return (
    <box
      flexShrink={0}
      width="100%"
      backgroundColor={theme.chromeBackground}
      paddingX={2}
      paddingTop={0}
      paddingBottom={0}
      flexDirection="row"
      alignItems="center"
      gap={2}
    >
      <box flexShrink={0} flexDirection="row" alignItems="center" gap={2}>
        <text wrapMode="none">
          <Tag label={footerModeBadge.label} fg={footerModeBadge.fg} bg={footerModeBadge.bg} />
        </text>
        {hints.map((hint) => (
          <text key={hint.label} fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>{` ${hint.key} `}</span>
            <span>{` ${hint.label}`}</span>
          </text>
        ))}
      </box>
      <box flexGrow={1} flexDirection="row" justifyContent="flex-end" alignItems="center" gap={1}>
        {showLoadingIndicator ? <AsciiLoadingPane theme={theme} /> : null}
        <text fg={footerEvent.color} wrapMode="none">
          <span>{footerEventMessage}</span>
        </text>
      </box>
    </box>
  );
}
