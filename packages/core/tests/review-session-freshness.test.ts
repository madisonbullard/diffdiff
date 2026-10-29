import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { loadReviewSession } from "../src/load-review-session.ts";
import { probeReviewSessionFreshness } from "../src/review-session-freshness.ts";

const temporaryDirectories: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("probeReviewSessionFreshness", () => {
  test("detects working tree changes", async () => {
    const repositoryPath = await createTemporaryRepository();

    await mkdir(join(repositoryPath, "src"), { recursive: true });
    await writeFile(join(repositoryPath, "src", "app.ts"), "export const app = true;\n");
    await runGit(repositoryPath, ["add", "."]);
    await commitAll(repositoryPath, "Initial commit");

    await writeFile(join(repositoryPath, "src", "app.ts"), "export const app = false;\n");

    const session = await loadReviewSession({ repoPath: repositoryPath });

    await writeFile(join(repositoryPath, "src", "app.ts"), "export const app = maybe;\n");

    const freshness = await probeReviewSessionFreshness(session);

    expect(freshness).toMatchObject({
      comparisonSummary: {
        additions: 1,
        deletions: 1,
        filesChanged: 1,
      },
      hasComparisonUpdates: true,
      hasGitHubUpdates: false,
      nextBaseSha: expect.any(String),
      nextHeadSha: expect.any(String),
    });
  });

  test("ignores unchanged working tree sessions", async () => {
    const repositoryPath = await createTemporaryRepository();

    await mkdir(join(repositoryPath, "src"), { recursive: true });
    await writeFile(join(repositoryPath, "src", "app.ts"), "export const app = true;\n");
    await runGit(repositoryPath, ["add", "."]);
    await commitAll(repositoryPath, "Initial commit");

    await writeFile(join(repositoryPath, "src", "app.ts"), "export const app = false;\n");

    const session = await loadReviewSession({ repoPath: repositoryPath });
    const freshness = await probeReviewSessionFreshness(session);

    expect(freshness).toEqual({
      comparisonSummary: undefined,
      githubUpdateReasons: [],
      hasComparisonUpdates: false,
      hasGitHubUpdates: false,
      nextBaseSha: session.renderFingerprint.baseSha,
      nextHeadSha: session.renderFingerprint.headSha,
      nextPullRequestFingerprint: undefined,
    });
  });

  test("summarizes commits pushed to a remote head branch", { timeout: 20_000 }, async () => {
    const { clientPath, seedPath } = await createRemoteComparison();
    const session = await loadRemoteComparisonSession(clientPath);

    await writeFile(join(seedPath, "src", "app.ts"), "export const app = 'later';\n");
    await runGit(seedPath, ["add", "."]);
    await commitAll(seedPath, "Push a later commit");
    await runGit(seedPath, ["push", "origin", "feature"]);

    expect(await probeReviewSessionFreshness(session)).toMatchObject({
      comparisonSummary: { filesChanged: 1 },
      hasComparisonUpdates: true,
      remoteUnreachable: undefined,
    });
  });

  test("reports updates when the remote head branch is deleted", { timeout: 20_000 }, async () => {
    const { clientPath, seedPath } = await createRemoteComparison();
    const session = await loadRemoteComparisonSession(clientPath);

    await runGit(seedPath, ["push", "origin", "--delete", "feature"]);

    expect(await probeReviewSessionFreshness(session)).toMatchObject({
      hasComparisonUpdates: true,
      nextHeadSha: undefined,
      remoteUnreachable: undefined,
    });
  });

  test("reports no updates while the remote cannot be reached", { timeout: 20_000 }, async () => {
    const { clientPath } = await createRemoteComparison();
    const session = await loadRemoteComparisonSession(clientPath);

    await runGit(clientPath, ["remote", "set-url", "origin", join(clientPath, "unreachable.git")]);

    expect(await probeReviewSessionFreshness(session)).toMatchObject({
      comparisonSummary: undefined,
      hasComparisonUpdates: false,
      nextBaseSha: session.renderFingerprint.baseSha,
      nextHeadSha: session.renderFingerprint.headSha,
      remoteUnreachable: true,
    });
  });
});

async function createRemoteComparison(): Promise<{ clientPath: string; seedPath: string }> {
  const remotePath = await mkdtemp(join(tmpdir(), "diffdiff-freshness-remote-"));
  temporaryDirectories.push(remotePath);
  await execGit(["init", "--bare", "--initial-branch=main", remotePath]);

  const seedPath = await createTemporaryRepository();
  await runGit(seedPath, ["checkout", "-b", "main"]);
  await runGit(seedPath, ["remote", "add", "origin", remotePath]);
  await mkdir(join(seedPath, "src"), { recursive: true });
  await writeFile(join(seedPath, "src", "app.ts"), "export const app = true;\n");
  await runGit(seedPath, ["add", "."]);
  await commitAll(seedPath, "Initial commit");
  await runGit(seedPath, ["push", "-u", "origin", "main"]);
  await runGit(seedPath, ["checkout", "-b", "feature"]);
  await writeFile(join(seedPath, "src", "app.ts"), "export const app = false;\n");
  await runGit(seedPath, ["add", "."]);
  await commitAll(seedPath, "Change the feature");
  await runGit(seedPath, ["push", "-u", "origin", "feature"]);

  const clientPath = await mkdtemp(join(tmpdir(), "diffdiff-freshness-client-"));
  temporaryDirectories.push(clientPath);
  await execGit(["clone", remotePath, clientPath]);

  return { clientPath, seedPath };
}

function loadRemoteComparisonSession(clientPath: string) {
  return loadReviewSession({ base: "origin/main", head: "origin/feature", repoPath: clientPath });
}

async function createTemporaryRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(join(tmpdir(), "diffdiff-freshness-"));
  temporaryDirectories.push(repositoryPath);

  await execGit(["init", "--initial-branch=master", repositoryPath]);

  return repositoryPath;
}

async function runGit(repositoryPath: string, args: string[]): Promise<void> {
  await execGit(args, { cwd: repositoryPath });
}

async function commitAll(repositoryPath: string, message: string): Promise<void> {
  await runGit(repositoryPath, [
    "-c",
    "user.name=Diffdiff Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    message,
  ]);
}

async function execGit(args: string[], options?: { cwd?: string }) {
  return execFileAsync("git", args, {
    cwd: options?.cwd,
    env: buildGitEnv(),
  });
}

function buildGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  for (const key of Object.keys(env)) {
    if (
      key === "GIT_ALTERNATE_OBJECT_DIRECTORIES" ||
      key === "GIT_COMMON_DIR" ||
      key === "GIT_CONFIG" ||
      key === "GIT_CONFIG_COUNT" ||
      key === "GIT_CONFIG_PARAMETERS" ||
      key === "GIT_DIR" ||
      key === "GIT_GRAFT_FILE" ||
      key === "GIT_IMPLICIT_WORK_TREE" ||
      key === "GIT_INDEX_FILE" ||
      key === "GIT_INTERNAL_SUPER_PREFIX" ||
      key === "GIT_NO_REPLACE_OBJECTS" ||
      key === "GIT_OBJECT_DIRECTORY" ||
      key === "GIT_PREFIX" ||
      key === "GIT_REPLACE_REF_BASE" ||
      key === "GIT_SHALLOW_FILE" ||
      key === "GIT_WORK_TREE" ||
      /^GIT_(AUTHOR|COMMITTER)_(NAME|EMAIL|DATE)$/u.test(key) ||
      /^GIT_CONFIG_KEY_\d+$/u.test(key) ||
      /^GIT_CONFIG_VALUE_\d+$/u.test(key)
    ) {
      delete env[key];
    }
  }

  return env;
}
