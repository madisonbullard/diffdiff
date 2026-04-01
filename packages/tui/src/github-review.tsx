import type {
  GitHubPullRequestComment,
  GitHubPullRequestDetail,
  GitHubPullRequestReviewGroup,
  GitHubPullRequestReviewThread,
  GitHubReviewSubmissionEvent,
} from "@diffdiff/core";
import type { SelectedReviewAnchor } from "./review-anchors.ts";
import type { SideBySideDiffRow, UnifiedDiffLine } from "./types.ts";
import type { UiTheme } from "./theme.ts";

const REVIEW_BORDER = {
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
} as const;

const MODAL_OVERLAY = "#00000096";

export function PullRequestBanner({
  pullRequest,
  showOutdatedThreads,
  theme,
}: {
  pullRequest: GitHubPullRequestDetail;
  showOutdatedThreads: boolean;
  theme: UiTheme;
}) {
  const hiddenOutdatedCount = pullRequest.reviewThreads.filter(
    (thread) => thread.isOutdated,
  ).length;
  const mergeStatus = pullRequest.merge.canMerge
    ? "merge ready"
    : pullRequest.isMerged
      ? "merged"
      : pullRequest.isDraft
        ? "draft"
        : (pullRequest.merge.mergeableState ?? "merge blocked");

  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={REVIEW_BORDER}
      borderColor={theme.success}
      backgroundColor={theme.surface}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={0}
    >
      <text fg={theme.text} wrapMode="none">
        <span fg={theme.inverseText} bg={theme.success}>{` PR #${pullRequest.number} `}</span>
        <span> </span>
        <span fg={theme.success}>{pullRequest.title}</span>
        <span fg={theme.border}>{"  │  "}</span>
        <span fg={theme.textMuted}>{pullRequest.author.login}</span>
      </text>
      <text fg={theme.textMuted} wrapMode="none">
        <span>{`${pullRequest.reviewThreads.length}`}</span>
        <span>{" threads"}</span>
        <span fg={theme.border}>{"  │  "}</span>
        <span fg={getChecksColor(pullRequest, theme)}>{formatChecksSummary(pullRequest)}</span>
        <span fg={theme.border}>{"  │  "}</span>
        <span fg={pullRequest.merge.canMerge ? theme.success : theme.warning}>{mergeStatus}</span>
        <span fg={theme.border}>{"  │  "}</span>
        <span>{showOutdatedThreads ? "showing outdated" : "hiding outdated"}</span>
        {!showOutdatedThreads && hiddenOutdatedCount > 0 ? (
          <>
            <span fg={theme.border}>{"  │  "}</span>
            <span>{`${hiddenOutdatedCount} hidden`}</span>
          </>
        ) : null}
        {pullRequest.pendingReview != null ? (
          <>
            <span fg={theme.border}>{"  │  "}</span>
            <span fg={theme.accent}>{`${pullRequest.pendingReview.comments.length} pending`}</span>
          </>
        ) : null}
      </text>
    </box>
  );
}

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
            <text fg={theme.textMuted} wrapMode="none">
              {`Grouped by GitHub review for PR #${pullRequest.number}.`}
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
                customBorderChars={REVIEW_BORDER}
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

export function ReviewComposerModal({
  anchor,
  body,
  isSubmitting,
  theme,
}: {
  anchor: SelectedReviewAnchor;
  body: string;
  isSubmitting: boolean;
  theme: UiTheme;
}) {
  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={55}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width="92%"
        maxWidth={108}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="column">
            <text fg={theme.accent} wrapMode="none">
              Add Comment
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              {`Pending review thread on ${anchor.path}:${anchor.line} (${anchor.side.toLowerCase()}).`}
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" enter "}
            </span>
            <span>{" submit  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" shift+enter "}
            </span>
            <span>{" newline  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" esc "}
            </span>
            <span>{" close"}</span>
          </text>
        </box>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={REVIEW_BORDER}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
        >
          <text fg={theme.text} wrapMode="word">
            {anchor.snippet}
          </text>
        </box>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={REVIEW_BORDER}
          borderColor={theme.borderActive}
          backgroundColor={theme.surfaceMuted}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          minHeight={8}
        >
          <text fg={theme.text} wrapMode="word">
            {body !== "" ? body : ""}
            <span fg={theme.accent}>_</span>
          </text>
        </box>
        <text fg={isSubmitting ? theme.accent : theme.textMuted} wrapMode="none">
          {isSubmitting
            ? "Submitting comment to the pending review..."
            : "Type your comment body. The pending review stays server-side on GitHub."}
        </text>
      </box>
    </box>
  );
}

const REVIEW_SUBMISSION_EVENTS: readonly GitHubReviewSubmissionEvent[] = [
  "COMMENT",
  "APPROVE",
  "REQUEST_CHANGES",
];

export function SubmitReviewModal({
  body,
  eventIndex,
  isSubmitting,
  theme,
}: {
  body: string;
  eventIndex: number;
  isSubmitting: boolean;
  theme: UiTheme;
}) {
  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={55}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width="88%"
        maxWidth={96}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="column">
            <text fg={theme.accent} wrapMode="none">
              Submit Review
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              Submit the current server-side pending review.
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" j/k "}
            </span>
            <span>{" choose event  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" enter "}
            </span>
            <span>{" submit  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" esc "}
            </span>
            <span>{" close"}</span>
          </text>
        </box>
        <box width="100%" flexDirection="column" gap={0}>
          {REVIEW_SUBMISSION_EVENTS.map((event, index) => {
            const isSelected = index === eventIndex;
            const accent =
              event === "APPROVE"
                ? theme.success
                : event === "REQUEST_CHANGES"
                  ? theme.danger
                  : theme.accent;

            return (
              <box
                key={event}
                width="100%"
                border={["left"]}
                customBorderChars={REVIEW_BORDER}
                borderColor={isSelected ? accent : theme.border}
                backgroundColor={isSelected ? theme.surfaceMuted : theme.surface}
                paddingLeft={2}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
              >
                <text fg={isSelected ? theme.text : theme.textMuted} wrapMode="none">
                  <span fg={accent}>{isSelected ? "> " : "  "}</span>
                  <span>{formatReviewEvent(event)}</span>
                </text>
              </box>
            );
          })}
        </box>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={REVIEW_BORDER}
          borderColor={theme.borderActive}
          backgroundColor={theme.surfaceMuted}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          minHeight={6}
        >
          <text fg={theme.text} wrapMode="word">
            {body !== "" ? body : ""}
            <span fg={theme.accent}>_</span>
          </text>
        </box>
        <text fg={isSubmitting ? theme.accent : theme.textMuted} wrapMode="none">
          {isSubmitting
            ? "Submitting review..."
            : "Optional review summary. Use shift+enter for a newline."}
        </text>
      </box>
    </box>
  );
}

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

function ReviewGroupCard({
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

function formatChecksSummary(pullRequest: GitHubPullRequestDetail): string {
  if (pullRequest.checks.total === 0) {
    return "checks unknown";
  }

  return `${pullRequest.checks.successful}/${pullRequest.checks.total} checks ${pullRequest.checks.state}`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function getChecksColor(pullRequest: GitHubPullRequestDetail, theme: UiTheme): string {
  switch (pullRequest.checks.state) {
    case "success":
      return theme.success;
    case "failure":
      return theme.danger;
    case "pending":
      return theme.warning;
    case "unknown":
      return theme.textMuted;
  }
}

function getReviewStateColor(state: string, theme: UiTheme): string {
  if (state === "APPROVED") {
    return theme.success;
  }

  if (state === "CHANGES_REQUESTED") {
    return theme.danger;
  }

  if (state === "PENDING") {
    return theme.accent;
  }

  return theme.warning;
}

export function getReviewSubmissionEvent(index: number): GitHubReviewSubmissionEvent {
  return REVIEW_SUBMISSION_EVENTS[
    Math.max(0, Math.min(index, REVIEW_SUBMISSION_EVENTS.length - 1))
  ]!;
}

function formatReviewEvent(event: GitHubReviewSubmissionEvent): string {
  switch (event) {
    case "APPROVE":
      return "Approve";
    case "COMMENT":
      return "Comment";
    case "REQUEST_CHANGES":
      return "Request changes";
  }
}
