import { execFile } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { loadReviewSession } from "../src/load-review-session.ts";
import { parsePorcelainStatusEntries } from "../src/repository/patch.ts";

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

describe("parsePorcelainStatusEntries", () => {
  test("parses regular and renamed status records", () => {
    const output = `?? README.md\u0000R  old-name.ts\u0000new-name.ts\u0000`;

    expect(parsePorcelainStatusEntries(output)).toEqual([
      {
        path: "README.md",
        status: "??",
      },
      {
        originalPath: "old-name.ts",
        path: "new-name.ts",
        status: "R ",
      },
    ]);
  });
});

describe("loadReviewSession", () => {
  test("defaults to HEAD vs working tree when commits exist", async () => {
    const repositoryPath = await createTemporaryRepository();

    await mkdir(join(repositoryPath, "src"), { recursive: true });
    await writeFile(join(repositoryPath, "src", "app.ts"), "export const app = true;\n");
    await runGit(repositoryPath, ["add", "."]);
    await runGit(repositoryPath, [
      "-c",
      "user.name=Diffdiff Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-m",
      "Initial commit",
    ]);

    await writeFile(join(repositoryPath, "src", "app.ts"), "export const app = false;\n");
    await writeFile(join(repositoryPath, "src", "staged.ts"), "export const staged = true;\n");
    await runGit(repositoryPath, ["add", "src/staged.ts"]);
    await writeFile(
      join(repositoryPath, "src", "untracked.ts"),
      "export const untracked = true;\n",
    );

    const session = await loadReviewSession({ repoPath: repositoryPath });

    expect(session.comparison).toMatchObject({
      base: "HEAD",
      head: "working tree",
      mode: "working-tree",
      usesMergeBase: false,
    });

    expect(session.files.map((file) => file.path).sort()).toEqual([
      "src/app.ts",
      "src/staged.ts",
      "src/untracked.ts",
    ]);
    expect(session.files.find((file) => file.path === "src/app.ts")).toMatchObject({
      status: "modified",
    });
    expect(session.files.find((file) => file.path === "src/staged.ts")).toMatchObject({
      status: "added",
    });
    expect(session.files.find((file) => file.path === "src/untracked.ts")).toMatchObject({
      status: "added",
    });
    expect(session.files.find((file) => file.path === "src/app.ts")?.patch).toContain(
      "+export const app = false;",
    );
    expect(session.workingTreeSummary).toEqual({
      filesChanged: 3,
      additions: 3,
      deletions: 1,
    });
    expect(session.renderFingerprint).toMatchObject({
      baseRef: "HEAD",
      comparisonMode: "working-tree",
      fileCount: 3,
      headRef: "working tree",
      headSha: expect.any(String),
      patchDigest: expect.any(String),
    });
    expect(session.commits).toHaveLength(1);
    expect(session.commits[0]).toMatchObject({
      author: "Diffdiff Test",
      subject: "Initial commit",
    });
  });

  test("falls back to working tree mode for unborn repositories", async () => {
    const repositoryPath = await createTemporaryRepository();

    await mkdir(join(repositoryPath, "src"), { recursive: true });
    await writeFile(join(repositoryPath, "README.md"), "# diffdiff\n");
    await writeFile(join(repositoryPath, "src", "app.ts"), "export const app = true;\n");

    const session = await loadReviewSession({ repoPath: repositoryPath });

    expect(session.comparison).toMatchObject({
      base: "(empty tree)",
      head: "working tree",
      mode: "working-tree",
      usesMergeBase: false,
    });
    expect(session.files.map((file) => file.path)).toEqual(["README.md", "src/app.ts"]);
    expect(session.files.every((file) => file.status === "added")).toBe(true);
    expect(session.workingTreeSummary).toEqual({
      filesChanged: 2,
      additions: 2,
      deletions: 0,
    });
    expect(session.commits).toEqual([]);
    expect(session.warnings.map((warning) => warning.code)).toContain(
      "unborn-repository-working-tree",
    );
  });

  test("expands untracked nested repositories into file diffs", async () => {
    const repositoryPath = await createTemporaryRepository();

    await writeFile(join(repositoryPath, "README.md"), "# diffdiff\n");
    await runGit(repositoryPath, ["add", "README.md"]);
    await commitAll(repositoryPath, "Initial commit");

    const nestedRepositoryPath = join(repositoryPath, "nested-repo");
    await mkdir(join(nestedRepositoryPath, "src"), { recursive: true });
    await execGit(["init", "--initial-branch=master", nestedRepositoryPath]);
    await writeFile(join(nestedRepositoryPath, "README.md"), "# nested\n");
    await writeFile(join(nestedRepositoryPath, "src", "index.ts"), "export const nested = true;\n");

    const session = await loadReviewSession({ repoPath: repositoryPath });

    expect(session.files.map((file) => file.path).sort()).toEqual([
      "nested-repo/README.md",
      "nested-repo/src/index.ts",
    ]);
    expect(session.files.every((file) => file.status === "added")).toBe(true);
    expect(session.files.every((file) => !file.path.includes(".git/"))).toBe(true);
  });

  test("ignores untracked directories without diffable files", async () => {
    const repositoryPath = await createTemporaryRepository();

    await writeFile(join(repositoryPath, "README.md"), "# diffdiff\n");
    await runGit(repositoryPath, ["add", "README.md"]);
    await commitAll(repositoryPath, "Initial commit");

    await mkdir(join(repositoryPath, ".ruff_cache"), { recursive: true });
    await writeFile(join(repositoryPath, ".ruff_cache", ".gitignore"), "*\n");
    await writeFile(join(repositoryPath, ".ruff_cache", "cache.bin"), "cached\n");
    await writeFile(join(repositoryPath, "src.ts"), "export const value = true;\n");

    const session = await loadReviewSession({ repoPath: repositoryPath });

    expect(session.files.map((file) => file.path)).toEqual(["src.ts"]);
  });

  test("accepts relative nested paths when locating a repository", async () => {
    const repositoryPath = await createTemporaryRepository();
    const originalCwd = process.cwd();

    await mkdir(join(repositoryPath, "src"), { recursive: true });
    await writeFile(join(repositoryPath, "src", "app.ts"), "export const app = true;\n");
    await runGit(repositoryPath, ["add", "."]);
    await commitAll(repositoryPath, "Initial commit");

    try {
      process.chdir(dirname(repositoryPath));
      const session = await loadReviewSession({
        repoPath: join(basename(repositoryPath), "src", "app.ts"),
      });

      expect(await realpath(session.repository.rootPath)).toBe(await realpath(repositoryPath));
      expect(session.files).toEqual([]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("warns when unborn repositories receive explicit refs", async () => {
    const repositoryPath = await createTemporaryRepository();

    await writeFile(join(repositoryPath, "index.ts"), "export const value = 1;\n");

    const session = await loadReviewSession({
      base: "main",
      head: "feature",
      repoPath: repositoryPath,
    });

    expect(session.warnings.map((warning) => warning.code)).toContain("ignored-ref-comparison");
  });

  test(
    "lists comparison commits in git log order with decorations",
    { timeout: 15_000 },
    async () => {
      const repositoryPath = await createTemporaryRepository();

      await runGit(repositoryPath, ["checkout", "-b", "main"]);
      await writeFile(join(repositoryPath, "index.ts"), "export const version = 1;\n");
      await runGit(repositoryPath, ["add", "index.ts"]);
      await commitAll(repositoryPath, "Initial commit");

      await runGit(repositoryPath, ["checkout", "-b", "feature"]);
      await writeFile(join(repositoryPath, "index.ts"), "export const version = 2;\n");
      await runGit(repositoryPath, ["add", "index.ts"]);
      await commitAll(repositoryPath, "Add feature");

      await writeFile(join(repositoryPath, "feature.ts"), "export const feature = true;\n");
      await runGit(repositoryPath, ["add", "feature.ts"]);
      await commitAll(repositoryPath, "Refine feature");

      const session = await loadReviewSession({
        base: "main",
        head: "feature",
        repoPath: repositoryPath,
      });

      expect(session.commits.map((commit) => commit.subject)).toEqual([
        "Refine feature",
        "Add feature",
      ]);
      expect(session.commits[0]).toMatchObject({
        author: "Diffdiff Test",
        decoration: expect.stringContaining("HEAD -> feature"),
        subject: "Refine feature",
      });
    },
  );

  test(
    "fetches a missing explicit branch ref from a configured remote before diffing",
    { timeout: 20_000 },
    async () => {
      const remoteRepositoryPath = await createBareRepository();
      const seedRepositoryPath = await createTemporaryRepository();

      await runGit(seedRepositoryPath, ["checkout", "-b", "main"]);
      await runGit(seedRepositoryPath, ["remote", "add", "origin", remoteRepositoryPath]);
      await writeFile(join(seedRepositoryPath, "index.ts"), "export const version = 1;\n");
      await runGit(seedRepositoryPath, ["add", "index.ts"]);
      await commitAll(seedRepositoryPath, "Initial commit");
      await runGit(seedRepositoryPath, ["push", "-u", "origin", "main"]);

      const clientRepositoryPath = await cloneRepository(remoteRepositoryPath, "main");

      await runGit(seedRepositoryPath, [
        "checkout",
        "-b",
        "jakemullins/epd-3063-accept-partnercode",
      ]);
      await writeFile(join(seedRepositoryPath, "index.ts"), "export const version = 2;\n");
      await runGit(seedRepositoryPath, ["add", "index.ts"]);
      await commitAll(seedRepositoryPath, "Add partner code support");
      await runGit(seedRepositoryPath, [
        "push",
        "-u",
        "origin",
        "jakemullins/epd-3063-accept-partnercode",
      ]);

      await expectGitRef(
        clientRepositoryPath,
        "origin/jakemullins/epd-3063-accept-partnercode",
        false,
      );

      const session = await loadReviewSession({
        base: "origin/main",
        head: "jakemullins/epd-3063-accept-partnercode",
        repoPath: clientRepositoryPath,
      });

      expect(session.comparison).toMatchObject({
        base: "origin/main",
        head: "origin/jakemullins/epd-3063-accept-partnercode",
        mode: "range",
      });
      expect(session.files.map((file) => file.path)).toEqual(["index.ts"]);
      expect(session.files[0]?.patch).toContain("+export const version = 2;");
      await expectGitRef(
        clientRepositoryPath,
        "origin/jakemullins/epd-3063-accept-partnercode",
        true,
      );
    },
  );

  test(
    "explains when a remote-tracking head ref disappears after a branch is deleted",
    { timeout: 20_000 },
    async () => {
      const remoteRepositoryPath = await createBareRepository();
      const seedRepositoryPath = await createTemporaryRepository();

      await runGit(seedRepositoryPath, ["checkout", "-b", "main"]);
      await runGit(seedRepositoryPath, ["remote", "add", "origin", remoteRepositoryPath]);
      await writeFile(join(seedRepositoryPath, "index.ts"), "export const version = 1;\n");
      await runGit(seedRepositoryPath, ["add", "index.ts"]);
      await commitAll(seedRepositoryPath, "Initial commit");
      await runGit(seedRepositoryPath, ["push", "-u", "origin", "main"]);

      const clientRepositoryPath = await cloneRepository(remoteRepositoryPath, "main");

      await runGit(seedRepositoryPath, ["checkout", "-b", "andrewha/epd-3435-upgrade-e2e-gen2"]);
      await writeFile(join(seedRepositoryPath, "index.ts"), "export const version = 2;\n");
      await runGit(seedRepositoryPath, ["add", "index.ts"]);
      await commitAll(seedRepositoryPath, "Add feature branch");
      await runGit(seedRepositoryPath, [
        "push",
        "-u",
        "origin",
        "andrewha/epd-3435-upgrade-e2e-gen2",
      ]);

      const initialSession = await loadReviewSession({
        base: "origin/main",
        head: "andrewha/epd-3435-upgrade-e2e-gen2",
        repoPath: clientRepositoryPath,
      });

      expect(initialSession.comparison.head).toBe("origin/andrewha/epd-3435-upgrade-e2e-gen2");

      await runGit(seedRepositoryPath, [
        "push",
        "origin",
        "--delete",
        "andrewha/epd-3435-upgrade-e2e-gen2",
      ]);
      await runGit(clientRepositoryPath, ["fetch", "--prune", "origin"]);

      await expect(
        loadReviewSession({
          base: "origin/main",
          head: "origin/andrewha/epd-3435-upgrade-e2e-gen2",
          repoPath: clientRepositoryPath,
        }),
      ).rejects.toThrow(
        "Unable to resolve head ref 'origin/andrewha/epd-3435-upgrade-e2e-gen2'. Remote branch 'origin/andrewha/epd-3435-upgrade-e2e-gen2' is no longer available locally or on remote 'origin'. If this comparison came from a pull request, the branch may have been deleted after the pull request was merged or closed.",
      );
    },
  );
});

async function createTemporaryRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(join(tmpdir(), "diffdiff-core-"));
  temporaryDirectories.push(repositoryPath);

  await execGit(["init", "--initial-branch=master", repositoryPath]);
  await runGit(repositoryPath, ["config", "user.name", "Diffdiff Test"]);
  await runGit(repositoryPath, ["config", "user.email", "test@example.com"]);

  return repositoryPath;
}

async function createBareRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(join(tmpdir(), "diffdiff-core-remote-"));
  temporaryDirectories.push(repositoryPath);
  await execGit(["init", "--bare", "--initial-branch=master", repositoryPath]);
  return repositoryPath;
}

async function cloneRepository(remoteRepositoryPath: string, branchName: string): Promise<string> {
  const repositoryPath = await mkdtemp(join(tmpdir(), "diffdiff-core-clone-"));
  temporaryDirectories.push(repositoryPath);
  await execGit(["clone", "--branch", branchName, remoteRepositoryPath, repositoryPath]);
  return repositoryPath;
}

async function runGit(repositoryPath: string, args: string[]): Promise<void> {
  await execGit(args, { cwd: repositoryPath });
}

async function expectGitRef(
  repositoryPath: string,
  ref: string,
  expectedToExist: boolean,
): Promise<void> {
  const result = await execGit(["rev-parse", "--verify", ref], { cwd: repositoryPath }).then(
    () => true,
    () => false,
  );

  expect(result).toBe(expectedToExist);
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
