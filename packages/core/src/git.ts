import { basename, dirname } from "node:path";
import { runCommand } from "./command.ts";
import { DiffdiffError } from "./errors.ts";
import { parseGitHubRemote, prioritizeRemoteBranches } from "./github.ts";
import type {
  BranchCollection,
  BranchInfo,
  ChangedFile,
  ComparisonInfo,
  ForgeMetadataProvider,
  GitRemote,
  RepositoryHandle,
  RepositoryInfo,
  RepositoryProvider,
  ReviewSession,
  ReviewWarning,
  StartupOptions,
} from "./types.ts";

const FIELD_SEPARATOR = "\u0000";
const EMPTY_TREE_LABEL = "(empty tree)";
const WORKING_TREE_LABEL = "working tree";
const NULL_DEVICE_PATH = process.platform === "win32" ? "NUL" : "/dev/null";

interface StatusEntry {
  status: string;
  path: string;
  originalPath?: string;
}

interface ResolvedComparison {
  comparison: ComparisonInfo;
  currentBranch?: string;
}

export class GitRepositoryProvider implements RepositoryProvider {
  readonly kind = "git";

  async detectRepository(startPath: string): Promise<RepositoryHandle | null> {
    try {
      const rootPath = (
        await runCommand("git", ["rev-parse", "--show-toplevel"], { cwd: startPath })
      ).trim();
      return new GitRepository(rootPath);
    } catch {
      return null;
    }
  }
}

class GitRepository implements RepositoryHandle {
  readonly kind = "git";

  constructor(readonly rootPath: string) {}

  async loadReviewSession(
    options: StartupOptions,
    forgeProviders: ForgeMetadataProvider[],
  ): Promise<ReviewSession> {
    const warnings: ReviewWarning[] = [];
    const hasCommitHistory = await this.hasCommitHistory();
    const resolvedComparison = hasCommitHistory
      ? await this.resolveComparison(options)
      : await this.resolveWorkingTreeComparison();

    if (!hasCommitHistory) {
      warnings.push({
        code: "unborn-repository-working-tree",
        message: "No commits found yet; reviewing the working tree against an empty tree.",
      });

      if (options.base != null || options.head != null) {
        warnings.push({
          code: "ignored-ref-comparison",
          message: "Base/head refs are ignored until the repository has at least one commit.",
        });
      }
    }

    const remotes = await this.listRemotes();
    const repository = await this.buildRepositoryInfo(remotes, resolvedComparison.currentBranch);
    const files =
      resolvedComparison.comparison.mode === "working-tree"
        ? await this.listWorkingTreeChanges()
        : await this.listChangedFiles(resolvedComparison.comparison.range);
    const branches = await this.listBranches(remotes, resolvedComparison.currentBranch);
    const enrichedBranches = await this.enrichRemoteBranches(
      branches,
      remotes,
      forgeProviders,
      warnings,
    );

    return {
      repository,
      comparison: resolvedComparison.comparison,
      files,
      branches: enrichedBranches,
      warnings,
    };
  }

  private async buildRepositoryInfo(
    remotes: GitRemote[],
    currentBranch?: string,
  ): Promise<RepositoryInfo> {
    return {
      kind: this.kind,
      rootPath: this.rootPath,
      name: basename(this.rootPath),
      remotes,
      currentBranch,
    };
  }

  private async resolveComparison(options: StartupOptions): Promise<ResolvedComparison> {
    const currentBranch = await this.getCurrentBranch();
    const head = options.head ?? currentBranch ?? "HEAD";
    const base = options.base ?? (await this.selectDefaultBaseRef());

    if (base == null) {
      throw new DiffdiffError(
        "Unable to determine a base branch. Pass --base or set DIFFDIFF_BASE.",
      );
    }

    let mergeBase: string | undefined;
    try {
      mergeBase = (
        await runCommand("git", ["merge-base", base, head], { cwd: this.rootPath })
      ).trim();
    } catch {
      mergeBase = undefined;
    }

    return {
      currentBranch,
      comparison: {
        base,
        head,
        mergeBase,
        mode: "range",
        range: `${base}...${head}`,
        usesMergeBase: true,
      },
    };
  }

  private async resolveWorkingTreeComparison(): Promise<ResolvedComparison> {
    const currentBranch = await this.getCurrentBranch();

    return {
      currentBranch,
      comparison: {
        base: EMPTY_TREE_LABEL,
        head: WORKING_TREE_LABEL,
        mergeBase: undefined,
        mode: "working-tree",
        range: `${EMPTY_TREE_LABEL}...${WORKING_TREE_LABEL}`,
        usesMergeBase: false,
      },
    };
  }

  private async hasCommitHistory(): Promise<boolean> {
    return this.hasRef("HEAD^{commit}");
  }

  private async selectDefaultBaseRef(): Promise<string | undefined> {
    const candidates = ["main", "master", "origin/main", "origin/master"];
    for (const candidate of candidates) {
      if (await this.hasRef(candidate)) {
        return candidate;
      }
    }

    const originHead = await this.getOriginHead();
    if (originHead != null) {
      return originHead;
    }

    return undefined;
  }

  private async hasRef(ref: string): Promise<boolean> {
    try {
      await runCommand("git", ["rev-parse", "--verify", ref], { cwd: this.rootPath });
      return true;
    } catch {
      return false;
    }
  }

  private async getOriginHead(): Promise<string | undefined> {
    try {
      const symbolicRef = (
        await runCommand("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], {
          cwd: this.rootPath,
        })
      ).trim();

      return symbolicRef.replace(/^refs\/remotes\//u, "");
    } catch {
      return undefined;
    }
  }

  private async getCurrentBranch(): Promise<string | undefined> {
    const branch = (
      await runCommand("git", ["branch", "--show-current"], { cwd: this.rootPath })
    ).trim();
    return branch === "" ? undefined : branch;
  }

  private async listRemotes(): Promise<GitRemote[]> {
    const stdout = await runCommand("git", ["remote"], { cwd: this.rootPath });
    const remoteNames = stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line !== "");

    const remotes: GitRemote[] = [];

    for (const remoteName of remoteNames) {
      const fetchUrl = (
        await runCommand("git", ["remote", "get-url", remoteName], { cwd: this.rootPath })
      ).trim();
      remotes.push({
        name: remoteName,
        fetchUrl,
        forge: parseGitHubRemote(fetchUrl),
      });
    }

    return remotes;
  }

  private async listBranches(
    remotes: GitRemote[],
    currentBranch?: string,
  ): Promise<BranchCollection> {
    const localBranches = await this.listRefs("refs/heads", "local", remotes, currentBranch);
    const remoteBranches = await this.listRefs("refs/remotes", "remote", remotes, currentBranch);

    return {
      local: localBranches.sort((left, right) => left.name.localeCompare(right.name)),
      remote: remoteBranches,
    };
  }

  private async listRefs(
    prefix: string,
    kind: BranchInfo["kind"],
    remotes: GitRemote[],
    currentBranch?: string,
  ): Promise<BranchInfo[]> {
    const format = [
      "%(refname)",
      "%(refname:short)",
      "%(objectname)",
      "%(upstream:short)",
      "%(HEAD)",
      "%(symref)",
    ].join("%00");

    const stdout = await runCommand("git", ["for-each-ref", prefix, `--format=${format}`], {
      cwd: this.rootPath,
    });
    const remotesByName = new Map(remotes.map((remote) => [remote.name, remote]));
    const defaultBase = await this.selectDefaultBaseRef();

    return stdout
      .split(/\r?\n/u)
      .map((record) => record.trimEnd())
      .filter((record) => record !== "")
      .map((record) => {
        const [ref, name, sha, upstream, headMarker, symref] = record.split(FIELD_SEPARATOR);
        return { ref, name, sha, upstream, headMarker, symref };
      })
      .filter((record) => record.symref === "")
      .filter((record) => !record.name.endsWith("/HEAD"))
      .map((record) => {
        const remoteName = kind === "remote" ? record.name.split("/")[0] : undefined;
        const remote = remoteName == null ? undefined : remotesByName.get(remoteName);
        const isCurrent = kind === "local" && record.name === currentBranch;
        const remoteShortName =
          remoteName == null ? undefined : record.name.slice((remoteName.length ?? 0) + 1);
        const isDefault =
          record.name === defaultBase ||
          (remoteShortName != null &&
            (remoteShortName === defaultBase ||
              `${remoteName}/${remoteShortName}` === defaultBase));

        return {
          kind,
          name: record.name,
          ref: record.ref,
          sha: record.sha,
          upstream: record.upstream || undefined,
          remoteName,
          isCurrent: isCurrent || record.headMarker === "*",
          isDefault,
          pullRequest: undefined,
          remote,
        };
      })
      .map(({ remote: _remote, ...branch }) => branch);
  }

  private async enrichRemoteBranches(
    branches: BranchCollection,
    remotes: GitRemote[],
    forgeProviders: ForgeMetadataProvider[],
    warnings: ReviewWarning[],
  ): Promise<BranchCollection> {
    const remotesByName = new Map(remotes.map((remote) => [remote.name, remote]));
    const remoteBranchesByRemote = new Map<string, BranchInfo[]>();

    for (const branch of branches.remote) {
      if (branch.remoteName == null) {
        continue;
      }

      const remoteBranches = remoteBranchesByRemote.get(branch.remoteName) ?? [];
      remoteBranches.push(branch);
      remoteBranchesByRemote.set(branch.remoteName, remoteBranches);
    }

    const enrichedRemoteBranches: BranchInfo[] = [];

    for (const [remoteName, remoteBranches] of remoteBranchesByRemote) {
      const remote = remotesByName.get(remoteName);
      if (remote == null) {
        enrichedRemoteBranches.push(...remoteBranches);
        continue;
      }

      let enrichedBranches = remoteBranches;

      for (const forgeProvider of forgeProviders) {
        if (!forgeProvider.supports(remote)) {
          continue;
        }

        const result = await forgeProvider.enrichBranches({
          repositoryRoot: this.rootPath,
          remote,
          branches: enrichedBranches,
        });

        enrichedBranches = result.branches;
        warnings.push(...result.warnings);
      }

      enrichedRemoteBranches.push(...enrichedBranches);
    }

    return {
      local: branches.local,
      remote: prioritizeRemoteBranches(enrichedRemoteBranches),
    };
  }

  private async listChangedFiles(range: string): Promise<ChangedFile[]> {
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
      { cwd: this.rootPath },
    );

    return splitPatchIntoFiles(patch).map((filePatch) => parseChangedFilePatch(filePatch));
  }

  private async listWorkingTreeChanges(): Promise<ChangedFile[]> {
    const stdout = await runCommand(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
      { cwd: this.rootPath },
    );

    const paths = [...new Set(parsePorcelainStatusEntries(stdout).map((entry) => entry.path))];
    const changedFiles: ChangedFile[] = [];

    for (const path of paths) {
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
          cwd: this.rootPath,
        },
      );

      changedFiles.push(parseChangedFilePatch(patch));
    }

    return changedFiles;
  }
}

function parsePorcelainStatusEntries(stdout: string): StatusEntry[] {
  const entries: StatusEntry[] = [];
  let offset = 0;

  while (offset < stdout.length) {
    const status = stdout.slice(offset, offset + 2);
    if (status.length < 2) {
      break;
    }

    offset += 3;
    const pathEnd = stdout.indexOf(FIELD_SEPARATOR, offset);
    if (pathEnd === -1) {
      break;
    }

    const firstPath = stdout.slice(offset, pathEnd);
    offset = pathEnd + 1;

    if (status.startsWith("R") || status.startsWith("C")) {
      const renamedPathEnd = stdout.indexOf(FIELD_SEPARATOR, offset);
      if (renamedPathEnd === -1) {
        break;
      }

      entries.push({
        status,
        path: stdout.slice(offset, renamedPathEnd),
        originalPath: firstPath,
      });
      offset = renamedPathEnd + 1;
      continue;
    }

    entries.push({ status, path: firstPath });
  }

  return entries;
}

function splitPatchIntoFiles(patch: string): string[] {
  const matches = [...patch.matchAll(/^diff --git .*$/gmu)];
  if (matches.length === 0) {
    return [];
  }

  const sections: string[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    const nextMatch = matches[index + 1];
    const end = nextMatch?.index ?? patch.length;
    sections.push(patch.slice(start, end).trimEnd());
  }

  return sections;
}

function parseChangedFilePatch(patch: string): ChangedFile {
  const lines = patch.split(/\r?\n/u);
  const header = lines[0] ?? "";
  const headerMatch = /^diff --git a\/(.+) b\/(.+)$/u.exec(header);

  const renameFrom = findPatchValue(lines, "rename from ");
  const renameTo = findPatchValue(lines, "rename to ");
  const isAdded = lines.some((line) => line.startsWith("new file mode "));
  const isDeleted = lines.some((line) => line.startsWith("deleted file mode "));
  const isBinary = lines.some((line) => line.startsWith("Binary files "));
  const path = renameTo ?? headerMatch?.[2];
  const previousPath = renameFrom ?? (renameTo != null ? headerMatch?.[1] : undefined);

  if (path == null) {
    throw new DiffdiffError("Unable to parse git diff output for changed files.");
  }

  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      continue;
    }

    if (line.startsWith("+")) {
      additions += 1;
      continue;
    }

    if (line.startsWith("-")) {
      deletions += 1;
    }
  }

  return {
    path,
    previousPath,
    status:
      renameFrom != null && renameTo != null
        ? "renamed"
        : isAdded
          ? "added"
          : isDeleted
            ? "deleted"
            : "modified",
    additions,
    deletions,
    isBinary,
    patch,
  };
}

function findPatchValue(lines: readonly string[], prefix: string): string | undefined {
  return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length);
}

export function getRepositorySearchPath(startPath?: string): string {
  if (startPath == null || startPath.trim() === "") {
    return process.cwd();
  }

  return startPath.startsWith("/")
    ? startPath
    : dirname(new URL(`file://${process.cwd()}/${startPath}`).pathname);
}

export { parseChangedFilePatch, parsePorcelainStatusEntries, splitPatchIntoFiles };
