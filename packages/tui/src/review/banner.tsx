import type { GitHubPullRequestDetail } from "@diffdiff/core";
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
  theme,
}: {
  pullRequest: GitHubPullRequestDetail;
  theme: UiTheme;
}) {
  const pullRequestTag = getPullRequestTag(pullRequest, theme);
  const mergeStatus = getMergeStatusLabel(pullRequest);

  return (
    <box width="100%">
      <text fg={theme.textMuted} wrapMode="none">
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
        <span fg={getChecksColor(pullRequest, theme)}>{formatChecksSummary(pullRequest)}</span>
        <span fg={theme.border}>{"  │  "}</span>
        <span fg={getMergeStatusColor(pullRequest, theme)}>{mergeStatus}</span>
      </text>
    </box>
  );
}
