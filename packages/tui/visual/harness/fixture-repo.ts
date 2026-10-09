import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface FixtureFile {
  path: string;
  /** Omit for a file added on the feature branch. */
  before?: string;
  /** Omit for a file deleted on the feature branch. */
  after?: string;
}

export interface FixtureRepo {
  base: string;
  head: string;
  path: string;
  dispose: () => void;
}

/**
 * Creates a throwaway git repository whose `main...feature` comparison contains
 * exactly the given files. Files are reviewed through the real diffdiff load
 * pipeline, so patches, hunks, and syntax hydration all match production.
 */
export function createFixtureRepo(files: readonly FixtureFile[]): FixtureRepo {
  const path = mkdtempSync(join(tmpdir(), "diffdiff-visual-repo-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: path,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
        GIT_AUTHOR_EMAIL: "visual@diffdiff.test",
        GIT_AUTHOR_NAME: "visual",
        GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
        GIT_COMMITTER_EMAIL: "visual@diffdiff.test",
        GIT_COMMITTER_NAME: "visual",
      },
      stdio: "pipe",
    });
  const write = (filePath: string, content: string | undefined) => {
    const absolutePath = join(path, filePath);
    if (content == null) {
      rmSync(absolutePath, { force: true });
      return;
    }
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  };

  git("init", "-q", "-b", "main");
  writeFileSync(join(path, ".keep"), "");
  for (const file of files) {
    write(file.path, file.before);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  git("checkout", "-q", "-b", "feature");
  for (const file of files) {
    write(file.path, file.after);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "head");

  return {
    base: "main",
    head: "feature",
    path,
    dispose: () => rmSync(path, { force: true, recursive: true }),
  };
}

/** Lines of the form `<marker> <name> line <n>` so every row is identifiable. */
export function numberedLines(name: string, count: number, marker = "//"): string {
  const lines: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    lines.push(`${marker} ${name} line ${index}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * A long file where every `wrapEvery`-th line is long enough to soft-wrap
 * several times in a typical terminal. Estimating this file's height by its
 * logical line count is badly wrong, which is what exposes estimate drift.
 */
export function wrappingLines(name: string, count: number, wrapEvery = 7): string {
  const lines: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    lines.push(
      index % wrapEvery === 0
        ? `// ${name} line ${index} ${"wrapping words keep going ".repeat(12)}end`
        : `export const ${name}_${index} = ${index};`,
    );
  }
  return `${lines.join("\n")}\n`;
}
