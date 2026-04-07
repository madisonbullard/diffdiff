import type { GitHubPullRequestConversationItem, GitHubPullRequestDetail } from "@diffdiff/core";
import type { UiTheme } from "../theme.ts";
import { MODAL_OVERLAY } from "./shared.tsx";
import { formatTimestamp, getReviewStateColor } from "./formatting.ts";

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
  theme,
}: {
  isSelected: boolean;
  item: GitHubPullRequestConversationItem;
  theme: UiTheme;
}) {
  const accentColor =
    item.kind === "review" && item.reviewState != null
      ? getReviewStateColor(item.reviewState, theme)
      : theme.accent;

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
        <span fg={theme.border}>{"  │  "}</span>
        <span fg={accentColor}>
          {item.kind === "review" ? (item.reviewState ?? "review").toLowerCase() : "pr comment"}
        </span>
        <span fg={theme.border}>{"  │  "}</span>
        <span>{formatTimestamp(item.createdAt)}</span>
      </text>
      <text fg={theme.text} wrapMode="word">
        {item.body}
      </text>
    </box>
  );
}
