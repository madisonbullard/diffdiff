import type {
  GitHubPullRequestMergeResult,
  GitHubReviewSession,
} from "@madisonbullard/diffdiff-core";
import type { DiffdiffAppProps } from "../state/app-props.ts";
/** Uses the initiating PR snapshot even when the user has changed dialogs or repositories. */
export async function cleanMergedRefs(
  result: GitHubPullRequestMergeResult,
  session: GitHubReviewSession,
  remove: DiffdiffAppProps["removeCleanupRefs"],
): Promise<string> {
  const head = session.pullRequest.headRefName;
  if (
    result.autoMergeEnabled ||
    result.refsRefreshError ||
    !result.deletedRemoteRefs.includes(`${session.remoteName}/${head}`)
  )
    return "";
  let removed = 0;
  const kept: string[] = [];
  for (const candidate of result.cleanupCandidates.filter(
    (candidate) => candidate.branchName === head,
  )) {
    try {
      if (!remove) throw new Error("Cleanup unavailable");
      await remove(session.repositoryRootPath, [candidate]);
      removed += 1;
    } catch {
      kept.push(candidate.ref);
    }
  }
  return ` ${removed} refs removed.${kept.length ? ` Kept ${kept.join(", ")}: unsafe or unavailable to delete.` : ""}`;
}
