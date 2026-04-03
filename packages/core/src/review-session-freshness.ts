import { GitHubPullRequestService } from "./github/pull-request-service.ts";
import { buildChangedFilesDigest } from "./review-session-fingerprint.ts";
import { arePullRequestFingerprintsEqual } from "./review-session-fingerprint.ts";
import { listWorkingTreeChanges, summarizeDiffRange } from "./repository/git-diff.ts";
import { summarizeChangedFiles } from "./repository/patch.ts";
import { runCommand } from "./command.ts";
import type {
  ChangeSummary,
  ReviewSession,
  ReviewSessionFreshnessResult,
} from "./types/session.ts";

const PROBE_REF_PREFIX = "refs/diffdiff/probe";
const DEFAULT_GITHUB_PULL_REQUEST_SERVICE = new GitHubPullRequestService();

interface ProbedGitRef {
  ref: string;
  sha?: string;
  remoteName?: string;
  branchName?: string;
}

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

  return {
    hasComparisonUpdates: comparisonResult.hasUpdates,
    hasGitHubUpdates: arePullRequestFingerprintsEqual(
      session.renderFingerprint.pullRequest,
      pullRequestFingerprint,
    )
      ? false
      : pullRequestFingerprint != null,
    comparisonSummary: comparisonResult.summary,
    nextBaseSha: comparisonResult.nextBaseSha,
    nextHeadSha: comparisonResult.nextHeadSha,
    nextPullRequestFingerprint: pullRequestFingerprint,
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
