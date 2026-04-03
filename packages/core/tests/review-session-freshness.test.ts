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

  await execFileAsync("git", ["init", repositoryPath]);

  return repositoryPath;
}

async function runGit(repositoryPath: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd: repositoryPath });
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
