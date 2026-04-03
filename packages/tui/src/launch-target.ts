import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  GitHubPullRequestService,
  parseGitHubRemote,
  runCommand,
  type ForgeRepository,
  type StartupOptions,
} from "@diffdiff/core";
import type { LaunchOptions } from "./types.ts";

interface GitHubRemoteMatch {
  name: string;
  repository: ForgeRepository;
}

type PullRequestTarget =
  | {
      kind: "current-repo";
      pullRequestNumber: number;
    }
  | {
      kind: "repository";
      pullRequestNumber: number;
      repository: ForgeRepository;
    };

interface PromptInput {
  candidates: readonly string[];
  reason: "ambiguous" | "missing";
  repository: ForgeRepository;
  searchRoot: string;
}

interface ResolveLaunchTargetDependencies {
  cwd?: string;
  detectGitRepositoryRoot?: (startPath: string) => Promise<string | undefined>;
  gitHubPullRequestService?: {
    loadPullRequest: (
      repository: ForgeRepository,
      pullRequestNumber: number,
    ) => Promise<{
      baseRefName: string;
      headRefName: string;
    }>;
  };
  hasGitRef?: (rootPath: string, ref: string) => Promise<boolean>;
  listGitHubRemotes?: (rootPath: string) => Promise<GitHubRemoteMatch[]>;
  promptForRepositoryPath?: (input: PromptInput) => Promise<string | undefined>;
  searchRepositoryRoots?: (cwd: string, repoName: string) => Promise<string[]>;
}

const SKIPPED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

export async function resolveLaunchOptionsFromTarget(
  target: string | undefined,
  startupOptions: StartupOptions,
  dependencies: ResolveLaunchTargetDependencies = {},
): Promise<LaunchOptions> {
  const normalizedTarget = target?.trim();
  if (normalizedTarget == null || normalizedTarget === "") {
    return { ...startupOptions };
  }

  if (normalizedTarget.toLowerCase() === "pr") {
    return {
      ...startupOptions,
      initialListMode: "pull-requests",
    };
  }

  const pullRequestTarget = parsePullRequestTarget(normalizedTarget);
  if (pullRequestTarget == null) {
    return {
      ...startupOptions,
      repoPath: startupOptions.repoPath ?? normalizedTarget,
    };
  }

  const cwd = dependencies.cwd ?? process.cwd();
  const detectGitRepositoryRoot =
    dependencies.detectGitRepositoryRoot ?? defaultDetectGitRepositoryRoot;
  const listGitHubRemotes = dependencies.listGitHubRemotes ?? defaultListGitHubRemotes;
  const searchRepositoryRoots = dependencies.searchRepositoryRoots ?? defaultSearchRepositoryRoots;
  const promptForRepositoryPath =
    dependencies.promptForRepositoryPath ?? defaultPromptForRepositoryPath;
  const hasGitRef = dependencies.hasGitRef ?? defaultHasGitRef;
  const gitHubPullRequestService =
    dependencies.gitHubPullRequestService ?? new GitHubPullRequestService();
  const contextPath = startupOptions.repoPath ?? cwd;
  const contextRepositoryRoot = await detectGitRepositoryRoot(resolve(cwd, contextPath));
  const resolvedRepositoryRoot = await resolveTargetRepositoryRoot(
    pullRequestTarget,
    contextRepositoryRoot,
    cwd,
    detectGitRepositoryRoot,
    listGitHubRemotes,
    searchRepositoryRoots,
    promptForRepositoryPath,
  );
  const gitHubRemotes = await listGitHubRemotes(resolvedRepositoryRoot);
  const repository =
    pullRequestTarget.kind === "current-repo"
      ? selectPreferredGitHubRemote(gitHubRemotes)?.repository
      : pullRequestTarget.repository;

  if (repository == null) {
    throw new Error(
      `No GitHub remote was found for ${resolvedRepositoryRoot}. Pass a GitHub PR URL or owner/repo/number target.`,
    );
  }

  const remote =
    selectMatchingGitHubRemote(gitHubRemotes, repository) ??
    selectPreferredGitHubRemote(gitHubRemotes);
  if (remote == null) {
    throw new Error(
      `Repository at ${resolvedRepositoryRoot} does not have a GitHub remote for ${formatRepositoryLabel(repository)}.`,
    );
  }

  const pullRequest = await gitHubPullRequestService.loadPullRequest(
    repository,
    pullRequestTarget.pullRequestNumber,
  );
  const base = await resolvePullRequestRef(
    resolvedRepositoryRoot,
    remote.name,
    pullRequest.baseRefName,
    hasGitRef,
  );
  const head = await resolvePullRequestRef(
    resolvedRepositoryRoot,
    remote.name,
    pullRequest.headRefName,
    hasGitRef,
  );

  return {
    ...startupOptions,
    base,
    head,
    repoPath:
      contextRepositoryRoot != null &&
      resolve(contextRepositoryRoot) === resolve(resolvedRepositoryRoot)
        ? startupOptions.repoPath
        : resolvedRepositoryRoot,
  };
}

export function parsePullRequestTarget(target: string): PullRequestTarget | undefined {
  if (/^\d+$/u.test(target)) {
    return {
      kind: "current-repo",
      pullRequestNumber: Number.parseInt(target, 10),
    };
  }

  const githubUrl = parseGitHubPullRequestUrl(target);
  if (githubUrl != null) {
    return {
      kind: "repository",
      pullRequestNumber: githubUrl.pullRequestNumber,
      repository: githubUrl.repository,
    };
  }

  const shorthandMatch = /^(?:@)?([^/]+)\/([^/]+)\/(\d+)$/u.exec(target);
  if (shorthandMatch == null) {
    return undefined;
  }

  return {
    kind: "repository",
    pullRequestNumber: Number.parseInt(shorthandMatch[3]!, 10),
    repository: {
      forge: "github",
      host: "github.com",
      owner: shorthandMatch[1]!,
      repo: shorthandMatch[2]!,
    },
  };
}

async function resolveTargetRepositoryRoot(
  target: PullRequestTarget,
  contextRepositoryRoot: string | undefined,
  cwd: string,
  detectGitRepositoryRoot: (startPath: string) => Promise<string | undefined>,
  listGitHubRemotes: (rootPath: string) => Promise<GitHubRemoteMatch[]>,
  searchRepositoryRoots: (cwd: string, repoName: string) => Promise<string[]>,
  promptForRepositoryPath: (input: PromptInput) => Promise<string | undefined>,
): Promise<string> {
  if (target.kind === "current-repo") {
    if (contextRepositoryRoot == null) {
      throw new Error(
        "Current directory is not inside a git repository. Pass --repo <path> first.",
      );
    }

    return contextRepositoryRoot;
  }

  if (contextRepositoryRoot != null) {
    const contextRemotes = await listGitHubRemotes(contextRepositoryRoot);
    if (selectMatchingGitHubRemote(contextRemotes, target.repository) != null) {
      return contextRepositoryRoot;
    }
  }

  const matchedRoots = await findMatchingRepositoryRoots(
    searchRepositoryRoots,
    listGitHubRemotes,
    cwd,
    target.repository,
  );
  if (matchedRoots.length === 1) {
    return matchedRoots[0]!;
  }

  const promptedPath = await promptForRepositoryPath({
    candidates: matchedRoots,
    reason: matchedRoots.length === 0 ? "missing" : "ambiguous",
    repository: target.repository,
    searchRoot: cwd,
  });
  if (promptedPath == null) {
    throw new Error(
      `No repository path was provided for ${formatRepositoryLabel(target.repository)}. Re-run with --repo <path>.`,
    );
  }

  const promptedRoot = await detectGitRepositoryRoot(promptedPath);
  if (promptedRoot == null) {
    throw new Error(`No git repository was found at ${promptedPath}.`);
  }

  const promptedRemotes = await listGitHubRemotes(promptedRoot);
  if (selectMatchingGitHubRemote(promptedRemotes, target.repository) == null) {
    throw new Error(
      `Repository at ${promptedRoot} does not match ${formatRepositoryLabel(target.repository)}.`,
    );
  }

  return promptedRoot;
}

async function findMatchingRepositoryRoots(
  searchRepositoryRoots: (cwd: string, repoName: string) => Promise<string[]>,
  listGitHubRemotes: (rootPath: string) => Promise<GitHubRemoteMatch[]>,
  cwd: string,
  repository: ForgeRepository,
): Promise<string[]> {
  const candidateRoots = await searchRepositoryRoots(cwd, repository.repo);
  const matches: string[] = [];

  for (const candidateRoot of candidateRoots) {
    const gitHubRemotes = await listGitHubRemotes(candidateRoot);
    if (selectMatchingGitHubRemote(gitHubRemotes, repository) != null) {
      matches.push(candidateRoot);
    }
  }

  return matches;
}

async function resolvePullRequestRef(
  repositoryRoot: string,
  remoteName: string,
  refName: string,
  hasGitRef: (rootPath: string, ref: string) => Promise<boolean>,
): Promise<string> {
  const remoteTrackingRef = `${remoteName}/${refName}`;
  if (await hasGitRef(repositoryRoot, remoteTrackingRef)) {
    return remoteTrackingRef;
  }

  if (await hasGitRef(repositoryRoot, refName)) {
    return refName;
  }

  return refName;
}

function parseGitHubPullRequestUrl(target: string):
  | {
      pullRequestNumber: number;
      repository: ForgeRepository;
    }
  | undefined {
  let url: URL;

  try {
    url = new URL(target);
  } catch {
    return undefined;
  }

  const host = normalizeGitHubHost(url.hostname);
  if (host !== "github.com") {
    return undefined;
  }

  const match = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/u.exec(url.pathname);
  if (match == null) {
    return undefined;
  }

  return {
    pullRequestNumber: Number.parseInt(match[3]!, 10),
    repository: {
      forge: "github",
      host: "github.com",
      owner: match[1]!,
      repo: match[2]!,
    },
  };
}

function selectMatchingGitHubRemote(
  remotes: readonly GitHubRemoteMatch[],
  repository: ForgeRepository,
): GitHubRemoteMatch | undefined {
  return remotes.find((remote) => repositoriesMatch(remote.repository, repository));
}

function selectPreferredGitHubRemote(
  remotes: readonly GitHubRemoteMatch[],
): GitHubRemoteMatch | undefined {
  return remotes.find((remote) => remote.name === "origin") ?? remotes[0];
}

function repositoriesMatch(left: ForgeRepository, right: ForgeRepository): boolean {
  return (
    normalizeGitHubHost(left.host) === normalizeGitHubHost(right.host) &&
    left.owner.toLowerCase() === right.owner.toLowerCase() &&
    left.repo.toLowerCase() === right.repo.toLowerCase()
  );
}

function normalizeGitHubHost(host: string): string {
  return host.toLowerCase().replace(/^www\./u, "");
}

function formatRepositoryLabel(repository: ForgeRepository): string {
  return `${repository.owner}/${repository.repo}`;
}

async function defaultDetectGitRepositoryRoot(startPath: string): Promise<string | undefined> {
  try {
    return (
      await runCommand("git", ["rev-parse", "--show-toplevel"], {
        cwd: startPath,
      })
    ).trim();
  } catch {
    return undefined;
  }
}

async function defaultHasGitRef(rootPath: string, ref: string): Promise<boolean> {
  try {
    await runCommand("git", ["rev-parse", "--verify", ref], { cwd: rootPath });
    return true;
  } catch {
    return false;
  }
}

async function defaultListGitHubRemotes(rootPath: string): Promise<GitHubRemoteMatch[]> {
  const stdout = await runCommand("git", ["remote"], { cwd: rootPath });
  const remoteNames = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const gitHubRemotes: GitHubRemoteMatch[] = [];

  for (const remoteName of remoteNames) {
    const fetchUrl = (
      await runCommand("git", ["remote", "get-url", remoteName], { cwd: rootPath })
    ).trim();
    const repository = parseGitHubRemote(fetchUrl);
    if (repository != null) {
      gitHubRemotes.push({
        name: remoteName,
        repository,
      });
    }
  }

  return gitHubRemotes;
}

async function defaultSearchRepositoryRoots(cwd: string, repoName: string): Promise<string[]> {
  const roots = new Set<string>();
  const pendingDirectories = [resolve(cwd)];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop()!;
    let entries: Dirent[];

    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }

      const entryPath = resolve(currentDirectory, entry.name);
      if (entry.name === repoName) {
        const repositoryRoot = await defaultDetectGitRepositoryRoot(entryPath);
        if (repositoryRoot != null && resolve(repositoryRoot) === entryPath) {
          roots.add(repositoryRoot);
        }
      }

      pendingDirectories.push(entryPath);
    }
  }

  return [...roots];
}

async function defaultPromptForRepositoryPath(input: PromptInput): Promise<string | undefined> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return undefined;
  }

  const prompt =
    input.reason === "ambiguous"
      ? [
          `Found multiple local repositories for ${formatRepositoryLabel(input.repository)}:`,
          ...input.candidates.map((candidate) => `  ${candidate}`),
          "Enter the path to the repo to review (leave blank to cancel): ",
        ].join("\n")
      : `Could not find ${formatRepositoryLabel(input.repository)} under ${input.searchRoot}. Enter the path to the repo to review (leave blank to cancel): `;
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (await readline.question(prompt)).trim();
    if (answer === "") {
      return undefined;
    }

    return isAbsolute(answer) ? answer : resolve(input.searchRoot, answer);
  } finally {
    readline.close();
  }
}
