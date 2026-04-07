import type {
  GitHubPullRequestDetail,
  GitHubPullRequestReviewThread,
} from "@madisonbullard/diffdiff-core";
import { getReviewThreadCollapseKey, getReviewThreadDefaultCollapsed } from "./collapse-state.ts";

export interface VisibleCommentTimestamps {
  fingerprint: string;
  timestamps: readonly string[];
}

export function collectVisibleCommentTimestamps({
  activeOverlay,
  collapsedCommentStates,
  fileCardBodyVisibility,
  files,
  pullRequest,
  reviewThreadsByPath,
}: {
  activeOverlay: import("../app/dialogs/stack.ts").AppDialog | null;
  collapsedCommentStates: Readonly<Record<string, boolean>>;
  fileCardBodyVisibility: readonly boolean[];
  files: readonly { path: string }[];
  pullRequest?: Pick<GitHubPullRequestDetail, "conversationItems">;
  reviewThreadsByPath: ReadonlyMap<string, readonly GitHubPullRequestReviewThread[]>;
}): VisibleCommentTimestamps {
  const timestamps: string[] = [];
  let fingerprint = "";

  const appendTimestamp = (timestamp: string | undefined) => {
    if (timestamp == null || timestamp === "") {
      return;
    }

    timestamps.push(timestamp);
    fingerprint = fingerprint === "" ? timestamp : `${fingerprint}\u0000${timestamp}`;
  };

  if (activeOverlay === "comments") {
    for (const item of pullRequest?.conversationItems ?? []) {
      appendTimestamp(item.createdAt || item.updatedAt);
    }

    return { fingerprint, timestamps };
  }

  if (activeOverlay != null) {
    return { fingerprint, timestamps };
  }

  for (const [index, file] of files.entries()) {
    if (!fileCardBodyVisibility[index]) {
      continue;
    }

    for (const thread of reviewThreadsByPath.get(file.path) ?? []) {
      const collapseKey = getReviewThreadCollapseKey(thread);
      const isCollapsed =
        collapsedCommentStates[collapseKey] ?? getReviewThreadDefaultCollapsed(thread);
      if (isCollapsed) {
        continue;
      }

      for (const comment of thread.comments) {
        appendTimestamp(comment.createdAt);
      }
    }
  }

  return { fingerprint, timestamps };
}
