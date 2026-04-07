import type {
  GitHubPendingReview,
  GitHubPullRequestComment,
  GitHubPullRequestConversationItem,
  GitHubPullRequestFileViewedState,
  GitHubPullRequestReviewThread,
  GitHubReviewSubmissionEvent,
} from "@diffdiff/core";
import type { SelectedReviewAnchor } from "../../review-anchors.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { GitHubOptimisticOperation } from "./optimistic-github-overlay.ts";

interface OptimisticPendingReviewRef {
  id: number;
  nodeId: string;
}

interface BuildOptimisticReviewThreadOperationInput {
  anchor: SelectedReviewAnchor;
  body: string;
  operationId: number;
  pendingReview?: OptimisticPendingReviewRef;
  pullRequestUrl: string;
}

interface BuildOptimisticReviewThreadReplyOperationInput {
  body: string;
  operationId: number;
  pullRequestUrl: string;
  rootCommentId: number;
  thread: GitHubPullRequestReviewThread;
}

interface BuildOptimisticPullRequestCommentOperationInput {
  body: string;
  operationId: number;
  pullRequestUrl: string;
}

interface BuildOptimisticSubmittedReviewOperationInput {
  body?: string;
  event: GitHubReviewSubmissionEvent;
  operationId: number;
  pendingReview?: OptimisticPendingReviewRef;
  pullRequestUrl: string;
}

export function createGitHubOptimisticOperationController(
  state: Pick<DiffdiffAppState, "optimisticGitHubOperationIdRef" | "setOptimisticGitHubOperations">,
) {
  function reserveId(): number {
    state.optimisticGitHubOperationIdRef.current += 1;
    return state.optimisticGitHubOperationIdRef.current;
  }

  function push(operation: GitHubOptimisticOperation): void {
    state.setOptimisticGitHubOperations((currentOperations) => [...currentOperations, operation]);
  }

  function remove(operationId: number): void {
    state.setOptimisticGitHubOperations((currentOperations) =>
      currentOperations.filter((operation) => operation.id !== operationId),
    );
  }

  return { push, remove, reserveId };
}

export function buildOptimisticViewedStateOperation(
  operationId: number,
  path: string,
  viewedState: Exclude<GitHubPullRequestFileViewedState, "DISMISSED">,
): GitHubOptimisticOperation {
  return {
    id: operationId,
    kind: "set-file-viewed-state",
    path,
    viewedState,
  };
}

export function buildOptimisticReviewThreadOperation({
  anchor,
  body,
  operationId,
  pendingReview,
  pullRequestUrl,
}: BuildOptimisticReviewThreadOperationInput): GitHubOptimisticOperation {
  const pendingReviewRef = pendingReview ?? {
    id: -operationId,
    nodeId: `optimistic-pending-review-${operationId}`,
  };
  const comment = buildOptimisticReviewComment({
    body,
    line: anchor.line,
    operationId,
    path: anchor.path,
    pullRequestUrl,
    reviewId: pendingReviewRef.id,
    side: anchor.side,
    startLine: anchor.startLine,
    startSide: anchor.startSide,
  });

  return {
    comment,
    id: operationId,
    kind: "add-review-thread",
    pendingReviewId: pendingReviewRef.id,
    pendingReviewNodeId: pendingReviewRef.nodeId,
    thread: {
      comments: [comment],
      id: `optimistic-thread-${operationId}`,
      isOutdated: false,
      line: anchor.line,
      path: anchor.path,
      reviewId: pendingReviewRef.id,
      side: anchor.side,
      startLine: anchor.startLine,
      startSide: anchor.startSide,
    },
  };
}

export function buildOptimisticReviewThreadReplyOperation({
  body,
  operationId,
  pullRequestUrl,
  rootCommentId,
  thread,
}: BuildOptimisticReviewThreadReplyOperationInput): GitHubOptimisticOperation {
  return {
    comment: buildOptimisticReviewComment({
      body,
      line: thread.line,
      operationId,
      originalLine: thread.originalLine,
      path: thread.path,
      pullRequestUrl,
      replyToId: rootCommentId,
      reviewId: thread.reviewId,
      side: thread.side,
      startLine: thread.startLine,
      startSide: thread.startSide,
    }),
    id: operationId,
    kind: "add-review-thread-reply",
    threadId: thread.id,
  };
}

export function buildOptimisticPullRequestCommentOperation({
  body,
  operationId,
  pullRequestUrl,
}: BuildOptimisticPullRequestCommentOperationInput): GitHubOptimisticOperation {
  const timestamp = new Date().toISOString();

  return {
    id: operationId,
    item: {
      author: { login: "you" },
      body,
      createdAt: timestamp,
      id: `optimistic-pr-comment:${operationId}`,
      kind: "pull-request-comment",
      updatedAt: timestamp,
      url: `${pullRequestUrl}#optimistic-pr-comment-${operationId}`,
    },
    kind: "add-pull-request-comment",
  };
}

export function buildOptimisticSubmittedReviewOperation({
  body,
  event,
  operationId,
  pendingReview,
  pullRequestUrl,
}: BuildOptimisticSubmittedReviewOperationInput): GitHubOptimisticOperation {
  const timestamp = new Date().toISOString();
  const trimmedBody = body?.trim();

  return {
    conversationItem: {
      author: { login: "you" },
      body: trimmedBody ?? "",
      createdAt: timestamp,
      id: `optimistic-review:${operationId}`,
      kind: "review",
      reviewId: pendingReview?.id,
      reviewNodeId: pendingReview?.nodeId,
      reviewState: getOptimisticReviewState(event),
      updatedAt: timestamp,
      url: `${pullRequestUrl}#optimistic-review-${operationId}`,
    },
    id: operationId,
    kind: "submit-pending-review",
  };
}

export function buildOptimisticMergeOperation(
  operationId: number,
  mergedAt = new Date().toISOString(),
): GitHubOptimisticOperation {
  return {
    id: operationId,
    kind: "merge-pull-request",
    mergedAt,
  };
}

function buildOptimisticReviewComment({
  body,
  line,
  operationId,
  originalLine,
  path,
  pullRequestUrl,
  replyToId,
  reviewId,
  side,
  startLine,
  startSide,
}: {
  body: string;
  line?: number;
  operationId: number;
  originalLine?: number;
  path: string;
  pullRequestUrl: string;
  replyToId?: number;
  reviewId?: number;
  side: GitHubPullRequestComment["side"];
  startLine?: number;
  startSide?: GitHubPullRequestComment["startSide"];
}): GitHubPullRequestComment {
  const timestamp = new Date().toISOString();

  return {
    author: { login: "you" },
    body,
    createdAt: timestamp,
    id: -operationId,
    isOutdated: false,
    line,
    nodeId: `optimistic-review-comment-${operationId}`,
    originalLine,
    path,
    replyToId,
    reviewId,
    side,
    startLine,
    startSide,
    updatedAt: timestamp,
    url: `${pullRequestUrl}#optimistic-review-comment-${operationId}`,
  };
}

function getOptimisticReviewState(
  event: GitHubReviewSubmissionEvent,
): GitHubPullRequestConversationItem["reviewState"] {
  switch (event) {
    case "APPROVE":
      return "APPROVED";
    case "REQUEST_CHANGES":
      return "CHANGES_REQUESTED";
    default:
      return "COMMENTED";
  }
}

export function toOptimisticPendingReviewRef(
  pendingReview: GitHubPendingReview | undefined,
): OptimisticPendingReviewRef | undefined {
  return pendingReview == null ? undefined : { id: pendingReview.id, nodeId: pendingReview.nodeId };
}
