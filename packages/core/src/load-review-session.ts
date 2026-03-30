import { GitRepositoryProvider, getRepositorySearchPath } from "./git.ts";
import { GitHubMetadataProvider } from "./github.ts";
import { DiffdiffError } from "./errors.ts";
import type {
  ForgeMetadataProvider,
  RepositoryProvider,
  ReviewSession,
  StartupOptions,
} from "./types.ts";

const DEFAULT_REPOSITORY_PROVIDERS: readonly RepositoryProvider[] = [new GitRepositoryProvider()];
const DEFAULT_FORGE_PROVIDERS: readonly ForgeMetadataProvider[] = [new GitHubMetadataProvider()];

export async function loadReviewSession(
  options: StartupOptions = {},
  repositoryProviders: readonly RepositoryProvider[] = DEFAULT_REPOSITORY_PROVIDERS,
  forgeProviders: readonly ForgeMetadataProvider[] = DEFAULT_FORGE_PROVIDERS,
): Promise<ReviewSession> {
  const searchPath = getRepositorySearchPath(options.repoPath);

  for (const repositoryProvider of repositoryProviders) {
    const repository = await repositoryProvider.detectRepository(searchPath);
    if (repository == null) {
      continue;
    }

    return repository.loadReviewSession(options, [...forgeProviders]);
  }

  throw new DiffdiffError(`No supported repository found from ${searchPath}.`);
}
