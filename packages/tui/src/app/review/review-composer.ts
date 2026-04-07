import { formatThreadAnchor } from "../../review/threads.tsx";
import type {
  GitHubPullRequestComment,
  GitHubPullRequestConversationItem,
} from "@madisonbullard/diffdiff-core";
import type { PreparedReviewSession } from "../../types.ts";

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
      thread: import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread;
    };

export interface ReviewComposerHistoryScope {
  path?: string;
  pullRequestNumber?: number;
  repositoryRootPath: string;
  targetKey: string;
  targetKind: ReviewComposerTarget["kind"];
}

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

export function getReviewComposerHistoryScope(
  session: PreparedReviewSession,
  target: ReviewComposerTarget,
): ReviewComposerHistoryScope {
  switch (target.kind) {
    case "review-thread": {
      const { anchor } = target;
      const rangeStart = anchor.startLine ?? anchor.line;
      return {
        path: anchor.path,
        pullRequestNumber: session.github?.pullRequest.number,
        repositoryRootPath: session.repository.rootPath,
        targetKey: `review-thread:${anchor.path}:${rangeStart}-${anchor.line}:${anchor.side}`,
        targetKind: target.kind,
      };
    }
    case "review-thread-reply":
      return {
        path: target.thread.path,
        pullRequestNumber: session.github?.pullRequest.number,
        repositoryRootPath: session.repository.rootPath,
        targetKey: `review-thread-reply:${target.thread.id}`,
        targetKind: target.kind,
      };
    case "pull-request-comment-reply":
      return {
        pullRequestNumber: session.github?.pullRequest.number,
        repositoryRootPath: session.repository.rootPath,
        targetKey: `pull-request-comment-reply:${target.item.id}`,
        targetKind: target.kind,
      };
  }
}
