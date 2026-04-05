import type { ChangedFile } from "../types/session.ts";
import type {
  GitHubPullRequestChangedFilesByPath,
  GitHubPullRequestFileViewedState,
} from "../types/github.ts";

export function isGitHubFileViewed(
  viewedState: GitHubPullRequestFileViewedState | undefined,
): boolean {
  return viewedState === "VIEWED";
}

export function getReviewedPathsFromGitHubViewedState(
  files: readonly Pick<ChangedFile, "path">[],
  changedFilesByPath: GitHubPullRequestChangedFilesByPath,
): Set<string> {
  return new Set(
    files.flatMap((file) =>
      isGitHubFileViewed(changedFilesByPath[file.path]?.viewedState) ? [file.path] : [],
    ),
  );
}
