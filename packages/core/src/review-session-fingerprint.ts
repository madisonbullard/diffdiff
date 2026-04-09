import { createHash } from "node:crypto";
import type { GitHubPullRequestDetail } from "./types/github.ts";
import type {
  ChangedFile,
  PullRequestOpinionatedReview,
  PullRequestCoarseFingerprint,
  PullRequestFingerprint,
  PullRequestRequestedReviewer,
  ReviewSession,
  ReviewSessionFingerprint,
} from "./types/session.ts";

export function buildReviewSessionFingerprint(
  session: Omit<ReviewSession, "renderFingerprint">,
): ReviewSessionFingerprint {
  return {
    comparisonMode: session.comparison.mode,
    baseRef: session.comparison.base,
    headRef: session.comparison.head,
    baseSha: session.comparison.baseSha,
    headSha: session.comparison.headSha,
    fileCount: session.files.length,
    patchDigest: buildChangedFilesDigest(session.files),
    pullRequest:
      session.github == null ? undefined : buildPullRequestFingerprint(session.github.pullRequest),
  };
}

export function buildPullRequestFingerprint(
  pullRequest: GitHubPullRequestDetail,
): PullRequestFingerprint {
  const latestOpinionatedReviews = pullRequest.latestOpinionatedReviews.map((review) => ({
    author: review.author.login,
    state: review.state,
    updatedAt: review.updatedAt,
  }));
  const reviewRequests = pullRequest.reviewRequests.map((reviewer) => ({
    kind: reviewer.kind,
    label: reviewer.label,
  }));

  return {
    ...buildPullRequestCoarseFingerprint(pullRequest),
    latestOpinionatedReviewDigest:
      buildPullRequestOpinionatedReviewDigest(latestOpinionatedReviews),
    latestOpinionatedReviews,
    reviewDecision: pullRequest.reviewDecision,
    reviewRequestDigest: buildPullRequestRequestedReviewerDigest(reviewRequests),
    reviewRequests,
  };
}

export function buildPullRequestCoarseFingerprint(
  pullRequest: Pick<
    GitHubPullRequestDetail,
    | "changedFileCount"
    | "checks"
    | "commitCount"
    | "headSha"
    | "isDraft"
    | "isMerged"
    | "issueCommentCount"
    | "merge"
    | "number"
    | "reviewCommentCount"
    | "state"
    | "updatedAt"
  >,
): PullRequestCoarseFingerprint {
  return {
    changedFileCount: pullRequest.changedFileCount,
    checksState: pullRequest.checks.state,
    commitCount: pullRequest.commitCount,
    headSha: pullRequest.headSha,
    isDraft: pullRequest.isDraft,
    isMerged: pullRequest.isMerged,
    issueCommentCount: pullRequest.issueCommentCount,
    mergeableState: pullRequest.merge.mergeableState,
    number: pullRequest.number,
    reviewCommentCount: pullRequest.reviewCommentCount,
    state: pullRequest.state,
    updatedAt: pullRequest.updatedAt,
  };
}

export function areReviewSessionFingerprintsEqual(
  left: ReviewSessionFingerprint,
  right: ReviewSessionFingerprint,
): boolean {
  return (
    left.comparisonMode === right.comparisonMode &&
    left.baseRef === right.baseRef &&
    left.headRef === right.headRef &&
    left.baseSha === right.baseSha &&
    left.headSha === right.headSha &&
    left.fileCount === right.fileCount &&
    left.patchDigest === right.patchDigest &&
    arePullRequestFingerprintsEqual(left.pullRequest, right.pullRequest)
  );
}

export function arePullRequestFingerprintsEqual(
  left: PullRequestFingerprint | undefined,
  right: PullRequestFingerprint | undefined,
): boolean {
  if (left == null || right == null) {
    return left === right;
  }

  return (
    arePullRequestCoarseFingerprintsEqual(left, right) &&
    left.reviewDecision === right.reviewDecision &&
    left.reviewRequestDigest === right.reviewRequestDigest &&
    left.latestOpinionatedReviewDigest === right.latestOpinionatedReviewDigest
  );
}

export function arePullRequestCoarseFingerprintsEqual(
  left: PullRequestCoarseFingerprint | undefined,
  right: PullRequestCoarseFingerprint | undefined,
): boolean {
  if (left == null || right == null) {
    return left === right;
  }

  return (
    left.number === right.number &&
    left.headSha === right.headSha &&
    left.checksState === right.checksState &&
    left.commitCount === right.commitCount &&
    left.changedFileCount === right.changedFileCount &&
    left.issueCommentCount === right.issueCommentCount &&
    left.reviewCommentCount === right.reviewCommentCount &&
    left.state === right.state &&
    left.isDraft === right.isDraft &&
    left.isMerged === right.isMerged &&
    left.mergeableState === right.mergeableState &&
    left.updatedAt === right.updatedAt
  );
}

export function buildPullRequestRequestedReviewerDigest(
  reviewRequests: readonly PullRequestRequestedReviewer[],
): string {
  return buildCollectionDigest(
    reviewRequests.map((reviewer) => `${reviewer.kind}:${reviewer.label}`).sort(),
  );
}

export function buildPullRequestOpinionatedReviewDigest(
  reviews: readonly PullRequestOpinionatedReview[],
): string {
  return buildCollectionDigest(
    reviews.map((review) => `${review.author}:${review.state}:${review.updatedAt}`).sort(),
  );
}

export function buildChangedFilesDigest(files: readonly ChangedFile[]): string {
  return buildCollectionDigest(
    files.map((file) =>
      [
        file.path,
        file.previousPath ?? "",
        file.status,
        String(file.additions),
        String(file.deletions),
        file.isBinary ? "1" : "0",
        file.patch,
      ].join("\0"),
    ),
  );
}

function buildCollectionDigest(entries: readonly string[]): string {
  const hash = createHash("sha256");

  for (const entry of entries) {
    hash.update(entry);
    hash.update("\0\0");
  }

  return hash.digest("hex");
}
