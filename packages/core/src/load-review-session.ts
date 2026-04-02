import { GitHubMetadataProvider } from "./github/index.ts";
import { GitHubPullRequestService } from "./github/pull-request-service.ts";
import { GitRepositoryProvider } from "./repository/git-repository.ts";
import { getRepositorySearchPath } from "./repository/path.ts";
import { DiffdiffError } from "./errors.ts";
import { logDiffdiffError, logDiffdiffInfo } from "./logging.ts";
import type { ForgeMetadataProvider, RepositoryProvider } from "./types/providers.ts";
import type { ReviewSession } from "./types/session.ts";
import type { StartupOptions } from "./types/startup.ts";

const DEFAULT_REPOSITORY_PROVIDERS: readonly RepositoryProvider[] = [new GitRepositoryProvider()];
const DEFAULT_GITHUB_PULL_REQUEST_SERVICE = new GitHubPullRequestService();
const DEFAULT_FORGE_PROVIDERS: readonly ForgeMetadataProvider[] = [
  new GitHubMetadataProvider(DEFAULT_GITHUB_PULL_REQUEST_SERVICE),
];

export async function loadReviewSession(
  options: StartupOptions = {},
  repositoryProviders: readonly RepositoryProvider[] = DEFAULT_REPOSITORY_PROVIDERS,
  forgeProviders: readonly ForgeMetadataProvider[] = DEFAULT_FORGE_PROVIDERS,
  githubPullRequestService: GitHubPullRequestService = DEFAULT_GITHUB_PULL_REQUEST_SERVICE,
): Promise<ReviewSession> {
  const startedAt = Date.now();
  const searchPath = getRepositorySearchPath(options.repoPath);
  logDiffdiffInfo("session", "review_session_load_started", {
    options,
    searchPath,
  });

  for (const repositoryProvider of repositoryProviders) {
    const repository = await repositoryProvider.detectRepository(searchPath);
    if (repository == null) {
      continue;
    }

    const session = await repository.loadReviewSession(options, [...forgeProviders]);
    const reviewSession = await githubPullRequestService.attachReviewSession(session);

    logDiffdiffInfo("session", "review_session_load_completed", {
      comparison: reviewSession.comparison,
      durationMs: Date.now() - startedAt,
      fileCount: reviewSession.files.length,
      hasGitHubReview: reviewSession.github != null,
      repository: {
        kind: reviewSession.repository.kind,
        name: reviewSession.repository.name,
        rootPath: reviewSession.repository.rootPath,
      },
      warningCount: reviewSession.warnings.length,
    });

    return reviewSession;
  }

  const error = new DiffdiffError(`No supported repository found from ${searchPath}.`);
  logDiffdiffError("session", "review_session_load_failed", error, {
    durationMs: Date.now() - startedAt,
    options,
    searchPath,
  });
  throw error;
}
