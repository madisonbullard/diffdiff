import { runCommand } from "../command.ts";
import { DiffdiffError } from "../errors.ts";
import type {
  ForgeRepository,
  GitHubDashboardPullRequest,
  GitHubPullRequestDetail,
} from "../types/github.ts";
import type { ReviewSession, ReviewWarning } from "../types/session.ts";
import { mapActor } from "./pull-request-mappers.ts";
import type { GitHubSearchIssuePullRequestResponse } from "./pull-request-types.ts";

export function upsertDashboardPullRequest(
  pullRequestsByKey: Map<string, GitHubDashboardPullRequest>,
  pullRequest: GitHubSearchIssuePullRequestResponse,
  hostFallback: string,
  flags: {
    isAuthor: boolean;
    isReviewRequested: boolean;
  },
): void {
  const repository = parseSearchResultRepository(pullRequest.repository_url, hostFallback);
  const key = `${repository.host}/${repository.owner}/${repository.repo}#${pullRequest.number}`;
  const existingPullRequest = pullRequestsByKey.get(key);

  if (existingPullRequest == null) {
    pullRequestsByKey.set(key, {
      author: mapActor(pullRequest.user),
      isAuthor: flags.isAuthor,
      isDraft: pullRequest.draft === true,
      isReviewRequested: flags.isReviewRequested,
      number: pullRequest.number,
      repository,
      title: pullRequest.title,
      updatedAt: pullRequest.updated_at,
      url: pullRequest.html_url,
    });
    return;
  }

  pullRequestsByKey.set(key, {
    ...existingPullRequest,
    isAuthor: existingPullRequest.isAuthor || flags.isAuthor,
    isDraft: existingPullRequest.isDraft || pullRequest.draft === true,
    isReviewRequested: existingPullRequest.isReviewRequested || flags.isReviewRequested,
    updatedAt:
      pullRequest.updated_at.localeCompare(existingPullRequest.updatedAt) > 0
        ? pullRequest.updated_at
        : existingPullRequest.updatedAt,
  });
}

export async function buildPullRequestWarnings(
  session: ReviewSession,
  pullRequest: GitHubPullRequestDetail,
  remoteName: string,
): Promise<ReviewWarning[]> {
  const warnings: ReviewWarning[] = [];
  const comparisonBaseMatches =
    session.comparison.base === pullRequest.baseRefName ||
    session.comparison.base.endsWith(`/${pullRequest.baseRefName}`);

  if (!comparisonBaseMatches) {
    warnings.push({
      code: "github-pr-base-mismatch",
      message: `Current comparison base (${session.comparison.base}) does not match the PR base (${pullRequest.baseRefName}); inline anchors may not line up exactly.`,
    });
  }

  const [hasLocalBaseRef, hasLocalHeadRef] = await Promise.all([
    hasRemoteTrackingRef(session.repository.rootPath, remoteName, pullRequest.baseRefName),
    hasRemoteTrackingRef(session.repository.rootPath, remoteName, pullRequest.headRefName),
  ]);

  if (!hasLocalBaseRef) {
    warnings.push({
      code: "github-pr-base-local-ref-missing",
      message: `PR base ref refs/remotes/${remoteName}/${pullRequest.baseRefName} is not available locally, so diffdiff cannot build the exact PR comparison from local refs only.`,
    });
  }

  if (!hasLocalHeadRef) {
    warnings.push({
      code: "github-pr-head-local-ref-missing",
      message: `PR head ref refs/remotes/${remoteName}/${pullRequest.headRefName} is not available locally, so diffdiff cannot build the exact PR comparison from local refs only.`,
    });
  }

  if (!hasLocalBaseRef || !hasLocalHeadRef) {
    warnings.push({
      code: "github-inline-anchoring-unavailable",
      message:
        "Inline comment anchoring is unavailable because diffdiff cannot build the exact PR comparison from local refs only.",
    });
  }

  return warnings;
}

function parseSearchResultRepository(repositoryUrl: string, hostFallback: string): ForgeRepository {
  let url: URL;

  try {
    url = new URL(repositoryUrl);
  } catch {
    throw new DiffdiffError(`Unable to parse GitHub repository URL: ${repositoryUrl}`);
  }

  const match = /^\/repos\/([^/]+)\/([^/]+)$/u.exec(url.pathname);
  if (match == null) {
    throw new DiffdiffError(`Unable to parse GitHub repository URL: ${repositoryUrl}`);
  }

  return {
    forge: "github",
    // Search results return API URLs like api.github.com, but the rest of diffdiff
    // uses the forge host from git remotes (for example github.com).
    host: hostFallback,
    owner: match[1]!,
    repo: match[2]!,
  };
}

async function hasRemoteTrackingRef(
  repositoryRootPath: string,
  remoteName: string,
  branchName: string,
): Promise<boolean> {
  try {
    await runCommand("git", ["rev-parse", "--verify", `refs/remotes/${remoteName}/${branchName}`], {
      cwd: repositoryRootPath,
    });
    return true;
  } catch {
    return false;
  }
}
