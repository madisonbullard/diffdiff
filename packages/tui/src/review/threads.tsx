import type {
  GitHubPullRequestComment,
  GitHubPullRequestReviewGroup,
  GitHubPullRequestReviewThread,
} from "@diffdiff/core";
import type { SideBySideDiffRow, UnifiedDiffLine } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import { formatTimestamp, getReviewStateColor } from "./formatting.ts";
import {
  getReviewGroupCollapseKey,
  getReviewGroupDefaultCollapsed,
  getReviewThreadCollapseKey,
  getReviewThreadDefaultCollapsed,
} from "./collapse-state.ts";
import { REVIEW_BORDER } from "./shared.tsx";

export function ReviewThreadList({
  collapsedCommentStates,
  onToggleCollapsed,
  threads,
  theme,
}: {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  onToggleCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  threads: readonly GitHubPullRequestReviewThread[];
  theme: UiTheme;
}) {
  if (threads.length === 0) {
    return null;
  }

  return (
    <box width="100%" flexDirection="column" gap={1} paddingTop={1}>
      {threads.map((thread) => (
        <ReviewThreadCard
          key={thread.id}
          collapsedCommentStates={collapsedCommentStates}
          onToggleCollapsed={onToggleCollapsed}
          thread={thread}
          theme={theme}
        />
      ))}
    </box>
  );
}

export function ReviewGroupCard({
  collapsedCommentStates,
  group,
  onToggleCollapsed,
  theme,
}: {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  group: GitHubPullRequestReviewGroup;
  onToggleCollapsed?: (group: GitHubPullRequestReviewGroup) => void;
  theme: UiTheme;
}) {
  const collapseKey = getReviewGroupCollapseKey(group);
  const isCollapsed = collapsedCommentStates?.[collapseKey] ?? getReviewGroupDefaultCollapsed();

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
      gap={isCollapsed ? 0 : 1}
    >
      <box
        width="100%"
        flexDirection="row"
        justifyContent="space-between"
        gap={1}
        onMouseUp={() => {
          onToggleCollapsed?.(group);
        }}
      >
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent}>{isCollapsed ? ">" : "v"}</span>
          <span> </span>
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
        <text fg={theme.textMuted} wrapMode="none">
          <span>{formatCommentCount(group.comments.length)}</span>
        </text>
      </box>
      {!isCollapsed && group.body != null && group.body.trim() !== "" ? (
        <text fg={theme.text} wrapMode="word">
          {group.body}
        </text>
      ) : null}
      {!isCollapsed && group.comments.length > 0 ? (
        <ReviewCommentList
          comments={group.comments}
          suppressFirstAuthorLogin={group.author.login}
          theme={theme}
        />
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
  collapsedCommentStates,
  onToggleCollapsed,
  thread,
  theme,
}: {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  onToggleCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  thread: GitHubPullRequestReviewThread;
  theme: UiTheme;
}) {
  const collapseKey = getReviewThreadCollapseKey(thread);
  const isCollapsed =
    collapsedCommentStates?.[collapseKey] ?? getReviewThreadDefaultCollapsed(thread);

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
      gap={isCollapsed ? 0 : 1}
    >
      <box
        width="100%"
        flexDirection="row"
        justifyContent="space-between"
        gap={1}
        onMouseUp={() => {
          onToggleCollapsed?.(thread);
        }}
      >
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.accent}>{isCollapsed ? ">" : "v"}</span>
          <span> </span>
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
        <text fg={theme.textMuted} wrapMode="none">
          <span>{formatCommentCount(thread.comments.length)}</span>
        </text>
      </box>
      {!isCollapsed ? (
        <ReviewCommentList
          comments={thread.comments}
          suppressFirstAuthorLogin={thread.comments[0]?.author.login}
          theme={theme}
        />
      ) : null}
    </box>
  );
}

function ReviewCommentList({
  comments,
  suppressFirstAuthorLogin,
  theme,
}: {
  comments: readonly GitHubPullRequestComment[];
  suppressFirstAuthorLogin?: string;
  theme: UiTheme;
}) {
  return (
    <box width="100%" flexDirection="column" gap={1}>
      {comments.map((comment, index) => {
        const hideAuthor =
          index === 0 &&
          suppressFirstAuthorLogin != null &&
          comment.author.login === suppressFirstAuthorLogin;

        return (
          <text key={comment.id} fg={theme.text} wrapMode="word">
            {hideAuthor ? null : <span fg={theme.accent}>{comment.author.login}</span>}
            {hideAuthor ? null : <span fg={theme.border}>{": "}</span>}
            <span>{comment.body}</span>
            {comment.isOutdated ? <span fg={theme.warning}>{"  [outdated]"}</span> : null}
          </text>
        );
      })}
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

export function formatThreadAnchor(thread: GitHubPullRequestReviewThread): string {
  const anchorLine = thread.line ?? thread.originalLine;
  if (anchorLine == null) {
    return thread.path;
  }

  if (thread.startLine != null && thread.startLine !== anchorLine) {
    return `${thread.path}:${thread.startLine}-${anchorLine}`;
  }

  return `${thread.path}:${anchorLine}`;
}

function formatCommentCount(commentCount: number): string {
  return `${commentCount} comment${commentCount === 1 ? "" : "s"}`;
}
