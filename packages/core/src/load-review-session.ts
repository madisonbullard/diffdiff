import { GitRepositoryProvider, getRepositorySearchPath } from "./git.ts";
import { GitHubMetadataProvider, GitHubPullRequestService } from "./github.ts";
import { DiffdiffError } from "./errors.ts";
import type {
  ForgeMetadataProvider,
  RepositoryProvider,
  ReviewSession,
  StartupOptions,
} from "./types.ts";

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
  const searchPath = getRepositorySearchPath(options.repoPath);

  for (const repositoryProvider of repositoryProviders) {
    const repository = await repositoryProvider.detectRepository(searchPath);
    if (repository == null) {
      continue;
    }

    const session = await repository.loadReviewSession(options, [...forgeProviders]);
    return githubPullRequestService.attachReviewSession(session);
  }

  throw new DiffdiffError(`No supported repository found from ${searchPath}.`);
}
