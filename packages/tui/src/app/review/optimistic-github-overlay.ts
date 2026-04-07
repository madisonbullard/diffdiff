import type {
  GitHubPullRequestChangedFilesByPath,
  GitHubPendingReview,
  GitHubPullRequestComment,
  GitHubPullRequestConversationItem,
  GitHubPullRequestDetail,
  GitHubPullRequestFileViewedState,
  GitHubPullRequestReviewThread,
} from "@diffdiff/core";
import type { PreparedReviewSession } from "../../types.ts";

export type GitHubOptimisticOperation =
  | {
      id: number;
      kind: "set-file-viewed-state";
      path: string;
      viewedState: GitHubPullRequestFileViewedState;
    }
  | {
      comment: GitHubPullRequestComment;
      id: number;
      kind: "add-review-thread";
      pendingReviewId: number;
      pendingReviewNodeId: string;
      thread: GitHubPullRequestReviewThread;
    }
  | {
      comment: GitHubPullRequestComment;
      id: number;
      kind: "add-review-thread-reply";
      threadId: string;
    }
  | {
      id: number;
      item: GitHubPullRequestConversationItem;
      kind: "add-pull-request-comment";
    }
  | {
      conversationItem?: GitHubPullRequestConversationItem;
      id: number;
      kind: "submit-pending-review";
    }
  | {
      id: number;
      kind: "merge-pull-request";
      mergedAt: string;
    };

export function applyOptimisticGitHubSession(
  session: PreparedReviewSession,
  operations: readonly GitHubOptimisticOperation[],
): PreparedReviewSession {
  if (session.github == null || operations.length === 0) {
    return session;
  }

  const pullRequest = applyOptimisticGitHubPullRequest(session.github.pullRequest, operations);
  if (pullRequest === session.github.pullRequest) {
    return session;
  }

  return {
    ...session,
    github: {
      ...session.github,
      pullRequest,
    },
  };
}

export function rebaseOptimisticGitHubOperations(
  pullRequest: GitHubPullRequestDetail | undefined,
  operations: readonly GitHubOptimisticOperation[],
): GitHubOptimisticOperation[] {
  if (pullRequest == null || operations.length === 0) {
    return [];
  }

  return operations.filter((operation) => !isOperationReflected(pullRequest, operation));
}

export function applyOptimisticViewedStateToChangedFiles(
  changedFiles: GitHubPullRequestChangedFilesByPath,
  operations: readonly GitHubOptimisticOperation[],
): GitHubPullRequestChangedFilesByPath {
  let nextChangedFiles = changedFiles;

  for (const operation of operations) {
    if (operation.kind !== "set-file-viewed-state") {
      continue;
    }

    nextChangedFiles = setChangedFileViewedState(
      nextChangedFiles,
      operation.path,
      operation.viewedState,
    );
  }

  return nextChangedFiles;
}

function applyOptimisticGitHubPullRequest(
  pullRequest: GitHubPullRequestDetail,
  operations: readonly GitHubOptimisticOperation[],
): GitHubPullRequestDetail {
  return operations.reduce((currentPullRequest, operation) => {
    switch (operation.kind) {
      case "set-file-viewed-state": {
        return {
          ...currentPullRequest,
          changedFiles: setChangedFileViewedState(
            currentPullRequest.changedFiles,
            operation.path,
            operation.viewedState,
          ),
        };
      }
      case "add-review-thread": {
        const pendingReview = ensurePendingReview(
          currentPullRequest.pendingReview,
          operation.pendingReviewId,
          operation.pendingReviewNodeId,
        );
        return {
          ...currentPullRequest,
          pendingReview: {
            ...pendingReview,
            comments: appendComment(pendingReview.comments, operation.comment),
          },
          reviewThreads: appendReviewThread(currentPullRequest.reviewThreads, operation.thread),
        };
      }
      case "add-review-thread-reply": {
        return {
          ...currentPullRequest,
          reviewThreads: currentPullRequest.reviewThreads.map((thread) =>
            thread.id !== operation.threadId
              ? thread
              : {
                  ...thread,
                  comments: appendComment(thread.comments, operation.comment),
                },
          ),
        };
      }
      case "add-pull-request-comment": {
        return {
          ...currentPullRequest,
          conversationItems: appendConversationItem(
            currentPullRequest.conversationItems,
            operation.item,
          ),
        };
      }
      case "submit-pending-review": {
        return {
          ...currentPullRequest,
          conversationItems:
            operation.conversationItem == null
              ? currentPullRequest.conversationItems
              : appendConversationItem(
                  currentPullRequest.conversationItems,
                  operation.conversationItem,
                ),
          pendingReview: undefined,
        };
      }
      case "merge-pull-request": {
        return {
          ...currentPullRequest,
          isMerged: true,
          merge: {
            ...currentPullRequest.merge,
            canMerge: false,
            isMerged: true,
            mergeable: false,
            mergeableState: "merged",
            mergedAt: operation.mergedAt,
          },
          state: "closed",
          updatedAt: operation.mergedAt,
        };
      }
    }
  }, pullRequest);
}

function setChangedFileViewedState(
  changedFiles: GitHubPullRequestChangedFilesByPath,
  path: string,
  viewedState: GitHubPullRequestFileViewedState,
): GitHubPullRequestChangedFilesByPath {
  if (changedFiles[path]?.viewedState === viewedState) {
    return changedFiles;
  }

  return {
    ...changedFiles,
    [path]: {
      path,
      viewedState,
    },
  };
}

function isOperationReflected(
  pullRequest: GitHubPullRequestDetail,
  operation: GitHubOptimisticOperation,
): boolean {
  switch (operation.kind) {
    case "set-file-viewed-state":
      return pullRequest.changedFiles[operation.path]?.viewedState === operation.viewedState;
    case "add-review-thread":
      return hasMatchingReviewComment(pullRequest.reviewThreads, operation.comment);
    case "add-review-thread-reply":
      return hasMatchingReviewComment(pullRequest.reviewThreads, operation.comment);
    case "add-pull-request-comment":
      return pullRequest.conversationItems.some(
        (item) => item.kind === operation.item.kind && item.body === operation.item.body,
      );
    case "submit-pending-review":
      return operation.conversationItem == null
        ? pullRequest.pendingReview == null
        : pullRequest.pendingReview == null &&
            pullRequest.conversationItems.some(
              (item) =>
                item.kind === "review" &&
                item.body === operation.conversationItem?.body &&
                item.reviewState === operation.conversationItem?.reviewState,
            );
    case "merge-pull-request":
      return pullRequest.isMerged;
  }
}

function appendComment(
  comments: readonly GitHubPullRequestComment[],
  comment: GitHubPullRequestComment,
): GitHubPullRequestComment[] {
  if (comments.some((candidate) => candidate.nodeId === comment.nodeId)) {
    return [...comments];
  }

  return [...comments, comment].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

function appendConversationItem(
  items: readonly GitHubPullRequestConversationItem[],
  item: GitHubPullRequestConversationItem,
): GitHubPullRequestConversationItem[] {
  if (items.some((candidate) => candidate.id === item.id)) {
    return [...items];
  }

  return [...items, item].sort((left, right) => {
    const leftDate = left.createdAt || left.updatedAt;
    const rightDate = right.createdAt || right.updatedAt;
    return leftDate.localeCompare(rightDate);
  });
}

function appendReviewThread(
  threads: readonly GitHubPullRequestReviewThread[],
  thread: GitHubPullRequestReviewThread,
): GitHubPullRequestReviewThread[] {
  if (threads.some((candidate) => candidate.id === thread.id)) {
    return [...threads];
  }

  return [...threads, thread];
}

function ensurePendingReview(
  pendingReview: GitHubPendingReview | undefined,
  pendingReviewId: number,
  pendingReviewNodeId: string,
): GitHubPendingReview {
  return (
    pendingReview ?? {
      body: "",
      comments: [],
      id: pendingReviewId,
      nodeId: pendingReviewNodeId,
    }
  );
}

function hasMatchingReviewComment(
  threads: readonly GitHubPullRequestReviewThread[],
  comment: GitHubPullRequestComment,
): boolean {
  return threads.some((thread) =>
    thread.comments.some(
      (candidate) =>
        candidate.body === comment.body &&
        candidate.path === comment.path &&
        candidate.replyToId === comment.replyToId &&
        candidate.line === comment.line &&
        candidate.originalLine === comment.originalLine &&
        candidate.side === comment.side,
    ),
  );
}
