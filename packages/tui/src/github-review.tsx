import type { ScrollBoxRenderable } from "@opentui/core";

import type {
  GitHubCleanupPreferences,
  GitHubMergeMethod,
  GitHubPullRequestComment,
  GitHubPullRequestDetail,
  GitHubPullRequestReviewGroup,
  GitHubPullRequestReviewThread,
  GitHubRefCleanupCandidate,
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
  theme,
}: {
  pullRequest: GitHubPullRequestDetail;
  theme: UiTheme;
}) {
  const outdatedThreadCount = pullRequest.reviewThreads.filter(
    (thread) => thread.isOutdated,
  ).length;
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
        {outdatedThreadCount > 0 ? (
          <>
            <span fg={theme.border}>{"  │  "}</span>
            <span>{`${outdatedThreadCount} outdated`}</span>
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
              {`Comment on ${anchor.path}:${anchor.line} (${anchor.side.toLowerCase()}).`}
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
          {isSubmitting ? "Submitting review comment..." : "Type your comment body."}
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

const MERGE_METHODS: readonly GitHubMergeMethod[] = ["merge", "squash"];
const MERGE_BODY_MAX_HEIGHT = 8;

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
              Submit the current review to GitHub.
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

export function MergePullRequestModal({
  body,
  bodyScrollRef,
  canSubmit,
  field,
  isSubmitting,
  method,
  pullRequest,
  theme,
  title,
}: {
  body: string;
  bodyScrollRef?: React.Ref<ScrollBoxRenderable | null>;
  canSubmit: boolean;
  field: "method" | "title" | "body";
  isSubmitting: boolean;
  method?: GitHubMergeMethod;
  pullRequest: GitHubPullRequestDetail;
  theme: UiTheme;
  title: string;
}) {
  const mergeBlockedReason = getMergeBlockedReason(pullRequest);

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
              Merge Pull Request
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              {`PR #${pullRequest.number} • ${pullRequest.title}`}
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" tab "}
            </span>
            <span>{" next field  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" enter "}
            </span>
            <span>{" merge  "}</span>
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
        <box width="100%" flexDirection="column" gap={0}>
          {MERGE_METHODS.map((mergeMethod) => {
            const isFocused = field === "method" && mergeMethod === (method ?? MERGE_METHODS[0]);
            const isSelected = mergeMethod === method;
            const accent = mergeMethod === "merge" ? theme.accent : theme.success;

            return (
              <box
                key={mergeMethod}
                width="100%"
                border={["left"]}
                customBorderChars={REVIEW_BORDER}
                borderColor={isFocused ? accent : theme.border}
                backgroundColor={isFocused ? theme.surfaceMuted : theme.surface}
                paddingLeft={2}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
              >
                <text fg={isFocused ? theme.text : theme.textMuted} wrapMode="none">
                  <span fg={accent}>{isFocused ? "> " : "  "}</span>
                  <span>{formatMergeMethod(mergeMethod)}</span>
                  <span fg={theme.border}>{"  │  "}</span>
                  <span fg={isSelected ? accent : theme.textMuted}>
                    {isSelected ? "default selection" : "available"}
                  </span>
                </text>
              </box>
            );
          })}
        </box>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={REVIEW_BORDER}
          borderColor={field === "title" ? theme.borderActive : theme.border}
          backgroundColor={field === "title" ? theme.surfaceMuted : theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
        >
          <text fg={theme.text} wrapMode="word">
            <span fg={theme.textMuted}>{"Title: "}</span>
            {title !== "" ? title : ""}
            {field === "title" ? <span fg={theme.accent}>_</span> : null}
          </text>
        </box>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={REVIEW_BORDER}
          borderColor={field === "body" ? theme.borderActive : theme.border}
          backgroundColor={field === "body" ? theme.surfaceMuted : theme.surface}
          paddingLeft={2}
          paddingRight={0}
          paddingTop={1}
          paddingBottom={1}
          minHeight={6}
          flexDirection="column"
          gap={0}
        >
          <text fg={theme.textMuted} wrapMode="none">
            Body:
          </text>
          <scrollbox
            ref={bodyScrollRef}
            width="100%"
            height={MERGE_BODY_MAX_HEIGHT}
            focused={field === "body"}
            viewportOptions={{
              backgroundColor: field === "body" ? theme.surfaceMuted : theme.surface,
            }}
            contentOptions={{
              backgroundColor: field === "body" ? theme.surfaceMuted : theme.surface,
            }}
            verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
          >
            <text fg={theme.text} wrapMode="word">
              {body !== "" ? body : ""}
              {field === "body" ? <span fg={theme.accent}>_</span> : null}
            </text>
          </scrollbox>
        </box>
        <text fg={canSubmit ? theme.textMuted : theme.warning} wrapMode="word">
          {isSubmitting
            ? "Merging pull request and refreshing local refs..."
            : canSubmit
              ? "Edit the merge title/body, then press enter to merge."
              : mergeBlockedReason}
        </text>
      </box>
    </box>
  );
}

export function PostMergeCleanupModal({
  canApply,
  candidates,
  isSubmitting,
  selectedIndex,
  selection,
  theme,
}: {
  canApply: boolean;
  candidates: readonly GitHubRefCleanupCandidate[];
  isSubmitting: boolean;
  selectedIndex: number;
  selection: GitHubCleanupPreferences;
  theme: UiTheme;
}) {
  const localCandidate = candidates.find((candidate) => candidate.kind === "local-branch");
  const remoteCandidate = candidates.find((candidate) => candidate.kind === "remote-tracking");
  const entries = [
    {
      description:
        localCandidate == null
          ? "No matching local branch is available."
          : `Delete local branch ${localCandidate.ref} with a force delete if needed.`,
      isAvailable: localCandidate != null,
      isEnabled: selection.removeLocal,
      key: "removeLocal" as const,
      label:
        localCandidate == null ? "Local branch unavailable" : `Local branch ${localCandidate.ref}`,
    },
    {
      description:
        remoteCandidate == null
          ? "No matching remote-tracking ref is available."
          : `Delete remote-tracking ref ${remoteCandidate.ref} from this clone only.`,
      isAvailable: remoteCandidate != null,
      isEnabled: selection.removeRemote,
      key: "removeRemote" as const,
      label:
        remoteCandidate == null
          ? "Remote-tracking ref unavailable"
          : `Remote-tracking ref ${remoteCandidate.ref}`,
    },
  ];

  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={56}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width="92%"
        maxWidth={104}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="column">
            <text fg={theme.accent} wrapMode="none">
              Post-Merge Cleanup
            </text>
            <text fg={theme.textMuted} wrapMode="word">
              The remote branch layout changed after the merge. Choose which stale refs to remove
              from this clone.
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" j/k "}
            </span>
            <span>{" move  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" space "}
            </span>
            <span>{" toggle  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" enter "}
            </span>
            <span>{" apply  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" esc "}
            </span>
            <span>{" skip"}</span>
          </text>
        </box>
        <box width="100%" flexDirection="column" gap={0}>
          {entries.map((entry, index) => {
            const isSelected = index === selectedIndex;
            return (
              <box
                key={entry.key}
                width="100%"
                border={["left"]}
                customBorderChars={REVIEW_BORDER}
                borderColor={isSelected ? theme.accent : theme.border}
                backgroundColor={isSelected ? theme.surfaceMuted : theme.surface}
                paddingLeft={2}
                paddingRight={1}
                paddingTop={1}
                paddingBottom={1}
                flexDirection="column"
                gap={0}
              >
                <text fg={entry.isAvailable ? theme.text : theme.textMuted} wrapMode="none">
                  <span fg={isSelected ? theme.accent : theme.border}>
                    {isSelected ? "> " : "  "}
                  </span>
                  <span>{entry.isEnabled ? "[x] " : "[ ] "}</span>
                  <span>{entry.label}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="word">
                  {entry.description}
                </text>
              </box>
            );
          })}
        </box>
        <text fg={canApply ? theme.textMuted : theme.warning} wrapMode="word">
          {isSubmitting
            ? "Removing selected refs..."
            : canApply
              ? "Enter applies the selected cleanup. Force-delete warnings apply to local branches."
              : "Choose at least one available ref to remove, or press esc to keep the current refs."}
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
    return "no checks";
  }

  return `${pullRequest.checks.successful}/${pullRequest.checks.total} checks ${pullRequest.checks.state}`;
}

function getPullRequestTag(
  pullRequest: GitHubPullRequestDetail,
  theme: UiTheme,
): { background: string; label: string } {
  if (pullRequest.state !== "open") {
    return { background: theme.danger, label: "CLOSED PR" };
  }

  if (pullRequest.isDraft) {
    return { background: theme.warning, label: "DRAFT PR" };
  }

  return { background: theme.success, label: "PR" };
}

function getMergeStatusLabel(pullRequest: GitHubPullRequestDetail): string {
  if (pullRequest.isMerged) {
    return "merged";
  }

  if (pullRequest.state !== "open") {
    return "closed";
  }

  if (pullRequest.isDraft) {
    return "merge blocked";
  }

  if (pullRequest.merge.canMerge) {
    return "merge ready";
  }

  return pullRequest.merge.mergeableState ?? "merge blocked";
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

function getMergeStatusColor(pullRequest: GitHubPullRequestDetail, theme: UiTheme): string {
  if (pullRequest.isMerged) {
    return theme.success;
  }

  if (pullRequest.state !== "open") {
    return theme.danger;
  }

  if (pullRequest.isDraft) {
    return theme.warning;
  }

  return pullRequest.merge.canMerge ? theme.success : theme.warning;
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

export function getMergeMethod(index: number): GitHubMergeMethod {
  return MERGE_METHODS[Math.max(0, Math.min(index, MERGE_METHODS.length - 1))]!;
}

export function getMergeMethodIndex(method?: GitHubMergeMethod): number {
  return method == null ? 0 : Math.max(MERGE_METHODS.indexOf(method), 0);
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

function formatMergeMethod(method: GitHubMergeMethod): string {
  return method === "merge" ? "Merge commit" : "Squash merge";
}

function getMergeBlockedReason(pullRequest: GitHubPullRequestDetail): string {
  if (pullRequest.isMerged) {
    return "This pull request is already merged.";
  }

  if (pullRequest.state !== "open") {
    return "This pull request is closed, so merge is disabled.";
  }

  if (pullRequest.isDraft) {
    return "GitHub currently marks this PR as a draft, so merge is disabled.";
  }

  if (pullRequest.merge.mergeableState != null) {
    return `GitHub currently reports ${pullRequest.merge.mergeableState}; merge is disabled until that changes.`;
  }

  return "GitHub has not reported a mergeable state yet, so merge is disabled for now.";
}
