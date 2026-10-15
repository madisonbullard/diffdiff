import type { GitHubMergeMethod, GitHubPullRequestDetail } from "@madisonbullard/diffdiff-core";
/** Shared by rendering, confirmation, and final submission; never trust UI state alone. */
export function canSubmitMerge(
  pr: GitHubPullRequestDetail,
  method: GitHubMergeMethod | null | undefined,
  auto: boolean,
): boolean {
  if (
    method == null ||
    !pr.merge.allowedMethods?.includes(method) ||
    pr.isDraft ||
    pr.isMerged ||
    pr.state !== "open"
  )
    return false;
  return auto
    ? pr.merge.autoMergeAllowed === true && !pr.merge.autoMergeEnabled
    : pr.merge.canMerge;
}
