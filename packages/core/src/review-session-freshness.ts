import { GitHubPullRequestService } from "./github/pull-request-service.ts";
import { buildChangedFilesDigest } from "./review-session-fingerprint.ts";
import { arePullRequestFingerprintsEqual } from "./review-session-fingerprint.ts";
import { listWorkingTreeChanges, summarizeDiffRange } from "./repository/git-diff.ts";
import { summarizeChangedFiles } from "./repository/patch.ts";
import { runCommand } from "./command.ts";
import type {
  ChangeSummary,
  PullRequestFingerprint,
  PullRequestUpdateReason,
  PullRequestUpdateReasonCode,
  ReviewSession,
  ReviewSessionFreshnessResult,
} from "./types/session.ts";

const PROBE_REF_PREFIX = "refs/diffdiff/probe";
const DEFAULT_GITHUB_PULL_REQUEST_SERVICE = new GitHubPullRequestService();
const PULL_REQUEST_UPDATE_PRIORITY: Record<PullRequestUpdateReasonCode, number> = {
  merged: 0,
  closed: 1,
  reopened: 2,
  "new-commits": 3,
  "changes-requested": 4,
  "review-approved": 5,
  "review-requested": 6,
  "review-request-removed": 7,
  "checks-changed": 8,
  "ready-for-review": 9,
  "converted-to-draft": 10,
  "comments-added": 11,
  "review-threads-updated": 12,
  "mergeability-changed": 13,
  "file-list-changed": 14,
  activity: 15,
};

interface ProbedGitRef {
  ref: string;
  sha?: string;
  remoteName?: string;
  branchName?: string;
}

interface PullRequestUpdateContext {
  approvedActors: string[];
  changedReviewActors: string[];
  changesRequestedActors: string[];
  next: PullRequestFingerprint;
  previous: PullRequestFingerprint;
  requestedReviewerDelta: {
    added: string[];
    removed: string[];
  };
}

type PullRequestUpdateDetector = (
  context: PullRequestUpdateContext,
  reasons: readonly PullRequestUpdateReason[],
) => PullRequestUpdateReason | PullRequestUpdateReason[] | undefined;

const PULL_REQUEST_UPDATE_DETECTORS: readonly PullRequestUpdateDetector[] = [
  detectPullRequestLifecycleChange,
  detectNewCommitChange,
  detectReviewDecisionChange,
  detectReviewRequestChange,
  detectChecksChange,
  detectDraftStateChange,
  detectIssueCommentChange,
  detectReviewThreadChange,
  detectMergeabilityChange,
  detectChangedFileCountChange,
];

export async function probeReviewSessionFreshness(
  session: ReviewSession,
  githubPullRequestService: GitHubPullRequestService = DEFAULT_GITHUB_PULL_REQUEST_SERVICE,
): Promise<ReviewSessionFreshnessResult> {
  const [comparisonResult, pullRequestFingerprint] = await Promise.all([
    probeComparisonFreshness(session),
    session.github == null
      ? Promise.resolve(undefined)
      : githubPullRequestService.probePullRequestFingerprint(session.github),
  ]);
  const githubUpdateReasons = classifyPullRequestUpdateReasons(
    session.renderFingerprint.pullRequest,
    pullRequestFingerprint,
  );
  const hasGitHubUpdates =
    githubUpdateReasons.length > 0 ||
    (!arePullRequestFingerprintsEqual(
      session.renderFingerprint.pullRequest,
      pullRequestFingerprint,
    ) &&
      pullRequestFingerprint != null);

  return {
    hasComparisonUpdates: comparisonResult.hasUpdates,
    hasGitHubUpdates,
    comparisonSummary: comparisonResult.summary,
    githubUpdateReasons,
    nextBaseSha: comparisonResult.nextBaseSha,
    nextHeadSha: comparisonResult.nextHeadSha,
    nextPullRequestFingerprint: pullRequestFingerprint,
  };
}

function classifyPullRequestUpdateReasons(
  previous: PullRequestFingerprint | undefined,
  next: PullRequestFingerprint | undefined,
): PullRequestUpdateReason[] {
  if (previous == null || next == null || arePullRequestFingerprintsEqual(previous, next)) {
    return [];
  }

  const context = createPullRequestUpdateContext(previous, next);
  const reasons: PullRequestUpdateReason[] = [];

  for (const detector of PULL_REQUEST_UPDATE_DETECTORS) {
    const detectedReasons = detector(context, reasons);
    if (detectedReasons == null) {
      continue;
    }

    reasons.push(...(Array.isArray(detectedReasons) ? detectedReasons : [detectedReasons]));
  }

  if (reasons.length === 0 && previous.updatedAt !== next.updatedAt) {
    reasons.push({ code: "activity" });
  }

  return reasons.sort(
    (left, right) =>
      PULL_REQUEST_UPDATE_PRIORITY[left.code] - PULL_REQUEST_UPDATE_PRIORITY[right.code],
  );
}

function createPullRequestUpdateContext(
  previous: PullRequestFingerprint,
  next: PullRequestFingerprint,
): PullRequestUpdateContext {
  return {
    approvedActors: getReviewActorsForStateChange(previous, next, "APPROVED"),
    changedReviewActors: getChangedOpinionatedReviewActors(previous, next),
    changesRequestedActors: getReviewActorsForStateChange(previous, next, "CHANGES_REQUESTED"),
    next,
    previous,
    requestedReviewerDelta: getRequestedReviewerDelta(previous.reviewRequests, next.reviewRequests),
  };
}

function detectPullRequestLifecycleChange(
  context: PullRequestUpdateContext,
): PullRequestUpdateReason | undefined {
  if (!context.previous.isMerged && context.next.isMerged) {
    return { code: "merged" };
  }

  if (context.previous.state === "open" && context.next.state === "closed") {
    return { code: "closed" };
  }

  if (context.previous.state === "closed" && context.next.state === "open") {
    return { code: "reopened" };
  }

  return undefined;
}

function detectNewCommitChange(
  context: PullRequestUpdateContext,
): PullRequestUpdateReason | undefined {
  if (context.previous.headSha === context.next.headSha) {
    return undefined;
  }

  return {
    code: "new-commits",
    count:
      context.next.commitCount > context.previous.commitCount
        ? context.next.commitCount - context.previous.commitCount
        : undefined,
  };
}

function detectReviewDecisionChange(
  context: PullRequestUpdateContext,
): PullRequestUpdateReason | undefined {
  if (
    context.next.reviewDecision === "APPROVED" &&
    (context.approvedActors.length > 0 ||
      context.previous.reviewDecision !== context.next.reviewDecision)
  ) {
    return { code: "review-approved", actors: context.approvedActors };
  }

  if (
    context.next.reviewDecision === "CHANGES_REQUESTED" &&
    (context.changesRequestedActors.length > 0 ||
      context.previous.reviewDecision !== context.next.reviewDecision)
  ) {
    return { code: "changes-requested", actors: context.changesRequestedActors };
  }

  return undefined;
}

function detectReviewRequestChange(
  context: PullRequestUpdateContext,
): PullRequestUpdateReason[] | undefined {
  const reasons: PullRequestUpdateReason[] = [];

  if (context.requestedReviewerDelta.added.length > 0) {
    reasons.push({ code: "review-requested", reviewers: context.requestedReviewerDelta.added });
  }

  if (context.requestedReviewerDelta.removed.length > 0) {
    reasons.push({
      code: "review-request-removed",
      reviewers: context.requestedReviewerDelta.removed,
    });
  }

  return reasons.length === 0 ? undefined : reasons;
}

function detectChecksChange(
  context: PullRequestUpdateContext,
): PullRequestUpdateReason | undefined {
  if (context.previous.checksState === context.next.checksState) {
    return undefined;
  }

  return {
    code: "checks-changed",
    from: context.previous.checksState,
    to: context.next.checksState,
  };
}

function detectDraftStateChange(
  context: PullRequestUpdateContext,
): PullRequestUpdateReason | undefined {
  if (context.previous.isDraft && !context.next.isDraft) {
    return { code: "ready-for-review" };
  }

  if (!context.previous.isDraft && context.next.isDraft) {
    return { code: "converted-to-draft" };
  }

  return undefined;
}

function detectIssueCommentChange(
  context: PullRequestUpdateContext,
): PullRequestUpdateReason | undefined {
  if (context.next.issueCommentCount <= context.previous.issueCommentCount) {
    return undefined;
  }

  return {
    code: "comments-added",
    count: context.next.issueCommentCount - context.previous.issueCommentCount,
  };
}

function detectReviewThreadChange(
  context: PullRequestUpdateContext,
  reasons: readonly PullRequestUpdateReason[],
): PullRequestUpdateReason | undefined {
  if (
    context.next.reviewCommentCount <= context.previous.reviewCommentCount &&
    context.changedReviewActors.length === 0 &&
    context.previous.reviewDecision === context.next.reviewDecision
  ) {
    return undefined;
  }

  if (
    reasons.some(
      (reason) => reason.code === "review-approved" || reason.code === "changes-requested",
    )
  ) {
    return undefined;
  }

  return {
    code: "review-threads-updated",
    actors: context.changedReviewActors,
    count:
      context.next.reviewCommentCount > context.previous.reviewCommentCount
        ? context.next.reviewCommentCount - context.previous.reviewCommentCount
        : undefined,
  };
}

function detectMergeabilityChange(
  context: PullRequestUpdateContext,
): PullRequestUpdateReason | undefined {
  if (context.previous.mergeableState === context.next.mergeableState) {
    return undefined;
  }

  return {
    code: "mergeability-changed",
    from: context.previous.mergeableState ?? "unknown",
    to: context.next.mergeableState ?? "unknown",
  };
}

function detectChangedFileCountChange(
  context: PullRequestUpdateContext,
): PullRequestUpdateReason | undefined {
  if (context.previous.changedFileCount === context.next.changedFileCount) {
    return undefined;
  }

  return {
    code: "file-list-changed",
    from: String(context.previous.changedFileCount),
    to: String(context.next.changedFileCount),
  };
}

function getReviewActorsForStateChange(
  previous: PullRequestFingerprint,
  next: PullRequestFingerprint,
  state: "APPROVED" | "CHANGES_REQUESTED",
): string[] {
  const previousStatesByAuthor = new Map(
    previous.latestOpinionatedReviews.map((review) => [review.author, review.state]),
  );

  return next.latestOpinionatedReviews
    .filter((review) => review.state === state)
    .filter((review) => previousStatesByAuthor.get(review.author) !== state)
    .map((review) => review.author)
    .sort((left, right) => left.localeCompare(right));
}

function getChangedOpinionatedReviewActors(
  previous: PullRequestFingerprint,
  next: PullRequestFingerprint,
): string[] {
  const previousByAuthor = new Map(
    previous.latestOpinionatedReviews.map((review) => [
      review.author,
      `${review.state}:${review.updatedAt}`,
    ]),
  );
  const changedActors = new Set<string>();

  for (const review of next.latestOpinionatedReviews) {
    if (previousByAuthor.get(review.author) !== `${review.state}:${review.updatedAt}`) {
      changedActors.add(review.author);
    }
  }

  return [...changedActors].sort((left, right) => left.localeCompare(right));
}

function getRequestedReviewerDelta(
  previous: PullRequestFingerprint["reviewRequests"],
  next: PullRequestFingerprint["reviewRequests"],
): { added: string[]; removed: string[] } {
  const previousLabels = new Set(previous.map((reviewer) => reviewer.label));
  const nextLabels = new Set(next.map((reviewer) => reviewer.label));

  return {
    added: [...nextLabels]
      .filter((label) => !previousLabels.has(label))
      .sort((left, right) => left.localeCompare(right)),
    removed: [...previousLabels]
      .filter((label) => !nextLabels.has(label))
      .sort((left, right) => left.localeCompare(right)),
  };
}

async function probeComparisonFreshness(session: ReviewSession): Promise<{
  hasUpdates: boolean;
  summary?: ChangeSummary;
  nextBaseSha?: string;
  nextHeadSha?: string;
}> {
  if (session.comparison.mode === "working-tree") {
    const [files, nextHeadSha] = await Promise.all([
      listWorkingTreeChanges(session.repository.rootPath, session.comparison.base),
      resolveLocalRefSha(session.repository.rootPath, "HEAD"),
    ]);
    const summary = summarizeChangedFiles(files);
    const nextPatchDigest = buildChangedFilesDigest(files);
    const hasUpdates =
      session.renderFingerprint.baseSha !== nextHeadSha ||
      session.renderFingerprint.headSha !== nextHeadSha ||
      session.renderFingerprint.fileCount !== files.length ||
      session.renderFingerprint.patchDigest !== nextPatchDigest;

    return {
      hasUpdates,
      summary: hasUpdates ? summary : undefined,
      nextBaseSha: nextHeadSha,
      nextHeadSha,
    };
  }

  if (session.comparison.mode !== "range") {
    return {
      hasUpdates: false,
      nextBaseSha: session.renderFingerprint.baseSha,
      nextHeadSha: session.renderFingerprint.headSha,
    };
  }

  const remoteNames = session.repository.remotes.map((remote) => remote.name);
  const [baseRef, headRef] = await Promise.all([
    probeGitRef(session.repository.rootPath, session.comparison.base, remoteNames),
    probeGitRef(session.repository.rootPath, session.comparison.head, remoteNames),
  ]);
  const hasUpdates =
    baseRef.sha !== session.renderFingerprint.baseSha ||
    headRef.sha !== session.renderFingerprint.headSha;

  if (!hasUpdates) {
    return {
      hasUpdates: false,
      nextBaseSha: baseRef.sha,
      nextHeadSha: headRef.sha,
    };
  }

  return {
    hasUpdates: true,
    summary: await summarizeUpdatedComparison(session.repository.rootPath, {
      base: baseRef,
      head: headRef,
    }),
    nextBaseSha: baseRef.sha,
    nextHeadSha: headRef.sha,
  };
}

async function probeGitRef(
  rootPath: string,
  ref: string,
  remoteNames: readonly string[],
): Promise<ProbedGitRef> {
  const remoteTrackingRef = parseRemoteTrackingRef(ref, remoteNames);
  if (remoteTrackingRef != null) {
    return {
      ref,
      sha: await resolveRemoteBranchSha(
        rootPath,
        remoteTrackingRef.remoteName,
        remoteTrackingRef.branchName,
      ),
      remoteName: remoteTrackingRef.remoteName,
      branchName: remoteTrackingRef.branchName,
    };
  }

  return {
    ref,
    sha: await resolveLocalRefSha(rootPath, ref),
  };
}

function parseRemoteTrackingRef(
  ref: string,
  remoteNames: readonly string[],
): { remoteName: string; branchName: string } | undefined {
  for (const remoteName of [...remoteNames].sort((left, right) => right.length - left.length)) {
    if (!ref.startsWith(`${remoteName}/`)) {
      continue;
    }

    return {
      remoteName,
      branchName: ref.slice(remoteName.length + 1),
    };
  }

  return undefined;
}

async function resolveRemoteBranchSha(
  rootPath: string,
  remoteName: string,
  branchName: string,
): Promise<string | undefined> {
  try {
    const stdout = await runCommand(
      "git",
      ["ls-remote", "--exit-code", "--refs", remoteName, `refs/heads/${branchName}`],
      { cwd: rootPath },
    );
    const [sha] = stdout.trim().split(/\s+/u, 2);
    return sha === "" ? undefined : sha;
  } catch {
    return undefined;
  }
}

async function resolveLocalRefSha(rootPath: string, ref: string): Promise<string | undefined> {
  try {
    return (await runCommand("git", ["rev-parse", "--verify", ref], { cwd: rootPath })).trim();
  } catch {
    return undefined;
  }
}

async function summarizeUpdatedComparison(
  rootPath: string,
  refs: { base: ProbedGitRef; head: ProbedGitRef },
): Promise<ChangeSummary | undefined> {
  try {
    const [baseRangeRef, headRangeRef] = await Promise.all([
      materializeProbeRef(rootPath, refs.base),
      materializeProbeRef(rootPath, refs.head),
    ]);

    if (baseRangeRef == null || headRangeRef == null) {
      return undefined;
    }

    return summarizeDiffRange(rootPath, `${baseRangeRef}...${headRangeRef}`);
  } catch {
    return undefined;
  }
}

async function materializeProbeRef(
  rootPath: string,
  ref: ProbedGitRef,
): Promise<string | undefined> {
  if (ref.remoteName == null || ref.branchName == null) {
    return ref.ref;
  }

  const tempRef = `${PROBE_REF_PREFIX}/${ref.remoteName}/${ref.branchName}`;
  if (ref.sha == null) {
    await deleteProbeRef(rootPath, tempRef);
    return undefined;
  }

  await runCommand(
    "git",
    ["fetch", "--no-tags", ref.remoteName, `+refs/heads/${ref.branchName}:${tempRef}`],
    { cwd: rootPath },
  );

  return tempRef;
}

async function deleteProbeRef(rootPath: string, ref: string): Promise<void> {
  try {
    await runCommand("git", ["update-ref", "-d", ref], { cwd: rootPath });
  } catch {
    // Ignore missing probe refs.
  }
}
