import type {
  BranchInfo,
  ForgeBranchMetadataRequest,
  ForgeBranchMetadataResult,
  ForgeMetadataProvider,
  ForgeRepository,
  GitRemote,
  PullRequestInfo,
} from "./types.ts";
import { clearGitHubToken, resolveGitHubAuth, storeGitHubToken } from "./github/auth.ts";
import { OctokitGitHubClientFactory } from "./github/client.ts";
import { getGitHubAuthConfigPaths } from "./github/config.ts";
import { GitHubPullRequestService } from "./github/pull-requests.ts";
import {
  getDefaultDiffdiffPreferences,
  getDefaultGitHubPreferences,
  getDiffdiffPreferencesFilePath,
  loadDiffdiffPreferences,
  saveDiffdiffPreferences,
} from "./preferences.ts";

export class GitHubMetadataProvider implements ForgeMetadataProvider {
  readonly kind = "github";

  constructor(
    private readonly pullRequestService: Pick<
      GitHubPullRequestService,
      "listOpenPullRequests"
    > = new GitHubPullRequestService(),
  ) {}

  supports(remote: GitRemote): boolean {
    return remote.forge?.forge === this.kind;
  }

  async enrichBranches(input: ForgeBranchMetadataRequest): Promise<ForgeBranchMetadataResult> {
    if (input.remote.forge == null) {
      return { branches: input.branches, warnings: [] };
    }

    const pullRequests = await this.loadOpenPullRequests(input.remote.forge);
    if (pullRequests == null) {
      return {
        branches: input.branches,
        warnings: [
          {
            code: "github-metadata-unavailable",
            message: `Unable to load GitHub pull requests for ${input.remote.name}; remote branches will still be shown.`,
          },
        ],
      };
    }

    const pullRequestByHeadRef = new Map(
      pullRequests.map((pullRequest) => [pullRequest.headRefName, pullRequest]),
    );
    const branches = input.branches.map((branch) => {
      const shortName = branch.name.slice(branch.remoteName!.length + 1);
      const pullRequest = pullRequestByHeadRef.get(shortName);

      return pullRequest == null ? branch : { ...branch, pullRequest };
    });

    return { branches, warnings: [] };
  }

  private async loadOpenPullRequests(repo: ForgeRepository): Promise<PullRequestInfo[] | null> {
    return this.pullRequestService.listOpenPullRequests(repo);
  }
}

export function parseGitHubRemote(url: string): ForgeRepository | undefined {
  const httpsMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/u.exec(url);
  if (httpsMatch != null) {
    return {
      forge: "github",
      owner: httpsMatch[1],
      repo: httpsMatch[2],
      host: "github.com",
    };
  }

  const sshMatch = /^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/u.exec(url);
  if (sshMatch != null) {
    return {
      forge: "github",
      owner: sshMatch[1],
      repo: sshMatch[2],
      host: "github.com",
    };
  }

  return undefined;
}

export function prioritizeRemoteBranches(branches: BranchInfo[]): BranchInfo[] {
  return [...branches].sort((left, right) => {
    if (left.pullRequest != null && right.pullRequest == null) {
      return -1;
    }

    if (left.pullRequest == null && right.pullRequest != null) {
      return 1;
    }

    if (left.remoteName !== right.remoteName) {
      return left.remoteName!.localeCompare(right.remoteName!);
    }

    return left.name.localeCompare(right.name);
  });
}

export {
  clearGitHubToken,
  getGitHubAuthConfigPaths,
  GitHubPullRequestService,
  OctokitGitHubClientFactory,
  resolveGitHubAuth,
  getDefaultDiffdiffPreferences,
  getDefaultGitHubPreferences,
  getDiffdiffPreferencesFilePath,
  loadDiffdiffPreferences,
  saveDiffdiffPreferences,
  storeGitHubToken,
};
