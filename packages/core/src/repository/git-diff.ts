import { runCommand } from "../command.ts";
import type { ChangedFile, ChangeSummary } from "../types/session.ts";
import {
  parseChangedFilePatch,
  parseNumstatSummary,
  parsePorcelainStatusEntries,
  splitPatchIntoFiles,
  summarizeChangedFiles,
} from "./patch.ts";

const EMPTY_TREE_LABEL = "(empty tree)";
const NULL_DEVICE_PATH = process.platform === "win32" ? "NUL" : "/dev/null";

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
  const stdout = await runCommand(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
    { cwd: rootPath },
  );

  const statusEntries = parsePorcelainStatusEntries(stdout);
  const statusEntriesByPath = new Map(statusEntries.map((entry) => [entry.path, entry]));
  const paths = [...new Set(statusEntries.map((entry) => entry.path))];
  if (base === EMPTY_TREE_LABEL) {
    return listUntrackedFiles(rootPath, paths);
  }

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
  const trackedFilesByPath = new Map(
    splitPatchIntoFiles(trackedPatch)
      .map((filePatch) => parseChangedFilePatch(filePatch))
      .map((file) => [file.path, file]),
  );
  const changedFiles: ChangedFile[] = [];

  for (const path of paths) {
    const statusEntry = statusEntriesByPath.get(path);
    if (statusEntry?.status === "??") {
      changedFiles.push(await diffUntrackedFile(rootPath, path));
      continue;
    }

    const trackedFile = trackedFilesByPath.get(path);
    if (trackedFile != null) {
      changedFiles.push(trackedFile);
      trackedFilesByPath.delete(path);
    }
  }

  changedFiles.push(...trackedFilesByPath.values());

  return changedFiles;
}

async function listUntrackedFiles(
  rootPath: string,
  paths: readonly string[],
): Promise<ChangedFile[]> {
  const changedFiles: ChangedFile[] = [];

  for (const path of paths) {
    changedFiles.push(await diffUntrackedFile(rootPath, path));
  }

  return changedFiles;
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
