import { Tag } from "../../components/shared.tsx";
import type { UiTheme } from "../../theme.ts";

export interface AppFooterProps {
  footerEvent: { color: string; message: string };
  footerEventMessage: string;
  footerModeBadge: { bg: string; fg: string; label: string };
  helpLabel: string;
  theme: UiTheme;
}

export function AppFooter({
  footerEvent,
  footerEventMessage,
  footerModeBadge,
  helpLabel,
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
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent} bg={theme.surfaceMuted}>{` ${helpLabel} `}</span>
          <span>{" help"}</span>
        </text>
      </box>
      <box flexGrow={1} flexDirection="row" justifyContent="flex-end">
        <text fg={footerEvent.color} wrapMode="none">
          <span>{footerEventMessage}</span>
        </text>
      </box>
    </box>
  );
}
