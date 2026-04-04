import type { ForgeRepository, GitRemote, GitHubDashboardPullRequest } from "../types/github.ts";

export function normalizeGitHubHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/^api\./u, "")
    .replace(/^www\./u, "");
}

export function getRepositoryIdentityKey(repository: ForgeRepository): string {
  return [
    repository.forge.toLowerCase(),
    normalizeRepositoryHost(repository),
    repository.owner.toLowerCase(),
    repository.repo.toLowerCase(),
  ].join(":");
}

export function repositoriesMatch(left: ForgeRepository, right: ForgeRepository): boolean {
  return getRepositoryIdentityKey(left) === getRepositoryIdentityKey(right);
}

export function formatRepositoryLabel(repository: ForgeRepository): string {
  return `${repository.owner}/${repository.repo}`;
}

export function selectCurrentForgeRepository(
  remotes: readonly GitRemote[],
): ForgeRepository | undefined {
  return (
    remotes.find((remote) => remote.name === "origin")?.forge ??
    remotes.find((remote) => remote.forge != null)?.forge
  );
}

export function sortDashboardPullRequests(
  pullRequests: readonly GitHubDashboardPullRequest[],
  currentRepository?: ForgeRepository,
): GitHubDashboardPullRequest[] {
  return [...pullRequests].sort((left, right) =>
    compareDashboardPullRequests(left, right, currentRepository),
  );
}

function compareDashboardPullRequests(
  left: GitHubDashboardPullRequest,
  right: GitHubDashboardPullRequest,
  currentRepository?: ForgeRepository,
): number {
  if (currentRepository != null) {
    const leftIsCurrentRepository = repositoriesMatch(left.repository, currentRepository);
    const rightIsCurrentRepository = repositoriesMatch(right.repository, currentRepository);
    if (leftIsCurrentRepository !== rightIsCurrentRepository) {
      return leftIsCurrentRepository ? -1 : 1;
    }
  }

  if (left.isReviewRequested !== right.isReviewRequested) {
    return left.isReviewRequested ? -1 : 1;
  }

  const updatedResult = right.updatedAt.localeCompare(left.updatedAt);
  if (updatedResult !== 0) {
    return updatedResult;
  }

  const repoResult = formatRepositoryLabel(left.repository).localeCompare(
    formatRepositoryLabel(right.repository),
  );
  if (repoResult !== 0) {
    return repoResult;
  }

  return left.number - right.number;
}

function normalizeRepositoryHost(repository: ForgeRepository): string {
  if (repository.forge === "github") {
    return normalizeGitHubHost(repository.host);
  }

  return repository.host.toLowerCase();
}
