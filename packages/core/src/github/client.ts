import { Octokit } from "octokit";
import type {
  ForgeRepository,
  GitHubApiClient,
  GitHubAuthSession,
  GitHubClientFactory,
} from "../types.ts";
import { resolveGitHubAuth } from "./auth.ts";

export class OctokitGitHubClientFactory implements GitHubClientFactory {
  async create(repository: ForgeRepository): Promise<GitHubApiClient | null> {
    if (repository.forge !== "github") {
      return null;
    }

    const auth = await resolveGitHubAuth({ host: repository.host });
    const octokit = new Octokit({
      auth: auth?.token,
      userAgent: "diffdiff",
    });

    return new OctokitGitHubApiClient(octokit, auth);
  }
}

class OctokitGitHubApiClient implements GitHubApiClient {
  constructor(
    private readonly octokit: Octokit,
    readonly auth: GitHubAuthSession | undefined,
  ) {}

  async graphql<T = unknown>(query: string, parameters: Record<string, unknown>): Promise<T> {
    return (await (
      this.octokit as unknown as {
        graphql<Result>(query: string, parameters: Record<string, unknown>): Promise<Result>;
      }
    ).graphql<T>(query, parameters)) as T;
  }

  async paginate(route: string, parameters: Record<string, unknown>): Promise<unknown[]> {
    return (await (
      this.octokit as unknown as {
        paginate(route: string, parameters: Record<string, unknown>): Promise<unknown[]>;
      }
    ).paginate(route, parameters)) as unknown[];
  }

  async request(route: string, parameters: Record<string, unknown>): Promise<unknown> {
    const response = await (
      this.octokit as unknown as {
        request(
          route: string,
          parameters: Record<string, unknown>,
        ): Promise<{
          data: unknown;
        }>;
      }
    ).request(route, parameters);
    return response.data as unknown;
  }
}
