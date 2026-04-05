import { readdir } from "node:fs/promises";
import { join, posix } from "node:path";
import { runCommand } from "../command.ts";
import { logDiffdiffInfo } from "../logging.ts";
import type { ChangedFile, ChangeSummary } from "../types/session.ts";
import {
  parseChangedFilePatch,
  parseNumstatSummary,
  splitPatchIntoFiles,
  summarizeChangedFiles,
} from "./patch.ts";

const EMPTY_TREE_LABEL = "(empty tree)";
const NULL_DEVICE_PATH = process.platform === "win32" ? "NUL" : "/dev/null";
const UNTRACKED_DIFF_CONCURRENCY = 8;

export async function summarizeWorkingTreeChanges(
  rootPath: string,
  base: string,
): Promise<ChangeSummary> {
  const files = await listWorkingTreeChanges(rootPath, base);
  return summarizeChangedFiles(files);
}

export async function listChangedFiles(rootPath: string, range: string): Promise<ChangedFile[]> {
  const patch = await runCommand(
    "git",
    [
      "diff",
      "--find-renames",
      "--find-copies",
      "--no-ext-diff",
      "--submodule=diff",
      "--full-index",
      "--unified=3",
      "--src-prefix=a/",
      "--dst-prefix=b/",
      range,
    ],
    { cwd: rootPath },
  );

  return splitPatchIntoFiles(patch).map((filePatch) => parseChangedFilePatch(filePatch));
}

export async function summarizeDiffRange(rootPath: string, range: string): Promise<ChangeSummary> {
  const stdout = await runCommand(
    "git",
    ["diff", "--numstat", "--find-renames", "--find-copies", range],
    { cwd: rootPath },
  );

  return parseNumstatSummary(stdout);
}

export async function listWorkingTreeChanges(
  rootPath: string,
  base: string,
): Promise<ChangedFile[]> {
  const startedAt = Date.now();
  const untrackedPathsStartedAt = Date.now();
  const untrackedPaths = await listUntrackedPaths(rootPath);
  const listUntrackedPathsDurationMs = Date.now() - untrackedPathsStartedAt;

  if (base === EMPTY_TREE_LABEL) {
    const untrackedDiffStartedAt = Date.now();
    const files = await listUntrackedFiles(rootPath, untrackedPaths);

    logDiffdiffInfo("session", "git_working_tree_changes_loaded", {
      base,
      durationMs: Date.now() - startedAt,
      listUntrackedPathsDurationMs,
      trackedFileCount: 0,
      trackedPatchBytes: 0,
      trackedPatchDurationMs: 0,
      trackedPatchParseDurationMs: 0,
      untrackedDiffDurationMs: Date.now() - untrackedDiffStartedAt,
      untrackedFileCount: files.length,
      untrackedPathCount: untrackedPaths.length,
    });

    return files;
  }

  const trackedPatchStartedAt = Date.now();
  const trackedPatch = await runCommand(
    "git",
    [
      "diff",
      "--find-renames",
      "--find-copies",
      "--no-ext-diff",
      "--submodule=diff",
      "--full-index",
      "--unified=3",
      "--src-prefix=a/",
      "--dst-prefix=b/",
      base,
    ],
    { cwd: rootPath },
  );
  const trackedPatchDurationMs = Date.now() - trackedPatchStartedAt;
  const trackedPatchParseStartedAt = Date.now();
  const trackedFiles = splitPatchIntoFiles(trackedPatch).map((filePatch) =>
    parseChangedFilePatch(filePatch),
  );
  const trackedPatchParseDurationMs = Date.now() - trackedPatchParseStartedAt;
  const untrackedDiffStartedAt = Date.now();
  const untrackedFiles = await listUntrackedFiles(rootPath, untrackedPaths);
  const changedFiles = [...trackedFiles, ...untrackedFiles];

  logDiffdiffInfo("session", "git_working_tree_changes_loaded", {
    base,
    durationMs: Date.now() - startedAt,
    listUntrackedPathsDurationMs,
    trackedFileCount: trackedFiles.length,
    trackedPatchBytes: Buffer.byteLength(trackedPatch, "utf8"),
    trackedPatchDurationMs,
    trackedPatchParseDurationMs,
    untrackedDiffDurationMs: Date.now() - untrackedDiffStartedAt,
    untrackedFileCount: untrackedFiles.length,
    untrackedPathCount: untrackedPaths.length,
  });

  return changedFiles;
}

async function listUntrackedFiles(
  rootPath: string,
  paths: readonly string[],
): Promise<ChangedFile[]> {
  const filePaths: string[] = [];

  for (const path of paths) {
    if (path.endsWith("/")) {
      if (!(await shouldDiffUntrackedDirectory(rootPath, path))) {
        continue;
      }

      filePaths.push(...(await listDirectoryFilesForDiff(rootPath, path)));
      continue;
    }

    filePaths.push(path);
  }

  return mapWithConcurrency(filePaths, UNTRACKED_DIFF_CONCURRENCY, (filePath) =>
    diffUntrackedFile(rootPath, filePath),
  );
}

async function listDirectoryFilesForDiff(rootPath: string, path: string): Promise<string[]> {
  const directoryEntries = await readdir(join(rootPath, path), { withFileTypes: true });
  const filePaths: string[] = [];

  for (const entry of [...directoryEntries].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (entry.name === ".git") {
      continue;
    }

    const childPath = posix.join(path, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...(await listDirectoryFilesForDiff(rootPath, childPath)));
      continue;
    }

    filePaths.push(childPath);
  }

  return filePaths;
}

async function shouldDiffUntrackedDirectory(rootPath: string, path: string): Promise<boolean> {
  const stdout = await runCommand(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z", "--", path],
    {
      cwd: rootPath,
    },
  );

  return stdout !== "";
}

async function listUntrackedPaths(rootPath: string): Promise<string[]> {
  const stdout = await runCommand(
    "git",
    ["ls-files", "--others", "--exclude-standard", "--directory", "-z"],
    { cwd: rootPath },
  );

  return stdout.split("\u0000").filter((path) => path !== "");
}

async function diffUntrackedFile(rootPath: string, path: string): Promise<ChangedFile> {
  const patch = await runCommand(
    "git",
    [
      "diff",
      "--no-index",
      "--find-renames",
      "--find-copies",
      "--no-ext-diff",
      "--full-index",
      "--unified=3",
      "--src-prefix=a/",
      "--dst-prefix=b/",
      "--",
      NULL_DEVICE_PATH,
      path,
    ],
    {
      allowedExitCodes: [1],
      cwd: rootPath,
    },
  );

  return parseChangedFilePatch(patch);
}

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  mapItem: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const results = Array.from({ length: items.length }, () => undefined) as TOutput[];
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await mapItem(items[currentIndex]!, currentIndex);
      }
    }),
  );

  return results;
}
