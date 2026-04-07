import type { GitHubPullRequestComment, GitHubPullRequestReviewThread } from "@diffdiff/core";
import { getCollapseToggleGlyph } from "../components/shared.tsx";
import type { UiTheme } from "../theme.ts";
import { CommentTimestamp, ReviewMetaSeparator } from "./comment-metadata.tsx";
import { getReviewThreadCollapseKey, getReviewThreadDefaultCollapsed } from "./collapse-state.ts";

export function ReviewThreadList({
  collapsedCommentStates,
  onToggleCollapsed,
  selectedCommentId,
  selectedThreadId,
  threads,
  theme,
}: {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  onToggleCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  selectedCommentId?: number;
  selectedThreadId?: string;
  threads: readonly GitHubPullRequestReviewThread[];
  theme: UiTheme;
}) {
  if (threads.length === 0) {
    return null;
  }

  return (
    <box width="100%" flexDirection="column" gap={0}>
      {threads.map((thread) => (
        <ReviewThreadCard
          key={thread.id}
          collapsedCommentStates={collapsedCommentStates}
          onToggleCollapsed={onToggleCollapsed}
          selectedCommentId={selectedCommentId}
          selectedThreadId={selectedThreadId}
          thread={thread}
          theme={theme}
        />
      ))}
    </box>
  );
}

function ReviewThreadCard({
  collapsedCommentStates,
  onToggleCollapsed,
  selectedCommentId,
  selectedThreadId,
  thread,
  theme,
}: {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  onToggleCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  selectedCommentId?: number;
  selectedThreadId?: string;
  thread: GitHubPullRequestReviewThread;
  theme: UiTheme;
}) {
  const collapseKey = getReviewThreadCollapseKey(thread);
  const isCollapsed =
    collapsedCommentStates?.[collapseKey] ?? getReviewThreadDefaultCollapsed(thread);
  const isSelected = selectedThreadId === thread.id;

  const borderColor = isSelected ? theme.accent : thread.isOutdated ? theme.warning : theme.success;
  const cardBg = isSelected ? theme.surface : theme.commentBg;

  return (
    <box width="100%" flexDirection="row">
      <box width={1} backgroundColor={cardBg}>
        <text fg={borderColor} wrapMode="none">
          {"\u2503"}
        </text>
      </box>
      <box
        flexGrow={1}
        backgroundColor={cardBg}
        paddingLeft={1}
        paddingRight={1}
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
            <span fg={theme.accent}>{getCollapseToggleGlyph(isCollapsed)}</span>
            <span> </span>
            <span fg={theme.text}>{thread.comments[0]?.author.login ?? "unknown"}</span>
            <ReviewMetaSeparator theme={theme} />
            <span>{formatThreadAnchor(thread)}</span>
            {thread.isOutdated ? (
              <>
                <ReviewMetaSeparator theme={theme} />
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
            selectedCommentId={isSelected ? selectedCommentId : undefined}
            suppressFirstAuthorLogin={thread.comments[0]?.author.login}
            theme={theme}
          />
        ) : null}
      </box>
    </box>
  );
}

function ReviewCommentList({
  comments,
  selectedCommentId,
  suppressFirstAuthorLogin,
  theme,
}: {
  comments: readonly GitHubPullRequestComment[];
  selectedCommentId?: number;
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
          <text
            key={comment.id}
            fg={selectedCommentId === comment.id ? theme.accent : theme.text}
            wrapMode="word"
          >
            {selectedCommentId === comment.id ? <span fg={theme.accent}>{"> "}</span> : null}
            {hideAuthor ? null : <span fg={theme.accent}>{comment.author.login}</span>}
            {hideAuthor ? null : <ReviewMetaSeparator theme={theme} />}
            <CommentTimestamp theme={theme} value={comment.createdAt} />
            <span fg={theme.border}>{": "}</span>
            <span>{comment.body}</span>
            {comment.isOutdated ? <span fg={theme.warning}>{"  [outdated]"}</span> : null}
          </text>
        );
      })}
    </box>
  );
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
