import type {
  GitHubPullRequestComment,
  GitHubPullRequestReviewGroup,
  GitHubPullRequestReviewThread,
} from "@diffdiff/core";
import type { SideBySideDiffRow, UnifiedDiffLine } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import { formatTimestamp, getReviewStateColor } from "./formatting.ts";
import { REVIEW_BORDER } from "./shared.tsx";

export function ReviewThreadList({
  threads,
  theme,
}: {
  threads: readonly GitHubPullRequestReviewThread[];
  theme: UiTheme;
}) {
  if (threads.length === 0) {
    return null;
  }

  return (
    <box width="100%" flexDirection="column" gap={1} paddingTop={1}>
      {threads.map((thread) => (
        <ReviewThreadCard key={thread.id} thread={thread} theme={theme} />
      ))}
    </box>
  );
}

export function ReviewGroupCard({
  group,
  theme,
}: {
  group: GitHubPullRequestReviewGroup;
  theme: UiTheme;
}) {
  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={REVIEW_BORDER}
      borderColor={getReviewStateColor(group.state, theme)}
      backgroundColor={theme.surface}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={1}
    >
      <text fg={theme.textMuted} wrapMode="none">
        <span fg={theme.text}>{group.author.login}</span>
        <span fg={theme.border}>{"  │  "}</span>
        <span fg={getReviewStateColor(group.state, theme)}>{group.state.toLowerCase()}</span>
        {group.submittedAt != null ? (
          <>
            <span fg={theme.border}>{"  │  "}</span>
            <span>{formatTimestamp(group.submittedAt)}</span>
          </>
        ) : null}
      </text>
      {group.body != null && group.body.trim() !== "" ? (
        <text fg={theme.text} wrapMode="word">
          {group.body}
        </text>
      ) : null}
      {group.comments.length > 0 ? (
        <ReviewCommentList comments={group.comments} theme={theme} />
      ) : null}
    </box>
  );
}

export function getThreadsForUnifiedLine(
  threads: readonly GitHubPullRequestReviewThread[],
  line: UnifiedDiffLine,
): GitHubPullRequestReviewThread[] {
  return threads.filter((thread) => matchesUnifiedLine(thread, line));
}

export function getThreadsForSideBySideRow(
  threads: readonly GitHubPullRequestReviewThread[],
  row: SideBySideDiffRow,
): GitHubPullRequestReviewThread[] {
  if (row.kind !== "line") {
    return [];
  }

  return threads.filter((thread) => {
    const anchorLine = thread.line ?? thread.originalLine;
    if (anchorLine == null) {
      return false;
    }

    return thread.side === "LEFT"
      ? row.left?.lineNumber === anchorLine
      : row.right?.lineNumber === anchorLine;
  });
}

export function getUnanchoredUnifiedThreads(
  threads: readonly GitHubPullRequestReviewThread[],
  lines: readonly UnifiedDiffLine[],
): GitHubPullRequestReviewThread[] {
  return threads.filter((thread) => !lines.some((line) => matchesUnifiedLine(thread, line)));
}

export function getUnanchoredSideBySideThreads(
  threads: readonly GitHubPullRequestReviewThread[],
  rows: readonly SideBySideDiffRow[],
): GitHubPullRequestReviewThread[] {
  return threads.filter(
    (thread) => !rows.some((row) => getThreadsForSideBySideRow([thread], row)[0] != null),
  );
}

function ReviewThreadCard({
  thread,
  theme,
}: {
  thread: GitHubPullRequestReviewThread;
  theme: UiTheme;
}) {
  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={REVIEW_BORDER}
      borderColor={thread.isOutdated ? theme.warning : theme.success}
      backgroundColor={theme.surfaceMuted}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={1}
    >
      <text fg={theme.textMuted} wrapMode="none">
        <span fg={theme.text}>{thread.comments[0]?.author.login ?? "unknown"}</span>
        <span fg={theme.border}>{"  │  "}</span>
        <span>{formatThreadAnchor(thread)}</span>
        {thread.isOutdated ? (
          <>
            <span fg={theme.border}>{"  │  "}</span>
            <span fg={theme.warning}>outdated</span>
          </>
        ) : null}
      </text>
      <ReviewCommentList comments={thread.comments} theme={theme} />
    </box>
  );
}

function ReviewCommentList({
  comments,
  theme,
}: {
  comments: readonly GitHubPullRequestComment[];
  theme: UiTheme;
}) {
  return (
    <box width="100%" flexDirection="column" gap={1}>
      {comments.map((comment) => (
        <text key={comment.id} fg={theme.text} wrapMode="word">
          <span fg={theme.accent}>{comment.author.login}</span>
          <span fg={theme.border}>{": "}</span>
          <span>{comment.body}</span>
        </text>
      ))}
    </box>
  );
}

function matchesUnifiedLine(thread: GitHubPullRequestReviewThread, line: UnifiedDiffLine): boolean {
  if (line.kind === "hunk" || line.kind === "gap") {
    return false;
  }

  const anchorLine = thread.line ?? thread.originalLine;
  if (anchorLine == null) {
    return false;
  }

  return thread.side === "LEFT"
    ? line.oldLineNumber === anchorLine
    : line.newLineNumber === anchorLine;
}

function formatThreadAnchor(thread: GitHubPullRequestReviewThread): string {
  const anchorLine = thread.line ?? thread.originalLine;
  if (anchorLine == null) {
    return thread.path;
  }

  if (thread.startLine != null && thread.startLine !== anchorLine) {
    return `${thread.path}:${thread.startLine}-${anchorLine}`;
  }

  return `${thread.path}:${anchorLine}`;
}
