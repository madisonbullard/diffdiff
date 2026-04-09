import type {
  GitHubPullRequestComment,
  GitHubPullRequestConversationItem,
  GitHubPullRequestDetail,
  GitHubPullRequestReviewGroup,
} from "@madisonbullard/diffdiff-core";
import type { UiTheme } from "../theme.ts";
import { CommentTimestamp, ReviewMetaSeparator } from "./comment-metadata.tsx";
import { MODAL_OVERLAY } from "./shared.tsx";
import { getReviewStateColor } from "./formatting.ts";

export function PullRequestCommentsModal({
  selectedItemId,
  pullRequest,
  theme,
}: {
  selectedItemId?: string;
  pullRequest: GitHubPullRequestDetail;
  theme: UiTheme;
}) {
  const conversationItems = pullRequest.conversationItems;

  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={50}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width="92%"
        maxWidth={118}
        height="92%"
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="column">
            <text fg={theme.accent} wrapMode="none">
              PR Conversation
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" j/k "}
            </span>
            <span>{" move  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" r "}
            </span>
            <span>{" reply  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" y "}
            </span>
            <span>{" copy link  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" esc "}
            </span>
            <span>{" close"}</span>
          </text>
        </box>
        <scrollbox
          width="100%"
          flexGrow={1}
          focused={true}
          viewportOptions={{ backgroundColor: theme.modalBg }}
          contentOptions={{ backgroundColor: theme.modalBg }}
          verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
        >
          <box width="100%" flexDirection="column" gap={1}>
            {conversationItems.length === 0 ? (
              <box
                border={["left"]}
                customBorderChars={{
                  topLeft: "",
                  bottomLeft: "",
                  vertical: "┃",
                  topRight: "",
                  bottomRight: "",
                  horizontal: " ",
                  bottomT: "",
                  topT: "",
                  cross: "",
                  leftT: "",
                  rightT: "",
                }}
                borderColor={theme.border}
                backgroundColor={theme.surface}
                paddingLeft={2}
                paddingRight={1}
                paddingTop={1}
                paddingBottom={1}
              >
                <text fg={theme.textMuted}>No PR conversation items yet.</text>
              </box>
            ) : null}
            {conversationItems.map((item) => (
              <ConversationItemCard
                key={item.id}
                isSelected={item.id === selectedItemId}
                item={item}
                reviewGroup={
                  item.kind !== "review"
                    ? undefined
                    : pullRequest.reviewGroups.find(
                        (candidate) =>
                          candidate.reviewId === item.reviewId ||
                          candidate.reviewNodeId === item.reviewNodeId,
                      )
                }
                theme={theme}
              />
            ))}
          </box>
        </scrollbox>
      </box>
    </box>
  );
}

function ConversationItemCard({
  isSelected,
  item,
  reviewGroup,
  theme,
}: {
  isSelected: boolean;
  item: GitHubPullRequestConversationItem;
  reviewGroup?: GitHubPullRequestReviewGroup;
  theme: UiTheme;
}) {
  const accentColor =
    item.kind === "review" && item.reviewState != null
      ? getReviewStateColor(item.reviewState, theme)
      : theme.accent;
  const body = item.body.trim();
  const reviewComments = reviewGroup?.comments ?? [];

  return (
    <box
      width="100%"
      border={["left"]}
      borderColor={isSelected ? theme.accent : accentColor}
      backgroundColor={isSelected ? theme.surface : theme.commentBg}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={1}
    >
      <text fg={theme.textMuted} wrapMode="none">
        <span fg={isSelected ? theme.accent : theme.border}>{isSelected ? "> " : "  "}</span>
        <span fg={theme.text}>{item.author.login}</span>
        <ReviewMetaSeparator theme={theme} />
        <span fg={accentColor}>
          {item.kind === "review" ? (item.reviewState ?? "review").toLowerCase() : "pr comment"}
        </span>
        {reviewComments.length > 0 ? (
          <>
            <ReviewMetaSeparator theme={theme} />
            <span>{formatCommentCount(reviewComments.length)}</span>
          </>
        ) : null}
        <ReviewMetaSeparator theme={theme} />
        <CommentTimestamp theme={theme} value={item.createdAt || item.updatedAt} />
      </text>
      {body !== "" ? (
        <text fg={theme.text} wrapMode="word">
          {body}
        </text>
      ) : null}
      {reviewComments.length > 0 ? (
        <ReviewCommentList comments={reviewComments} theme={theme} />
      ) : null}
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
        <box key={comment.id} width="100%" flexDirection="column">
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent}>{comment.author.login}</span>
            <ReviewMetaSeparator theme={theme} />
            <span fg={theme.text}>{formatCommentAnchor(comment)}</span>
            <ReviewMetaSeparator theme={theme} />
            <CommentTimestamp theme={theme} value={comment.createdAt} />
          </text>
          <text fg={theme.text} wrapMode="word">
            {comment.body}
            {comment.isOutdated ? <span fg={theme.warning}>{"  [outdated]"}</span> : null}
          </text>
        </box>
      ))}
    </box>
  );
}

function formatCommentAnchor(comment: GitHubPullRequestComment): string {
  const anchorLine = comment.line ?? comment.originalLine;
  if (anchorLine == null) {
    return comment.path;
  }

  if (comment.startLine != null && comment.startLine !== anchorLine) {
    return `${comment.path}:${comment.startLine}-${anchorLine}`;
  }

  return `${comment.path}:${anchorLine}`;
}

function formatCommentCount(commentCount: number): string {
  return `${commentCount} comment${commentCount === 1 ? "" : "s"}`;
}
