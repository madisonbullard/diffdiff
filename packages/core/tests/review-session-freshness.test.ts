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
      hasComparisonUpdates: false,
      hasGitHubUpdates: false,
      nextBaseSha: session.renderFingerprint.baseSha,
      nextHeadSha: session.renderFingerprint.headSha,
      nextPullRequestFingerprint: undefined,
    });
  });
});

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
      /^GIT_CONFIG_KEY_\d+$/u.test(key) ||
      /^GIT_CONFIG_VALUE_\d+$/u.test(key)
    ) {
      delete env[key];
    }
  }

  return env;
}
