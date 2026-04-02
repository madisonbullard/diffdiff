import { runCommand } from "../command.ts";
import type {
  GitHubPullRequestMergeRequest,
  GitHubRefCleanupCandidate,
  GitHubReviewSession,
} from "../types/github.ts";
import type { DeletedRemoteRef } from "./pull-request-types.ts";

export async function refreshPostMergeRefs(
  reviewSession: GitHubReviewSession,
): Promise<DeletedRemoteRef[]> {
  const refsToRefresh = dedupeDeletedRemoteRefs([
    {
      branchName: reviewSession.pullRequest.baseRefName,
      remoteRef: `${reviewSession.remoteName}/${reviewSession.pullRequest.baseRefName}`,
    },
    {
      branchName: reviewSession.pullRequest.headRefName,
      remoteRef: `${reviewSession.remoteName}/${reviewSession.pullRequest.headRefName}`,
    },
  ]);
  const deletedRemoteRefs: DeletedRemoteRef[] = [];

  for (const ref of refsToRefresh) {
    const existedLocally = await hasRef(
      reviewSession.repositoryRootPath,
      `refs/remotes/${ref.remoteRef}`,
    );
    const existsOnRemote = await remoteBranchExists(
      reviewSession.repositoryRootPath,
      reviewSession.remoteName,
      ref.branchName,
    );

    if (existsOnRemote) {
      await fetchRemoteBranch(
        reviewSession.repositoryRootPath,
        reviewSession.remoteName,
        ref.branchName,
      );
      continue;
    }

    if (existedLocally) {
      deletedRemoteRefs.push(ref);
    }
  }

  return deletedRemoteRefs;
}

export async function buildCleanupCandidates(
  repositoryRootPath: string,
  comparison: GitHubPullRequestMergeRequest["comparison"],
  deletedRemoteRefs: readonly DeletedRemoteRef[],
): Promise<GitHubRefCleanupCandidate[]> {
  const cleanupCandidates: GitHubRefCleanupCandidate[] = [];

  for (const ref of deletedRemoteRefs) {
    if (!matchesDeletedRemoteRef(comparison, ref.remoteRef, ref.branchName)) {
      continue;
    }

    if (await hasRef(repositoryRootPath, `refs/heads/${ref.branchName}`)) {
      cleanupCandidates.push({
        branchName: ref.branchName,
        kind: "local-branch",
        ref: ref.branchName,
      });
    }

    if (await hasRef(repositoryRootPath, `refs/remotes/${ref.remoteRef}`)) {
      cleanupCandidates.push({
        branchName: ref.branchName,
        kind: "remote-tracking",
        ref: ref.remoteRef,
      });
    }
  }

  return dedupeCleanupCandidates(cleanupCandidates).sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "local-branch" ? -1 : 1;
    }

    return left.ref.localeCompare(right.ref);
  });
}

export function dedupeCleanupCandidates(
  refs: readonly GitHubRefCleanupCandidate[],
): GitHubRefCleanupCandidate[] {
  const seenRefs = new Set<string>();

  return refs.filter((ref) => {
    const key = `${ref.kind}:${ref.ref}`;
    if (seenRefs.has(key)) {
      return false;
    }

    seenRefs.add(key);
    return true;
  });
}

function matchesDeletedRemoteRef(
  comparison: GitHubPullRequestMergeRequest["comparison"],
  remoteRef: string,
  branchName: string,
): boolean {
  return [comparison.base, comparison.head].some(
    (comparisonRef) => comparisonRef === remoteRef || comparisonRef === branchName,
  );
}

function dedupeDeletedRemoteRefs(refs: readonly DeletedRemoteRef[]): DeletedRemoteRef[] {
  const seenRefs = new Set<string>();

  return refs.filter((ref) => {
    if (seenRefs.has(ref.remoteRef)) {
      return false;
    }

    seenRefs.add(ref.remoteRef);
    return true;
  });
}

async function hasRef(repositoryRootPath: string, ref: string): Promise<boolean> {
  try {
    await runCommand("git", ["rev-parse", "--verify", ref], {
      cwd: repositoryRootPath,
    });
    return true;
  } catch {
    return false;
  }
}

async function remoteBranchExists(
  repositoryRootPath: string,
  remoteName: string,
  branchName: string,
): Promise<boolean> {
  const stdout = await runCommand(
    "git",
    ["ls-remote", "--heads", remoteName, `refs/heads/${branchName}`],
    {
      allowedExitCodes: [2],
      cwd: repositoryRootPath,
    },
  );

  return stdout.trim() !== "";
}

async function fetchRemoteBranch(
  repositoryRootPath: string,
  remoteName: string,
  branchName: string,
): Promise<void> {
  await runCommand(
    "git",
    ["fetch", remoteName, `refs/heads/${branchName}:refs/remotes/${remoteName}/${branchName}`],
    {
      cwd: repositoryRootPath,
    },
  );
}
