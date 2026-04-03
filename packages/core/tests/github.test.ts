import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import * as commandModule from "../src/command.ts";
import { GitHubMetadataProvider } from "../src/github/index.ts";
import { resolveGitHubAuth, storeGitHubToken } from "../src/github/auth.ts";
import { getGitHubAuthConfigPaths } from "../src/github/config.ts";
import { GitHubPullRequestService } from "../src/github/pull-request-service.ts";
import type { GitHubApiClient, GitHubClientFactory } from "../src/types/providers.ts";
import type { ReviewSession } from "../src/types/session.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("GitHub auth", () => {
  test("stores and resolves a Linux Secret Service token before falling back to config", async () => {
    const homePath = await mkdtemp(join(tmpdir(), "diffdiff-github-auth-"));
    temporaryDirectories.push(homePath);

    const secureStoreCommandRunner = vi.fn(
      async (command: string, args: string[], options?: { input?: string }) => {
        expect(command).toBe("secret-tool");

        if (args[0] === "store") {
          expect(options?.input).toBe("linux-secure-token");
          return { stderr: "", stdout: "" };
        }

        if (args[0] === "lookup") {
          return { stderr: "", stdout: "linux-secure-token\n" };
        }

        throw new Error(`Unexpected secret-tool invocation: ${args.join(" ")}`);
      },
    );

    const storedAuth = await storeGitHubToken("linux-secure-token", {
      env: {},
      homePath,
      platform: "linux",
      secureStoreCommandRunner,
    });
    const resolvedAuth = await resolveGitHubAuth({
      env: {},
      homePath,
      platform: "linux",
      secureStoreCommandRunner,
    });

    expect(storedAuth.tokenSource).toBe("secure-store");
    expect(resolvedAuth).toMatchObject({
      host: "github.com",
      token: "linux-secure-token",
      tokenSource: "secure-store",
    });
    await expect(
      access(getGitHubAuthConfigPaths({}, "linux", homePath).primaryFilePath),
    ).rejects.toThrow();
  });

  test("stores and resolves a Windows credential manager token before falling back to config", async () => {
    const homePath = await mkdtemp(join(tmpdir(), "diffdiff-github-auth-"));
    temporaryDirectories.push(homePath);

    const secureStoreCommandRunner = vi.fn(async (command: string, args: string[]) => {
      expect(command).toBe("powershell.exe");
      expect(args).toContain("-Command");

      if (args[4]?.includes("[Console]::Out.Write($credential.Password)")) {
        return { stderr: "", stdout: "windows-secure-token" };
      }

      return { stderr: "", stdout: "" };
    });

    const storedAuth = await storeGitHubToken("windows-secure-token", {
      env: {},
      homePath,
      platform: "win32",
      secureStoreCommandRunner,
    });
    const resolvedAuth = await resolveGitHubAuth({
      env: {},
      homePath,
      platform: "win32",
      secureStoreCommandRunner,
    });

    expect(storedAuth.tokenSource).toBe("secure-store");
    expect(resolvedAuth).toMatchObject({
      host: "github.com",
      token: "windows-secure-token",
      tokenSource: "secure-store",
    });
    await expect(
      access(getGitHubAuthConfigPaths({}, "win32", homePath).primaryFilePath),
    ).rejects.toThrow();
  });

  test("stores and resolves a fallback config token", async () => {
    const homePath = await mkdtemp(join(tmpdir(), "diffdiff-github-auth-"));
    temporaryDirectories.push(homePath);

    const storedAuth = await storeGitHubToken("config-token", {
      env: {},
      homePath,
      platform: "linux",
    });
    const resolvedAuth = await resolveGitHubAuth({
      env: {},
      homePath,
      platform: "linux",
    });

    expect(storedAuth.tokenSource).toBe("config");
    expect(resolvedAuth).toMatchObject({
      host: "github.com",
      token: "config-token",
      tokenSource: "config",
    });
    expect(resolvedAuth?.configFilePath).toBe(
      getGitHubAuthConfigPaths({}, "linux", homePath).primaryFilePath,
    );
  });

  test("prefers an environment token over config storage", async () => {
    const homePath = await mkdtemp(join(tmpdir(), "diffdiff-github-auth-"));
    temporaryDirectories.push(homePath);

    await storeGitHubToken("config-token", {
      env: {},
      homePath,
      platform: "linux",
    });

    const resolvedAuth = await resolveGitHubAuth({
      env: { DIFFDIFF_GITHUB_TOKEN: "env-token" },
      homePath,
      platform: "linux",
    });

    expect(resolvedAuth).toMatchObject({
      token: "env-token",
      tokenSource: "env",
    });
  });
});

describe("GitHubMetadataProvider", () => {
  test("enriches remote branches with Octokit-backed pull requests", async () => {
    const provider = new GitHubMetadataProvider({
      listOpenPullRequests: vi.fn(async () => [
        {
          baseRefName: "main",
          headRefName: "feature/ui",
          number: 42,
          title: "UI polish",
          url: "https://github.com/diffdiff/diffdiff/pull/42",
        },
      ]),
    });

    const result = await provider.enrichBranches({
      branches: [
        {
          isCurrent: false,
          isDefault: false,
          kind: "remote",
          name: "origin/feature/ui",
          ref: "refs/remotes/origin/feature/ui",
          remoteName: "origin",
          sha: "abc123",
        },
      ],
      remote: {
        fetchUrl: "git@github.com:diffdiff/diffdiff.git",
        forge: {
          forge: "github",
          host: "github.com",
          owner: "diffdiff",
          repo: "diffdiff",
        },
        name: "origin",
      },
      repositoryRoot: "/tmp/repo",
    });

    expect(result.warnings).toEqual([]);
    expect(result.branches[0]?.pullRequest).toMatchObject({
      number: 42,
      title: "UI polish",
    });
  });
});

describe("GitHubPullRequestService", () => {
  test("attaches active pull request review data to a review session", async () => {
    mockRemoteTrackingRefs("refs/remotes/origin/main", "refs/remotes/origin/feature/ui");
    const clientFactory: GitHubClientFactory = {
      create: vi.fn(async () => createGitHubApiClient()),
    };
    const service = new GitHubPullRequestService(clientFactory);

    const session = await service.attachReviewSession(createReviewSession());

    expect(session.github?.pullRequest.title).toBe("UI polish");
    expect(session.github?.pullRequest.checks.state).toBe("success");
    expect(session.github?.pullRequest.conversationItems).toHaveLength(2);
    expect(session.github?.pullRequest.reviewGroups).toHaveLength(2);
    expect(session.github?.pullRequest.reviewThreads).toHaveLength(1);
    expect(session.github?.pullRequest.reviewThreads[0]?.comments).toHaveLength(2);
    expect(session.github?.pullRequest.pendingReview).toMatchObject({ id: 9010 });
    expect(session.warnings).toEqual([]);
  });

  test("warns when the PR head remote-tracking ref is not available locally", async () => {
    mockRemoteTrackingRefs("refs/remotes/origin/main");
    const clientFactory: GitHubClientFactory = {
      create: vi.fn(async () => createGitHubApiClient({ commentPath: "docs/guide.md" })),
    };
    const service = new GitHubPullRequestService(clientFactory);

    const session = await service.attachReviewSession(createReviewSession());

    expect(session.warnings).toEqual([
      {
        code: "github-pr-head-local-ref-missing",
        message:
          "PR head ref refs/remotes/origin/feature/ui is not available locally, so diffdiff cannot build the exact PR comparison from local refs only.",
      },
      {
        code: "github-inline-anchoring-unavailable",
        message:
          "Inline comment anchoring is unavailable because diffdiff cannot build the exact PR comparison from local refs only.",
      },
    ]);
  });

  test("warns when the PR base remote-tracking ref is not available locally", async () => {
    mockRemoteTrackingRefs("refs/remotes/origin/feature/ui");
    const clientFactory: GitHubClientFactory = {
      create: vi.fn(async () => createGitHubApiClient()),
    };
    const service = new GitHubPullRequestService(clientFactory);

    const session = await service.attachReviewSession(createReviewSession());

    expect(session.warnings).toEqual([
      {
        code: "github-pr-base-local-ref-missing",
        message:
          "PR base ref refs/remotes/origin/main is not available locally, so diffdiff cannot build the exact PR comparison from local refs only.",
      },
      {
        code: "github-inline-anchoring-unavailable",
        message:
          "Inline comment anchoring is unavailable because diffdiff cannot build the exact PR comparison from local refs only.",
      },
    ]);
  });

  test("creates a pending review thread with GraphQL when adding an inline comment", async () => {
    mockRemoteTrackingRefs("refs/remotes/origin/main", "refs/remotes/origin/feature/ui");
    const client = createGitHubApiClient();
    const clientFactory: GitHubClientFactory = {
      create: vi.fn(async () => client),
    };
    const service = new GitHubPullRequestService(clientFactory);
    const session = await service.attachReviewSession(createReviewSession());
    const githubSession = {
      ...session.github!,
      pullRequest: {
        ...session.github!.pullRequest,
        pendingReview: undefined,
      },
    };
    const { graphqlMock, requestMock } = client;

    await service.addPendingReviewThread(
      githubSession,
      {
        line: 1,
        path: "src/app.ts",
        side: "RIGHT",
      },
      "Please rename this variable.",
    );

    expect(requestMock).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      expect.objectContaining({
        owner: "diffdiff",
        pull_number: 42,
        repo: "diffdiff",
      }),
    );
    expect(graphqlMock).toHaveBeenCalledWith(
      expect.stringContaining("mutation AddPullRequestReviewThread"),
      expect.objectContaining({
        input: expect.objectContaining({
          body: "Please rename this variable.",
          line: 1,
          path: "src/app.ts",
          pullRequestId: "PR_node_42",
        }),
      }),
    );
  });

  test("submits a pending review through the REST review events endpoint", async () => {
    mockRemoteTrackingRefs("refs/remotes/origin/main", "refs/remotes/origin/feature/ui");
    const client = createGitHubApiClient();
    const clientFactory: GitHubClientFactory = {
      create: vi.fn(async () => client),
    };
    const service = new GitHubPullRequestService(clientFactory);
    const session = await service.attachReviewSession(createReviewSession());
    const { requestMock } = client;

    await service.submitPendingReview(session.github!, "APPROVE", "Looks good to me.");

    expect(requestMock).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events",
      {
        body: "Looks good to me.",
        event: "APPROVE",
        owner: "diffdiff",
        pull_number: 42,
        repo: "diffdiff",
        review_id: 9010,
      },
    );
  });

  test("replies to a review comment through the REST replies endpoint", async () => {
    mockRemoteTrackingRefs("refs/remotes/origin/main", "refs/remotes/origin/feature/ui");
    const client = createGitHubApiClient();
    const clientFactory: GitHubClientFactory = {
      create: vi.fn(async () => client),
    };
    const service = new GitHubPullRequestService(clientFactory);
    const session = await service.attachReviewSession(createReviewSession());
    const { requestMock } = client;

    await service.replyToReviewComment(session.github!, 101, "Following up here.");

    expect(requestMock).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies",
      {
        body: "Following up here.",
        comment_id: 101,
        owner: "diffdiff",
        pull_number: 42,
        repo: "diffdiff",
      },
    );
  });

  test("creates a PR-level conversation comment through the issues comments endpoint", async () => {
    mockRemoteTrackingRefs("refs/remotes/origin/main", "refs/remotes/origin/feature/ui");
    const client = createGitHubApiClient();
    const clientFactory: GitHubClientFactory = {
      create: vi.fn(async () => client),
    };
    const service = new GitHubPullRequestService(clientFactory);
    const session = await service.attachReviewSession(createReviewSession());
    const { requestMock } = client;

    await service.addPullRequestComment(session.github!, "Quoting the earlier discussion.");

    expect(requestMock).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        body: "Quoting the earlier discussion.",
        issue_number: 42,
        owner: "diffdiff",
        repo: "diffdiff",
      },
    );
  });

  test("merges a pull request, refreshes refs, and suggests cleanup for deleted branch refs", async () => {
    const client = createGitHubApiClient();
    const clientFactory: GitHubClientFactory = {
      create: vi.fn(async () => client),
    };
    const runCommandSpy = vi
      .spyOn(commandModule, "runCommand")
      .mockImplementation(async (_command, args) => {
        if (args[0] === "rev-parse" && args[2] === "refs/remotes/origin/main") {
          return "basesha\n";
        }

        if (args[0] === "rev-parse" && args[2] === "refs/remotes/origin/feature/ui") {
          return "headsha\n";
        }

        if (args[0] === "rev-parse" && args[2] === "refs/heads/feature/ui") {
          return "headsha\n";
        }

        if (args[0] === "ls-remote" && args[3] === "refs/heads/main") {
          return "basesha\trefs/heads/main\n";
        }

        if (args[0] === "ls-remote" && args[3] === "refs/heads/feature/ui") {
          return "";
        }

        return "";
      });
    const service = new GitHubPullRequestService(clientFactory);
    const session = await service.attachReviewSession(createReviewSession());
    const { requestMock } = client;

    const result = await service.mergePullRequest(session.github!, {
      commitMessage: "Ship it",
      commitTitle: "Merge UI polish",
      comparison: session.comparison,
      method: "merge",
    });

    expect(requestMock).toHaveBeenCalledWith(
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
      {
        commit_message: "Ship it",
        commit_title: "Merge UI polish",
        merge_method: "merge",
        owner: "diffdiff",
        pull_number: 42,
        repo: "diffdiff",
      },
    );
    expect(runCommandSpy).toHaveBeenCalledWith(
      "git",
      ["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"],
      { cwd: "/tmp/diffdiff" },
    );
    expect(result.cleanupCandidates).toEqual([
      {
        branchName: "feature/ui",
        kind: "local-branch",
        ref: "feature/ui",
      },
      {
        branchName: "feature/ui",
        kind: "remote-tracking",
        ref: "origin/feature/ui",
      },
    ]);
  });

  test("removes selected cleanup refs from the local clone", async () => {
    const clientFactory: GitHubClientFactory = {
      create: vi.fn(async () => createGitHubApiClient()),
    };
    const runCommandSpy = vi.spyOn(commandModule, "runCommand").mockResolvedValue("");
    const service = new GitHubPullRequestService(clientFactory);

    await service.removeCleanupRefs("/tmp/diffdiff", [
      {
        branchName: "feature/ui",
        kind: "local-branch",
        ref: "feature/ui",
      },
      {
        branchName: "feature/ui",
        kind: "remote-tracking",
        ref: "origin/feature/ui",
      },
    ]);

    expect(runCommandSpy).toHaveBeenCalledWith("git", ["branch", "-D", "feature/ui"], {
      cwd: "/tmp/diffdiff",
    });
    expect(runCommandSpy).toHaveBeenCalledWith("git", ["branch", "-dr", "origin/feature/ui"], {
      cwd: "/tmp/diffdiff",
    });
  });
});

function createGitHubApiClient(options: { commentPath?: string } = {}): GitHubApiClient & {
  graphqlMock: ReturnType<typeof vi.fn>;
  requestMock: ReturnType<typeof vi.fn>;
} {
  const commentPath = options.commentPath ?? "src/app.ts";
  const graphql = vi.fn(async () => ({ addPullRequestReviewThread: { thread: { id: "PRRT_1" } } }));
  const request = vi.fn(async (route) => {
    if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}") {
      return {
        base: { ref: "main" },
        body: "Adds the review UI.",
        draft: false,
        head: { ref: "feature/ui", sha: "headsha" },
        html_url: "https://github.com/diffdiff/diffdiff/pull/42",
        mergeable: true,
        mergeable_state: "clean",
        merged: false,
        merged_at: null,
        node_id: "PR_node_42",
        number: 42,
        state: "open",
        title: "UI polish",
        user: { html_url: "https://github.com/madison", login: "madison" },
      };
    }

    if (route === "GET /repos/{owner}/{repo}/commits/{ref}/check-runs") {
      return {
        check_runs: [{ conclusion: "success", status: "completed" }],
      };
    }

    if (route === "GET /repos/{owner}/{repo}/commits/{ref}/status") {
      return { state: "success" };
    }

    if (route === "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews") {
      return {
        body: null,
        id: 9010,
        node_id: "PRR_pending_9010",
      };
    }

    if (route === "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies") {
      return {
        body: "Following up here.",
        commit_id: "headsha",
        created_at: "2026-04-01T12:04:00Z",
        diff_hunk: "@@ -1 +1 @@",
        html_url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r103",
        id: 103,
        in_reply_to_id: 101,
        line: 1,
        node_id: "PRRC_103",
        original_commit_id: "basesha",
        original_line: 1,
        path: commentPath,
        pull_request_review_id: 9001,
        side: "RIGHT",
        start_line: null,
        original_start_line: null,
        start_side: null,
        updated_at: "2026-04-01T12:04:00Z",
        user: { html_url: "https://github.com/madison", login: "madison" },
      };
    }

    if (route === "POST /repos/{owner}/{repo}/issues/{issue_number}/comments") {
      return {
        body: "Quoting the earlier discussion.",
        created_at: "2026-04-01T12:05:00Z",
        html_url: "https://github.com/diffdiff/diffdiff/pull/42#issuecomment-502",
        id: 502,
        node_id: "PRIC_502",
        updated_at: "2026-04-01T12:05:00Z",
        user: { html_url: "https://github.com/madison", login: "madison" },
      };
    }

    if (route === "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge") {
      return {
        message: "Pull Request successfully merged",
        merged: true,
        sha: "mergedsha",
      };
    }

    return undefined;
  });

  return {
    auth: {
      host: "github.com",
      token: "test-token",
      tokenSource: "config",
    },
    graphql: graphql as unknown as GitHubApiClient["graphql"],
    graphqlMock: graphql,
    paginate: vi.fn(async (route) => {
      if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews") {
        return [
          {
            body: "Looks good.",
            html_url: "https://github.com/diffdiff/diffdiff/pull/42#pullrequestreview-9001",
            id: 9001,
            node_id: "PRR_9001",
            state: "APPROVED",
            submitted_at: "2026-04-01T12:00:00Z",
            user: { html_url: "https://github.com/octocat", login: "octocat" },
          },
          {
            body: null,
            html_url: "https://github.com/diffdiff/diffdiff/pull/42#pullrequestreview-9010",
            id: 9010,
            node_id: "PRR_pending_9010",
            state: "PENDING",
            submitted_at: null,
            user: { html_url: "https://github.com/madison", login: "madison" },
          },
        ];
      }

      if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments") {
        return [
          {
            body: "Please rename this variable.",
            commit_id: "headsha",
            created_at: "2026-04-01T12:01:00Z",
            diff_hunk: "@@ -1 +1 @@",
            html_url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r1",
            id: 101,
            in_reply_to_id: null,
            line: 1,
            node_id: "PRRC_101",
            original_commit_id: "basesha",
            original_line: 1,
            path: commentPath,
            pull_request_review_id: 9001,
            side: "RIGHT",
            start_line: null,
            original_start_line: null,
            start_side: null,
            updated_at: "2026-04-01T12:01:00Z",
            user: { html_url: "https://github.com/octocat", login: "octocat" },
          },
          {
            body: "Fixed.",
            commit_id: "headsha",
            created_at: "2026-04-01T12:02:00Z",
            diff_hunk: "@@ -1 +1 @@",
            html_url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r2",
            id: 102,
            in_reply_to_id: 101,
            line: 1,
            node_id: "PRRC_102",
            original_commit_id: "basesha",
            original_line: 1,
            path: commentPath,
            pull_request_review_id: 9001,
            side: "RIGHT",
            start_line: null,
            original_start_line: null,
            start_side: null,
            updated_at: "2026-04-01T12:02:00Z",
            user: { html_url: "https://github.com/diffdiff-bot", login: "diffdiff-bot" },
          },
        ];
      }

      if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/comments") {
        return [
          {
            body: "Can we tighten the rollout copy?",
            created_at: "2026-04-01T11:58:00Z",
            html_url: "https://github.com/diffdiff/diffdiff/pull/42#issuecomment-501",
            id: 501,
            node_id: "PRIC_501",
            updated_at: "2026-04-01T11:58:00Z",
            user: { html_url: "https://github.com/octocat", login: "octocat" },
          },
        ];
      }

      if (route === "GET /repos/{owner}/{repo}/pulls") {
        return [];
      }

      return [];
    }),
    request,
    requestMock: request,
  };
}

function mockRemoteTrackingRefs(...existingRefs: string[]) {
  return vi.spyOn(commandModule, "runCommand").mockImplementation(async (_command, args) => {
    if (args[0] === "rev-parse" && args[1] === "--verify") {
      if (existingRefs.includes(args[2] ?? "")) {
        return "sha\n";
      }

      throw new Error(`Missing ref: ${args[2]}`);
    }

    return "";
  });
}

function createReviewSession(): ReviewSession {
  return {
    branches: {
      local: [
        {
          isCurrent: true,
          isDefault: false,
          kind: "local",
          name: "feature/ui",
          ref: "refs/heads/feature/ui",
          sha: "headsha",
        },
      ],
      remote: [
        {
          isCurrent: false,
          isDefault: false,
          kind: "remote",
          name: "origin/feature/ui",
          pullRequest: {
            baseRefName: "main",
            headRefName: "feature/ui",
            number: 42,
            title: "UI polish",
            url: "https://github.com/diffdiff/diffdiff/pull/42",
          },
          ref: "refs/remotes/origin/feature/ui",
          remoteName: "origin",
          sha: "headsha",
        },
        {
          isCurrent: false,
          isDefault: true,
          kind: "remote",
          name: "origin/main",
          ref: "refs/remotes/origin/main",
          remoteName: "origin",
          sha: "basesha",
        },
      ],
    },
    commits: [],
    comparison: {
      base: "origin/main",
      head: "origin/feature/ui",
      mode: "range",
      range: "origin/main...origin/feature/ui",
      usesMergeBase: true,
    },
    files: [
      {
        additions: 1,
        deletions: 0,
        isBinary: false,
        patch: "diff --git a/src/app.ts b/src/app.ts",
        path: "src/app.ts",
        status: "modified",
      },
    ],
    repository: {
      currentBranch: "feature/ui",
      kind: "git",
      name: "diffdiff",
      remotes: [
        {
          fetchUrl: "git@github.com:diffdiff/diffdiff.git",
          forge: {
            forge: "github",
            host: "github.com",
            owner: "diffdiff",
            repo: "diffdiff",
          },
          name: "origin",
        },
      ],
      rootPath: "/tmp/diffdiff",
    },
    warnings: [],
    workingTreeSummary: {
      additions: 0,
      deletions: 0,
      filesChanged: 0,
    },
  };
}
