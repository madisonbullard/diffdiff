import type { GitHubAuthSession, ForgeRepository, GitRemote } from "./github.ts";
import type { BranchInfo, ReviewSession, ReviewWarning } from "./session.ts";
import type { StartupOptions } from "./startup.ts";

export interface GitHubApiClient {
  auth?: GitHubAuthSession;
  graphql<T = unknown>(query: string, parameters: Record<string, unknown>): Promise<T>;
  paginate(route: string, parameters: Record<string, unknown>): Promise<unknown[]>;
  request(route: string, parameters: Record<string, unknown>): Promise<unknown>;
}

export interface GitHubClientFactory {
  create(repository: ForgeRepository): Promise<GitHubApiClient | null>;
}

export interface RepositoryProvider {
  kind: string;
  detectRepository(startPath: string): Promise<RepositoryHandle | null>;
}

export interface RepositoryHandle {
  kind: string;
  rootPath: string;
  loadReviewSession(
    options: StartupOptions,
    forgeProviders: ForgeMetadataProvider[],
  ): Promise<ReviewSession>;
}

export interface ForgeMetadataProvider {
  kind: string;
  supports(remote: GitRemote): boolean;
  enrichBranches(input: ForgeBranchMetadataRequest): Promise<ForgeBranchMetadataResult>;
}

export interface ForgeBranchMetadataRequest {
  repositoryRoot: string;
  remote: GitRemote;
  branches: BranchInfo[];
}

export interface ForgeBranchMetadataResult {
  branches: BranchInfo[];
  warnings: ReviewWarning[];
}
