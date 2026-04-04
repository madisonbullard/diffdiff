import type { UiTheme } from "../theme.ts";

interface DiffdiffAppKeyLegendProps {
  hasGitHubReview: boolean;
  theme: UiTheme;
}

export function DiffdiffAppKeyLegend({ hasGitHubReview, theme }: DiffdiffAppKeyLegendProps) {
  return (
    <box width="100%" flexShrink={0} paddingRight={1}>
      <box
        width="100%"
        border={["left"]}
        borderColor={theme.border}
        paddingLeft={2}
        paddingRight={1}
        flexDirection="column"
        gap={0}
      >
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" j/k "}
          </span>
          <span>{" move  "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" <-> "}
          </span>
          <span>{" tree"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {" tab "}
          </span>
          <span>{" pane  "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {"  c  "}
          </span>
          <span>{" fold"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {"  r  "}
          </span>
          <span>{" mark  "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {"  v  "}
          </span>
          <span>{" view"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {"  l  "}
          </span>
          <span>{" list  "}</span>
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {"  ?  "}
          </span>
          <span>{" help"}</span>
        </text>
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent} bg={theme.surfaceMuted}>
            {"  q  "}
          </span>
          <span>{" quit"}</span>
        </text>
        {hasGitHubReview ? (
          <>
            <text fg={theme.textMuted} wrapMode="none">
              <span fg={theme.accent} bg={theme.surfaceMuted}>
                {" i/o "}
              </span>
              <span>{" thread  "}</span>
              <span fg={theme.accent} bg={theme.surfaceMuted}>
                {" [/] "}
              </span>
              <span>{" cmt"}</span>
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <span fg={theme.accent} bg={theme.surfaceMuted}>
                {"  a  "}
              </span>
              <span>{" note  "}</span>
              <span fg={theme.accent} bg={theme.surfaceMuted}>
                {"  r  "}
              </span>
              <span>{" reply"}</span>
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <span fg={theme.accent} bg={theme.surfaceMuted}>
                {"  c  "}
              </span>
              <span>{" fold  "}</span>
              <span fg={theme.accent} bg={theme.surfaceMuted}>
                {"  y  "}
              </span>
              <span>{" link"}</span>
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <span fg={theme.accent} bg={theme.surfaceMuted}>
                {"  m  "}
              </span>
              <span>{" merge"}</span>
            </text>
          </>
        ) : null}
      </box>
    </box>
  );
}
