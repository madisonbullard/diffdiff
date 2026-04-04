import { formatThreadAnchor } from "../../review/threads.tsx";
import type { GitHubPullRequestComment, GitHubPullRequestConversationItem } from "@diffdiff/core";

export type ReviewComposerTarget =
  | {
      kind: "pull-request-comment-reply";
      item: GitHubPullRequestConversationItem;
      quotedBody: string;
    }
  | {
      anchor: import("../../review-anchors.ts").SelectedReviewAnchor;
      kind: "review-thread";
    }
  | {
      comment: GitHubPullRequestComment;
      kind: "review-thread-reply";
      rootCommentId: number;
      thread: import("@diffdiff/core").GitHubPullRequestReviewThread;
    };

export function getReviewComposerContext(target: ReviewComposerTarget): {
  snippet: string;
  subtitle: string;
  title: string;
} {
  if (target.kind === "review-thread") {
    return {
      snippet: target.anchor.snippet,
      subtitle: `Comment on ${target.anchor.path}:${target.anchor.line} (${target.anchor.side.toLowerCase()}).`,
      title: "Add Comment",
    };
  }

  if (target.kind === "review-thread-reply") {
    return {
      snippet: target.comment.body,
      subtitle: `Reply in ${formatThreadAnchor(target.thread)} to ${target.comment.author.login}.`,
      title: "Reply to Thread",
    };
  }

  return {
    snippet: target.quotedBody,
    subtitle: `Reply to ${target.item.author.login}'s PR comment. A quoted top-level PR comment will be created.`,
    title: "Reply to PR Comment",
  };
}

export function buildQuotedPullRequestReply(
  item: GitHubPullRequestConversationItem,
  body: string,
): string {
  const quotedBody = item.body
    .split(/\r?\n/u)
    .map((line) => `> ${line}`)
    .join("\n");

  return [`Replying to ${item.author.login}:`, quotedBody, "", body].join("\n");
}
