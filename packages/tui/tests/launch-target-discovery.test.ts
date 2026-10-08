import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitHubPullRequestService, runCommand } from "@madisonbullard/diffdiff-core";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { resolveLaunchOptionsFromTarget } from "../src/launch-target.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test("PR discovery searches repository containers without descending into unrelated clones", async () => {
  const directory = await createSearchDirectory();
  const repositoryPath = await createRepository(join(directory, "sure", "surecraft-apps"));
  const unrelated = await createRepository(join(directory, "unrelated"), "someone/monorepo");
  await createRepository(join(unrelated, "vendor", "surecraft-apps"));

  expect(await resolveTarget(directory)).toMatchObject({ repoPath: repositoryPath });
});

test.each([".rifts", ".worktrees", ".cache", ".venv", "venv"])(
  "PR discovery does not scan generated content in %s",
  async (generatedDirectory) => {
    const directory = await createSearchDirectory();
    const repositoryPath = await createRepository(join(directory, "sure", "surecraft-apps"));
    await createRepository(join(directory, generatedDirectory, "nested", "surecraft-apps"));

    expect(await resolveTarget(directory)).toMatchObject({ repoPath: repositoryPath });
  },
);

test("multiple peer clones still require a choice instead of using the first match", async () => {
  const directory = await createSearchDirectory();
  const first = await createRepository(join(directory, "first", "surecraft-apps"));
  const second = await createRepository(join(directory, "second", "surecraft-apps"));
  const promptForRepositoryPath = vi.fn(async () => second);

  expect(await resolveTarget(directory, undefined, { promptForRepositoryPath })).toMatchObject({
    repoPath: second,
  });
  expect(promptForRepositoryPath).toHaveBeenCalledWith(
    expect.objectContaining({
      reason: "ambiguous",
      candidates: expect.arrayContaining([first, second]),
    }),
  );
});

test("--repo can explicitly open a clone below a skipped snapshot directory", async () => {
  const directory = await createSearchDirectory();
  const repositoryPath = await createRepository(
    join(directory, ".rifts", "review", "renamed-clone"),
  );

  expect(await resolveTarget(directory, repositoryPath)).toMatchObject({
    repoPath: repositoryPath,
  });
});

test("discovery validates remotes rather than choosing a same-named repository from another owner", async () => {
  const directory = await createSearchDirectory();
  await createRepository(
    join(directory, "wrong", "surecraft-apps"),
    "another-owner/surecraft-apps",
  );
  const repositoryPath = await createRepository(join(directory, "sure", "surecraft-apps"));

  expect(await resolveTarget(directory)).toMatchObject({ repoPath: repositoryPath });
});

test("Git worktrees are discoverable and form the same traversal boundary as clones", async () => {
  const directory = await createSearchDirectory();
  const source = await createRepository(join(directory, "source"));
  await runCommand(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "fixture",
    ],
    { cwd: source },
  );
  const repositoryPath = join(directory, "sure", "surecraft-apps");
  await runCommand("git", ["worktree", "add", "--detach", repositoryPath], { cwd: source });
  await createRepository(join(repositoryPath, "vendor", "surecraft-apps"));

  expect(await resolveTarget(directory)).toMatchObject({ repoPath: repositoryPath });
});

test("PR launch loads only branch refs, leaving review details to session preparation", async () => {
  const directory = await createSearchDirectory();
  const repositoryPath = await createRepository(join(directory, "surecraft-apps"));
  const request = vi.fn(async () => ({ base: { ref: "main" }, head: { ref: "feature/login" } }));
  const graphql = vi.fn(async (): Promise<never> => {
    throw new Error("Launch-target resolution must not fetch review details");
  });
  const paginate = vi.fn(async (): Promise<unknown[]> => {
    throw new Error("Launch-target resolution must not fetch review details");
  });
  const gitHubPullRequestService = new GitHubPullRequestService({
    create: async () => ({ request, graphql, paginate }),
  });

  expect(
    await resolveTarget(directory, repositoryPath, { gitHubPullRequestService }),
  ).toMatchObject({
    base: "origin/main",
    head: "origin/feature/login",
    repoPath: repositoryPath,
  });
  expect(request).toHaveBeenCalledExactlyOnceWith("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner: "sureapp",
    repo: "surecraft-apps",
    pull_number: 7266,
  });
  expect(graphql).not.toHaveBeenCalled();
  expect(paginate).not.toHaveBeenCalled();
});

async function createSearchDirectory(): Promise<string> {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "diffdiff-discovery-")));
  temporaryDirectories.push(directory);
  return directory;
}

async function createRepository(
  path: string,
  repository = "sureapp/surecraft-apps",
): Promise<string> {
  await mkdir(path, { recursive: true });
  await runCommand("git", ["init", "--initial-branch=main"], { cwd: path });
  await runCommand("git", ["remote", "add", "origin", `https://github.com/${repository}.git`], {
    cwd: path,
  });
  return path;
}

function resolveTarget(
  cwd: string,
  repoPath?: string,
  dependencies: Parameters<typeof resolveLaunchOptionsFromTarget>[2] = {},
) {
  return resolveLaunchOptionsFromTarget(
    "https://github.com/sureapp/surecraft-apps/pull/7266",
    { repoPath },
    {
      cwd,
      gitHubPullRequestService: {
        loadPullRequestRefs: async () => ({ baseRefName: "main", headRefName: "feature/login" }),
      },
      hasGitRef: async () => true,
      promptForRepositoryPath: vi.fn(async () => undefined),
      ...dependencies,
    },
  );
}
