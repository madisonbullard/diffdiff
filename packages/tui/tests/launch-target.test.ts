import { describe, expect, test, vi } from "vite-plus/test";
import { parsePullRequestTarget, resolveLaunchOptionsFromTarget } from "../src/launch-target.ts";

describe("parsePullRequestTarget", () => {
  test("parses GitHub PR URLs", () => {
    expect(parsePullRequestTarget("http://github.com/diffdiff/diffdiff/pull/42")).toEqual({
      kind: "repository",
      pullRequestNumber: 42,
      repository: {
        forge: "github",
        host: "github.com",
        owner: "diffdiff",
        repo: "diffdiff",
      },
    });
  });

  test("parses owner/repo shorthand with an @ prefix", () => {
    expect(parsePullRequestTarget("@diffdiff/diffdiff/42")).toEqual({
      kind: "repository",
      pullRequestNumber: 42,
      repository: {
        forge: "github",
        host: "github.com",
        owner: "diffdiff",
        repo: "diffdiff",
      },
    });
  });

  test("parses a bare PR number for the current repo", () => {
    expect(parsePullRequestTarget("42")).toEqual({
      kind: "current-repo",
      pullRequestNumber: 42,
    });
  });
});

describe("resolveLaunchOptionsFromTarget", () => {
  test("opens the PR list when launched with pr", async () => {
    const options = await resolveLaunchOptionsFromTarget("pr", { verbose: true });

    expect(options).toEqual({
      initialListMode: "pull-requests",
      verbose: true,
    });
  });

  test("uses the current repo when the PR target matches a current remote", async () => {
    const gitHubPullRequestService = {
      loadPullRequest: vi.fn(async () => ({
        baseRefName: "main",
        headRefName: "feature/ui",
      })),
    };

    const options = await resolveLaunchOptionsFromTarget(
      "diffdiff/diffdiff/42",
      {},
      {
        cwd: "/workspace/diffdiff",
        detectGitRepositoryRoot: vi.fn(async () => "/workspace/diffdiff"),
        gitHubPullRequestService,
        hasGitRef: vi.fn(async (_rootPath, ref) => ref.startsWith("origin/")),
        listGitHubRemotes: vi.fn(async () => [
          {
            name: "origin",
            repository: {
              forge: "github",
              host: "github.com",
              owner: "diffdiff",
              repo: "diffdiff",
            },
          },
        ]),
      },
    );

    expect(options).toEqual({
      base: "origin/main",
      head: "origin/feature/ui",
      repoPath: undefined,
    });
    expect(gitHubPullRequestService.loadPullRequest).toHaveBeenCalledWith(
      {
        forge: "github",
        host: "github.com",
        owner: "diffdiff",
        repo: "diffdiff",
      },
      42,
    );
  });

  test("searches the current directory for a matching repo when the current repo does not match", async () => {
    const options = await resolveLaunchOptionsFromTarget(
      "other-org/other-repo/17",
      {},
      {
        cwd: "/workspace",
        detectGitRepositoryRoot: vi.fn(async (startPath: string) => {
          if (startPath === "/workspace") {
            return "/workspace/diffdiff";
          }

          if (startPath === "/workspace/other-repo") {
            return "/workspace/other-repo";
          }

          return undefined;
        }),
        gitHubPullRequestService: {
          loadPullRequest: vi.fn(async () => ({
            baseRefName: "main",
            headRefName: "feature/other",
          })),
        },
        hasGitRef: vi.fn(
          async (_rootPath, ref) => ref === "origin/main" || ref === "feature/other",
        ),
        listGitHubRemotes: vi.fn(async (rootPath: string) => {
          if (rootPath === "/workspace/other-repo") {
            return [
              {
                name: "origin",
                repository: {
                  forge: "github",
                  host: "github.com",
                  owner: "other-org",
                  repo: "other-repo",
                },
              },
            ];
          }

          return [
            {
              name: "origin",
              repository: {
                forge: "github",
                host: "github.com",
                owner: "diffdiff",
                repo: "diffdiff",
              },
            },
          ];
        }),
        searchRepositoryRoots: vi.fn(async () => ["/workspace/other-repo"]),
      },
    );

    expect(options).toEqual({
      base: "origin/main",
      head: "feature/other",
      repoPath: "/workspace/other-repo",
    });
  });

  test("prompts for a repo path when no matching local repo is found", async () => {
    const promptForRepositoryPath = vi.fn(async () => "/manual/other-repo");

    const options = await resolveLaunchOptionsFromTarget(
      "other-org/other-repo/17",
      {},
      {
        cwd: "/workspace",
        detectGitRepositoryRoot: vi.fn(async (startPath: string) => {
          if (startPath === "/workspace") {
            return "/workspace/diffdiff";
          }

          if (startPath === "/manual/other-repo") {
            return "/manual/other-repo";
          }

          return undefined;
        }),
        gitHubPullRequestService: {
          loadPullRequest: vi.fn(async () => ({
            baseRefName: "main",
            headRefName: "feature/other",
          })),
        },
        hasGitRef: vi.fn(async () => false),
        listGitHubRemotes: vi.fn(async (rootPath: string) => {
          if (rootPath === "/manual/other-repo") {
            return [
              {
                name: "origin",
                repository: {
                  forge: "github",
                  host: "github.com",
                  owner: "other-org",
                  repo: "other-repo",
                },
              },
            ];
          }

          return [
            {
              name: "origin",
              repository: {
                forge: "github",
                host: "github.com",
                owner: "diffdiff",
                repo: "diffdiff",
              },
            },
          ];
        }),
        promptForRepositoryPath,
        searchRepositoryRoots: vi.fn(async () => []),
      },
    );

    expect(promptForRepositoryPath).toHaveBeenCalledWith({
      candidates: [],
      reason: "missing",
      repository: {
        forge: "github",
        host: "github.com",
        owner: "other-org",
        repo: "other-repo",
      },
      searchRoot: "/workspace",
    });
    expect(options).toEqual({
      base: "main",
      head: "feature/other",
      repoPath: "/manual/other-repo",
    });
  });
});
