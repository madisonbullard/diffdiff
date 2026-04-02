import type { GitHubPullRequestDetail } from "@diffdiff/core";
import type { UiTheme } from "../theme.ts";
import { MODAL_OVERLAY } from "./shared.tsx";
import { ReviewGroupCard } from "./threads.tsx";

export function PullRequestCommentsModal({
  pullRequest,
  showOutdatedThreads,
  theme,
}: {
  pullRequest: GitHubPullRequestDetail;
  showOutdatedThreads: boolean;
  theme: UiTheme;
}) {
  const reviewGroups = pullRequest.reviewGroups
    .map((group) => ({
      ...group,
      comments: group.comments.filter((comment) => showOutdatedThreads || !comment.isOutdated),
    }))
    .filter((group) => group.state !== "PENDING")
    .filter((group) => group.body != null || group.comments.length > 0);

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
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="column">
            <text fg={theme.accent} wrapMode="none">
              Comments
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" esc "}
            </span>
            <span>{" close"}</span>
          </text>
        </box>
        <scrollbox
          width="100%"
          height="70%"
          focused={true}
          viewportOptions={{ backgroundColor: theme.modalBg }}
          contentOptions={{ backgroundColor: theme.modalBg }}
          verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
        >
          <box width="100%" flexDirection="column" gap={1}>
            {reviewGroups.length === 0 ? (
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
                <text fg={theme.textMuted}>No comments match the current outdated filter.</text>
              </box>
            ) : null}
            {reviewGroups.map((group, index) => (
              <ReviewGroupCard key={`${group.reviewId ?? index}`} group={group} theme={theme} />
            ))}
          </box>
        </scrollbox>
      </box>
    </box>
  );
}
