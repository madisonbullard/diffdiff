import { runCommand } from "../command.ts";
import { logDiffdiffError } from "../logging.ts";
import type {
  GitHubPullRequestMergeRequest,
  GitHubRefCleanupCandidate,
  GitHubReviewSession,
} from "../types/github.ts";
import type { DeletedRemoteRef } from "./pull-request-types.ts";

export async function preparePostMergeCleanup(
  reviewSession: GitHubReviewSession,
  comparison: GitHubPullRequestMergeRequest["comparison"],
) {
  try {
    const deleted = await refreshPostMergeRefs(reviewSession);
    const cleanupCandidates = await buildCleanupCandidates(
      reviewSession.repositoryRootPath,
      comparison,
      deleted,
      reviewSession.pullRequest.headSha,
    );
    return {
      cleanupCandidates,
      deletedRemoteRefs: deleted.map((ref) => ref.remoteRef),
      refsRefreshError: undefined,
    };
  } catch (error) {
    logDiffdiffError("github", "merged_ref_refresh_failed", error, {
      pullRequestNumber: reviewSession.pullRequest.number,
    });
    return {
      cleanupCandidates: [] as GitHubRefCleanupCandidate[],
      deletedRemoteRefs: [] as string[],
      refsRefreshError: error instanceof Error ? error.message : "Unable to refresh local refs.",
    };
  }
}

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
  mergedHeadSha = comparison.headSha,
): Promise<GitHubRefCleanupCandidate[]> {
  const cleanupCandidates: GitHubRefCleanupCandidate[] = [];

  for (const ref of deletedRemoteRefs) {
    if (!matchesDeletedRemoteRef(comparison, ref.remoteRef, ref.branchName)) {
      continue;
    }

    if (await hasRef(repositoryRootPath, `refs/heads/${ref.branchName}`)) {
      cleanupCandidates.push({
        expectedSha: (
          await runCommand("git", ["rev-parse", "--verify", `refs/heads/${ref.branchName}`], {
            cwd: repositoryRootPath,
          })
        ).trim(),
        mergedHeadSha,
        branchName: ref.branchName,
        kind: "local-branch",
        ref: ref.branchName,
      });
    }

    if (await hasRef(repositoryRootPath, `refs/remotes/${ref.remoteRef}`)) {
      cleanupCandidates.push({
        expectedSha: (
          await runCommand("git", ["rev-parse", "--verify", `refs/remotes/${ref.remoteRef}`], {
            cwd: repositoryRootPath,
          })
        ).trim(),
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

/** Revalidate at deletion time; compare-and-swap protects ref changes during cleanup. */
export async function removeSafeCleanupRef(
  repositoryRootPath: string,
  ref: GitHubRefCleanupCandidate,
): Promise<void> {
  const git = (...args: string[]) => runCommand("git", args, { cwd: repositoryRootPath });
  if (ref.expectedSha == null || !/^[a-f0-9]{40,64}$/u.test(ref.expectedSha))
    throw new Error(`Kept ${ref.ref}: missing verified branch tip.`);
  const name = `${ref.kind === "local-branch" ? "refs/heads/" : "refs/remotes/"}${ref.ref}`;
  await git("check-ref-format", name);
  const current = (await git("rev-parse", "--verify", name)).trim();
  if (current !== ref.expectedSha) throw new Error(`Kept ${ref.ref}: branch changed after merge.`);
  if (ref.kind === "local-branch") {
    const worktrees = await git("worktree", "list", "--porcelain");
    if (worktrees.split("\n").includes(`branch ${name}`))
      throw new Error(`Kept ${ref.ref}: checked out in a worktree.`);
    if (!ref.mergedHeadSha || !/^[a-f0-9]{40,64}$/u.test(ref.mergedHeadSha))
      throw new Error(`Kept ${ref.ref}: missing merged PR head.`);
    try {
      await git("merge-base", "--is-ancestor", current, ref.mergedHeadSha);
    } catch {
      throw new Error(`Kept ${ref.ref}: contains commits outside the merged PR head.`);
    }
  }
  // Never force-delete a branch with unverified commits, including squash merges.
  await git("update-ref", "-d", name, current);
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
