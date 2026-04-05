import type {
  ForgeRepository,
  GitHubPullRequestComment,
  GitHubPullRequestConversationItem,
  GitHubPullRequestMergeState,
  GitHubPullRequestReviewGroup,
  GitHubPullRequestReviewThread,
  PullRequestInfo,
} from "../types/github.ts";
import type { ReviewSession, ReviewWarning } from "../types/session.ts";
import type {
  GitHubPullRequestDetailResponse,
  GitHubIssueCommentResponse,
  GitHubPullRequestListResponse,
  GitHubReviewCommentResponse,
  GitHubReviewResponse,
  GitHubUserResponse,
} from "./pull-request-types.ts";

export function buildReviewThreads(
  comments: readonly GitHubPullRequestComment[],
): GitHubPullRequestReviewThread[] {
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]));
  const threads = new Map<string, GitHubPullRequestReviewThread>();

  for (const comment of comments) {
    const rootComment = findRootComment(comment, commentsById);
    const threadId = String(rootComment.id);
    const existingThread = threads.get(threadId);

    if (existingThread == null) {
      threads.set(threadId, {
        comments: [comment],
        id: threadId,
        isOutdated: rootComment.isOutdated,
        line: rootComment.line,
        originalLine: rootComment.originalLine,
        path: rootComment.path,
        reviewId: rootComment.reviewId,
        side: rootComment.side,
        startLine: rootComment.startLine,
        startSide: rootComment.startSide,
      });
      continue;
    }

    existingThread.comments.push(comment);
    existingThread.isOutdated = existingThread.isOutdated || comment.isOutdated;
  }

  return [...threads.values()].map((thread) => ({
    ...thread,
    comments: [...thread.comments].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    ),
  }));
}

export function buildReviewGroups(
  reviews: readonly GitHubReviewResponse[],
  comments: readonly GitHubPullRequestComment[],
): GitHubPullRequestReviewGroup[] {
  const commentsByReviewId = new Map<number, GitHubPullRequestComment[]>();

  for (const comment of comments) {
    if (comment.reviewId == null) {
      continue;
    }

    const reviewComments = commentsByReviewId.get(comment.reviewId) ?? [];
    reviewComments.push(comment);
    commentsByReviewId.set(comment.reviewId, reviewComments);
  }

  const groups = reviews.map((review) => ({
    author: mapActor(review.user),
    body: review.body ?? undefined,
    comments: [...(commentsByReviewId.get(review.id) ?? [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    ),
    reviewId: review.id,
    reviewNodeId: review.node_id,
    state: review.state,
    submittedAt: review.submitted_at ?? undefined,
  }));

  return groups.sort((left, right) => {
    const leftDate = left.submittedAt ?? left.comments[0]?.createdAt ?? "";
    const rightDate = right.submittedAt ?? right.comments[0]?.createdAt ?? "";
    return leftDate.localeCompare(rightDate);
  });
}

export function buildConversationItems(
  reviews: readonly GitHubReviewResponse[],
  issueComments: readonly GitHubPullRequestConversationItem[],
): GitHubPullRequestConversationItem[] {
  const reviewItems = reviews
    .filter((review) => review.state !== "PENDING")
    .filter((review) => review.body != null && review.body.trim() !== "")
    .map((review) => ({
      author: mapActor(review.user),
      body: review.body!.trim(),
      createdAt: review.submitted_at ?? "",
      id: `review:${review.id}`,
      kind: "review" as const,
      reviewId: review.id,
      reviewNodeId: review.node_id,
      reviewState: review.state,
      updatedAt: review.submitted_at ?? "",
      url: review.html_url,
    }));

  return [...issueComments, ...reviewItems].sort((left, right) => {
    const leftDate = left.createdAt || left.updatedAt;
    const rightDate = right.createdAt || right.updatedAt;
    return leftDate.localeCompare(rightDate);
  });
}

export function buildMergeState(
  pullRequest: GitHubPullRequestDetailResponse,
): GitHubPullRequestMergeState {
  return {
    canMerge:
      pullRequest.state === "open" &&
      pullRequest.draft === false &&
      pullRequest.merged === false &&
      pullRequest.mergeable === true,
    isDraft: pullRequest.draft,
    isMerged: pullRequest.merged,
    mergeable: pullRequest.mergeable ?? undefined,
    mergeableState: pullRequest.mergeable_state ?? undefined,
    mergedAt: pullRequest.merged_at ?? undefined,
  };
}

export function findActivePullRequestCandidate(session: ReviewSession): {
  pullRequest: PullRequestInfo;
  remoteName: string;
  repository: ForgeRepository;
} | null {
  if (session.comparison.mode !== "range") {
    return null;
  }

  for (const branch of session.branches.remote) {
    if (branch.pullRequest == null || branch.remoteName == null) {
      continue;
    }

    const headMatches =
      session.comparison.head === branch.name ||
      session.comparison.head === branch.pullRequest.headRefName ||
      session.comparison.head === session.repository.currentBranch;

    if (!headMatches) {
      continue;
    }

    const remote = session.repository.remotes.find(
      (candidateRemote) => candidateRemote.name === branch.remoteName,
    );
    if (remote?.forge == null) {
      continue;
    }

    return {
      pullRequest: branch.pullRequest,
      remoteName: branch.remoteName,
      repository: remote.forge,
    };
  }

  return null;
}

export function mapPullRequestSummary(pullRequest: GitHubPullRequestListResponse): PullRequestInfo {
  return {
    baseRefName: pullRequest.base.ref,
    createdAt: pullRequest.created_at,
    headRefName: pullRequest.head.ref,
    number: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.html_url,
  };
}

export function mapPullRequestComment(
  comment: GitHubReviewCommentResponse,
): GitHubPullRequestComment {
  return {
    author: mapActor(comment.user),
    body: comment.body,
    commitId: comment.commit_id ?? undefined,
    createdAt: comment.created_at,
    diffHunk: comment.diff_hunk ?? undefined,
    id: comment.id,
    isOutdated: comment.line == null && comment.original_line != null,
    line: comment.line ?? undefined,
    nodeId: comment.node_id,
    originalCommitId: comment.original_commit_id ?? undefined,
    originalLine: comment.original_line ?? undefined,
    path: comment.path,
    replyToId: comment.in_reply_to_id ?? undefined,
    reviewId: comment.pull_request_review_id ?? undefined,
    side: comment.side ?? "RIGHT",
    startLine: comment.start_line ?? undefined,
    startSide: comment.start_side ?? undefined,
    updatedAt: comment.updated_at,
    url: comment.html_url,
  };
}

export function mapIssueComment(
  comment: GitHubIssueCommentResponse,
): GitHubPullRequestConversationItem {
  return {
    author: mapActor(comment.user),
    body: comment.body,
    createdAt: comment.created_at,
    id: `pull-request-comment:${comment.id}`,
    kind: "pull-request-comment",
    updatedAt: comment.updated_at,
    url: comment.html_url,
  };
}

export function mapActor(user: GitHubUserResponse | null | undefined) {
  return {
    login: user?.login ?? "unknown",
    url: user?.html_url ?? undefined,
  };
}

export function dedupeWarnings(warnings: readonly ReviewWarning[]): ReviewWarning[] {
  const seenWarnings = new Set<string>();

  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.message}`;
    if (seenWarnings.has(key)) {
      return false;
    }

    seenWarnings.add(key);
    return true;
  });
}

function findRootComment(
  comment: GitHubPullRequestComment,
  commentsById: ReadonlyMap<number, GitHubPullRequestComment>,
): GitHubPullRequestComment {
  let currentComment = comment;

  while (currentComment.replyToId != null) {
    const parentComment = commentsById.get(currentComment.replyToId);
    if (parentComment == null) {
      break;
    }

    currentComment = parentComment;
  }

  return currentComment;
}
