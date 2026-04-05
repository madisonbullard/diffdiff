import { Tag } from "../../components/shared.tsx";
import { PullRequestBanner } from "../../review/banner.tsx";
import type { PreparedReviewSession } from "../../types.ts";
import type { UiTheme } from "../../theme.ts";

export interface AppHeaderProps {
  currentBranchLabel: string;
  refreshIndicatorLabel: string | null;
  session: PreparedReviewSession;
  theme: UiTheme;
}

export function AppHeader({
  currentBranchLabel,
  refreshIndicatorLabel,
  session,
  theme,
}: AppHeaderProps) {
  return (
    <box
      flexShrink={0}
      width="100%"
      backgroundColor={theme.chromeBackground}
      paddingX={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={0}
    >
      <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
        <text fg={theme.text} wrapMode="none">
          <span fg={theme.accent}>diffdiff</span>
          <span fg={theme.border}>{" / "}</span>
          <span>{session.repository.name}</span>
          <span fg={theme.border}>{"  │  "}</span>
          <Tag
            label={`base ← ${session.comparison.base}`}
            fg={theme.inverseText}
            bg={theme.warning}
          />
          <span>{"  "}</span>
          <Tag
            label={`head → ${session.comparison.head}`}
            fg={theme.inverseText}
            bg={theme.accent}
          />
          {refreshIndicatorLabel != null ? (
            <>
              <span>{"  "}</span>
              <Tag label={refreshIndicatorLabel} fg={theme.inverseText} bg={theme.danger} />
            </>
          ) : null}
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <span>{session.repository.rootPath}</span>
          <span>{"  "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>{` ${currentBranchLabel} `}</span>
        </text>
      </box>
      {session.github != null ? (
        <PullRequestBanner pullRequest={session.github.pullRequest} theme={theme} />
      ) : null}
      {session.warnings[0] != null ? (
        <text fg={theme.warning} wrapMode="none">
          <span>{"warning "}</span>
          <span>{session.warnings[0].message}</span>
        </text>
      ) : null}
    </box>
  );
}
