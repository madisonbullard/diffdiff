import type { GitHubPullRequestDetail } from "@madisonbullard/diffdiff-core";
import type { UiTheme } from "../theme.ts";
import {
  formatChecksSummary,
  getChecksColor,
  getMergeStatusColor,
  getMergeStatusLabel,
  getPullRequestTag,
} from "./formatting.ts";

export function PullRequestBanner({
  pullRequest,
  onOpenChecks,
  theme,
}: {
  pullRequest: GitHubPullRequestDetail;
  onOpenChecks?: () => void;
  theme: UiTheme;
}) {
  const pullRequestTag = getPullRequestTag(pullRequest, theme);
  const mergeStatus = getMergeStatusLabel(pullRequest);

  return (
    <box width="100%" flexDirection="row">
      <text fg={theme.textMuted} wrapMode="none" flexShrink={1} minWidth={0}>
        <span
          fg={theme.inverseText}
          bg={pullRequestTag.background}
        >{` ${pullRequestTag.label} `}</span>
        <span> </span>
        <span fg={theme.text}>{`#${pullRequest.number}`}</span>
        <span> </span>
        <span fg={theme.text}>{pullRequest.title}</span>
        <span fg={theme.border}>{"  │  "}</span>
        <span fg={theme.textMuted}>{pullRequest.author.login}</span>
        <span fg={theme.border}>{"  │  "}</span>
      </text>
      <text
        id="pr-checks-badge"
        fg={getChecksColor(pullRequest, theme)}
        wrapMode="none"
        flexShrink={0}
        onMouseUp={(event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          onOpenChecks?.();
        }}
      >
        {formatChecksSummary(pullRequest)}
      </text>
      <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
        <span fg={theme.border}>{"  │  "}</span>
        <span fg={getMergeStatusColor(pullRequest, theme)}>{mergeStatus}</span>
      </text>
    </box>
  );
}
