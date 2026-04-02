import { Octokit } from "octokit";
import type { ForgeRepository, GitHubAuthSession } from "../types/github.ts";
import type { GitHubApiClient, GitHubClientFactory } from "../types/providers.ts";
import { logDiffdiffError, logDiffdiffInfo, logDiffdiffVerbose } from "../logging.ts";
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

    logDiffdiffInfo("github", "github_client_created", {
      authenticated: auth != null,
      host: repository.host,
      owner: repository.owner,
      repo: repository.repo,
      tokenSource: auth?.tokenSource,
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
    const startedAt = Date.now();
    logDiffdiffVerbose("github", "graphql_request_started", {
      parameters,
      query,
    });

    try {
      const response = (await (
        this.octokit as unknown as {
          graphql<Result>(query: string, parameters: Record<string, unknown>): Promise<Result>;
        }
      ).graphql<T>(query, parameters)) as T;

      logDiffdiffInfo("github", "graphql_request_completed", {
        durationMs: Date.now() - startedAt,
        parameters,
        query,
        response: summarizeGitHubPayload(response),
      });
      logDiffdiffVerbose("github", "graphql_request_response", {
        durationMs: Date.now() - startedAt,
        parameters,
        query,
        response,
      });

      return response;
    } catch (error) {
      logDiffdiffError("github", "graphql_request_failed", error, {
        durationMs: Date.now() - startedAt,
        parameters,
        query,
      });
      throw error;
    }
  }

  async paginate(route: string, parameters: Record<string, unknown>): Promise<unknown[]> {
    const startedAt = Date.now();
    logDiffdiffVerbose("github", "rest_paginate_started", {
      parameters,
      route,
    });

    try {
      const response = (await (
        this.octokit as unknown as {
          paginate(route: string, parameters: Record<string, unknown>): Promise<unknown[]>;
        }
      ).paginate(route, parameters)) as unknown[];

      logDiffdiffInfo("github", "rest_paginate_completed", {
        durationMs: Date.now() - startedAt,
        parameters,
        response: summarizeGitHubPayload(response),
        route,
      });
      logDiffdiffVerbose("github", "rest_paginate_response", {
        durationMs: Date.now() - startedAt,
        parameters,
        response,
        route,
      });

      return response;
    } catch (error) {
      logDiffdiffError("github", "rest_paginate_failed", error, {
        durationMs: Date.now() - startedAt,
        parameters,
        route,
      });
      throw error;
    }
  }

  async request(route: string, parameters: Record<string, unknown>): Promise<unknown> {
    const startedAt = Date.now();
    logDiffdiffVerbose("github", "rest_request_started", {
      parameters,
      route,
    });

    try {
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

      logDiffdiffInfo("github", "rest_request_completed", {
        durationMs: Date.now() - startedAt,
        parameters,
        response: summarizeGitHubPayload(response.data),
        route,
      });
      logDiffdiffVerbose("github", "rest_request_response", {
        durationMs: Date.now() - startedAt,
        parameters,
        response: response.data,
        route,
      });

      return response.data as unknown;
    } catch (error) {
      logDiffdiffError("github", "rest_request_failed", error, {
        durationMs: Date.now() - startedAt,
        parameters,
        route,
      });
      throw error;
    }
  }
}

function summarizeGitHubPayload(payload: unknown): {
  itemCount?: number;
  keys?: string[];
  type: string;
} {
  if (Array.isArray(payload)) {
    return {
      itemCount: payload.length,
      type: "array",
    };
  }

  if (payload == null) {
    return {
      type: "null",
    };
  }

  if (typeof payload === "object") {
    return {
      keys: Object.keys(payload as Record<string, unknown>).slice(0, 12),
      type: "object",
    };
  }

  return {
    type: typeof payload,
  };
}
