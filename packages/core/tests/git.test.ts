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
    await execFileAsync("git", ["init", nestedRepositoryPath]);
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

  test("lists comparison commits in git log order with decorations", async () => {
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
  });
});

async function createTemporaryRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(join(tmpdir(), "diffdiff-core-"));
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
