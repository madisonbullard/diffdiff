import { useRenderer } from "@opentui/react";
import { useMemo, type ReactNode } from "react";
import { ReviewRelativeTimeProvider } from "../../review/comment-metadata.tsx";
import { useRelativeTimeClock } from "../../review/use-relative-time-clock.ts";
import { collectVisibleCommentTimestamps } from "../../review/visible-comment-timestamps.ts";
import type { PreparedReviewSession } from "../../types.ts";

export function VisibleCommentRelativeTimeProvider({
  activeOverlay,
  children,
  collapsedCommentStates,
  fileCardBodyVisibility,
  reviewThreadsByPath,
  session,
}: {
  activeOverlay: import("../dialogs/stack.ts").AppDialog | null;
  children: ReactNode;
  collapsedCommentStates: Readonly<Record<string, boolean>>;
  fileCardBodyVisibility: readonly boolean[];
  reviewThreadsByPath: ReadonlyMap<
    string,
    readonly import("@diffdiff/core").GitHubPullRequestReviewThread[]
  >;
  session: PreparedReviewSession;
}) {
  const nowMs = useVisibleCommentRelativeTime({
    activeOverlay,
    collapsedCommentStates,
    fileCardBodyVisibility,
    reviewThreadsByPath,
    session,
  });

  return <ReviewRelativeTimeProvider nowMs={nowMs}>{children}</ReviewRelativeTimeProvider>;
}

function useVisibleCommentRelativeTime({
  activeOverlay,
  collapsedCommentStates,
  fileCardBodyVisibility,
  reviewThreadsByPath,
  session,
}: {
  activeOverlay: import("../dialogs/stack.ts").AppDialog | null;
  collapsedCommentStates: Readonly<Record<string, boolean>>;
  fileCardBodyVisibility: readonly boolean[];
  reviewThreadsByPath: ReadonlyMap<
    string,
    readonly import("@diffdiff/core").GitHubPullRequestReviewThread[]
  >;
  session: PreparedReviewSession;
}) {
  const renderer = useRenderer();
  const visibleCommentTimestamps = useMemo(
    () =>
      collectVisibleCommentTimestamps({
        activeOverlay,
        collapsedCommentStates,
        fileCardBodyVisibility,
        files: session.files,
        pullRequest: session.github?.pullRequest,
        reviewThreadsByPath,
      }),
    [
      activeOverlay,
      collapsedCommentStates,
      fileCardBodyVisibility,
      reviewThreadsByPath,
      session.files,
      session.github?.pullRequest,
    ],
  );

  return useRelativeTimeClock({
    isActive: visibleCommentTimestamps.timestamps.length > 0,
    renderer,
    timestampFingerprint: visibleCommentTimestamps.fingerprint,
    timestamps: visibleCommentTimestamps.timestamps,
  });
}
