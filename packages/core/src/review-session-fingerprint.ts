import { createHash } from "node:crypto";
import type { GitHubPullRequestDetail } from "./types/github.ts";
import type {
  ChangedFile,
  PullRequestFingerprint,
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
  return {
    number: pullRequest.number,
    headSha: pullRequest.headSha,
    checksState: pullRequest.checks.state,
    state: pullRequest.state,
    isDraft: pullRequest.isDraft,
    isMerged: pullRequest.isMerged,
    mergeableState: pullRequest.merge.mergeableState,
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
    left.number === right.number &&
    left.headSha === right.headSha &&
    left.checksState === right.checksState &&
    left.state === right.state &&
    left.isDraft === right.isDraft &&
    left.isMerged === right.isMerged &&
    left.mergeableState === right.mergeableState &&
    left.updatedAt === right.updatedAt
  );
}

function buildChangedFilesDigest(files: readonly ChangedFile[]): string {
  const hash = createHash("sha256");

  for (const file of files) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.previousPath ?? "");
    hash.update("\0");
    hash.update(file.status);
    hash.update("\0");
    hash.update(String(file.additions));
    hash.update("\0");
    hash.update(String(file.deletions));
    hash.update("\0");
    hash.update(file.isBinary ? "1" : "0");
    hash.update("\0");
    hash.update(file.patch);
    hash.update("\0\0");
  }

  return hash.digest("hex");
}
