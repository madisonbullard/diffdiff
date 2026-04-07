import { basename, dirname } from "node:path";
import { runCommand } from "../command.ts";
import { DiffdiffError } from "../errors.ts";
import { parseGitHubRemote, selectCurrentForgeRepository } from "../github/index.ts";
import { logDiffdiffInfo } from "../logging.ts";
import { buildReviewSessionFingerprint } from "../review-session-fingerprint.ts";
import type { GitRemote } from "../types/github.ts";
import type {
  ForgeMetadataProvider,
  RepositoryHandle,
  RepositoryProvider,
} from "../types/providers.ts";
import type {
  ComparisonInfo,
  RepositoryInfo,
  ReviewSession,
  ReviewWarning,
} from "../types/session.ts";
import type { StartupOptions } from "../types/startup.ts";
import {
  enrichBranchSummaries,
  enrichRemoteBranches,
  listBranches,
  listComparisonCommits,
} from "./git-branches.ts";
import {
  listChangedFiles,
  listWorkingTreeChanges,
  summarizeWorkingTreeChanges,
} from "./git-diff.ts";
import { summarizeChangedFiles } from "./patch.ts";

const EMPTY_TREE_LABEL = "(empty tree)";
const WORKING_TREE_LABEL = "working tree";

interface ResolvedComparison {
  comparison: ComparisonInfo;
  currentBranch?: string;
  defaultBranch?: string;
}

export class GitRepositoryProvider implements RepositoryProvider {
  readonly kind = "git";

  async detectRepository(startPath: string): Promise<RepositoryHandle | null> {
    const candidatePaths = [startPath, dirname(startPath)].filter(
      (candidatePath, index, values) => values.indexOf(candidatePath) === index,
    );

    for (const candidatePath of candidatePaths) {
      try {
        const rootPath = (
          await runCommand("git", ["rev-parse", "--show-toplevel"], { cwd: candidatePath })
        ).trim();
        return new GitRepository(rootPath);
      } catch {
        continue;
      }
    }

    return null;
  }
}

export async function syncGitRemotes(rootPath: string): Promise<string[]> {
  const remoteNames = await listGitRemoteNames(rootPath);

  for (const remoteName of remoteNames) {
    await runCommand("git", ["fetch", "--prune", remoteName], { cwd: rootPath });
  }

  return remoteNames;
}

export async function ensureComparisonRefsAvailable(
  rootPath: string,
  options: StartupOptions,
  reportProgress?: (message: string) => void,
): Promise<StartupOptions> {
  if (options.base == null && options.head == null) {
    return options;
  }

  const remoteNames = prioritizeRemoteNames(await listGitRemoteNames(rootPath));
  if (remoteNames.length === 0) {
    return options;
  }

  const resolutionCache = new Map<string, Promise<string | undefined>>();
  const resolveRef = async (
    ref: string | undefined,
    target: "base" | "head",
  ): Promise<string | undefined> => {
    if (ref == null || ref === "") {
      return ref;
    }

    let resolutionPromise = resolutionCache.get(ref);
    if (resolutionPromise == null) {
      resolutionPromise = resolveComparisonRef(rootPath, remoteNames, ref, target, reportProgress);
      resolutionCache.set(ref, resolutionPromise);
    }

    return resolutionPromise;
  };

  const [base, head] = await Promise.all([
    resolveRef(options.base, "base"),
    resolveRef(options.head, "head"),
  ]);

  if (base === options.base && head === options.head) {
    return options;
  }

  return {
    ...options,
    base,
    head,
  };
}

class GitRepository implements RepositoryHandle {
  readonly kind = "git";

  constructor(readonly rootPath: string) {}

  async loadReviewSession(
    options: StartupOptions,
    forgeProviders: ForgeMetadataProvider[],
  ): Promise<ReviewSession> {
    const startedAt = Date.now();
    const warnings: ReviewWarning[] = [];
    const hasCommitHistory = await this.hasCommitHistory();
    const resolvedComparison = !hasCommitHistory
      ? await this.resolveWorkingTreeComparison(EMPTY_TREE_LABEL)
      : options.base == null && options.head == null
        ? await this.resolveWorkingTreeComparison("HEAD")
        : await this.resolveComparison(options);

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

    const filesPromise =
      resolvedComparison.comparison.mode === "working-tree"
        ? listWorkingTreeChanges(this.rootPath, resolvedComparison.comparison.base)
        : listChangedFiles(this.rootPath, resolvedComparison.comparison.range);
    const workingTreeSummaryPromise =
      resolvedComparison.comparison.mode === "working-tree"
        ? filesPromise.then((files) => summarizeChangedFiles(files))
        : summarizeWorkingTreeChanges(this.rootPath, hasCommitHistory ? "HEAD" : EMPTY_TREE_LABEL);
    const [remotes, files, workingTreeSummary, branches, commits] = await Promise.all([
      this.listRemotes(),
      filesPromise,
      workingTreeSummaryPromise,
      listBranches(
        this.rootPath,
        resolvedComparison.currentBranch,
        resolvedComparison.defaultBranch,
      ),
      listComparisonCommits(this.rootPath, resolvedComparison.comparison),
    ]);
    logDiffdiffInfo("session", "git_review_session_components_loaded", {
      commitCount: commits.length,
      durationMs: Date.now() - startedAt,
      fileCount: files.length,
      largestFilePatchBytes: files.reduce(
        (maxPatchBytes, file) => Math.max(maxPatchBytes, Buffer.byteLength(file.patch, "utf8")),
        0,
      ),
      localBranchCount: branches.local.length,
      remoteBranchCount: branches.remote.length,
      remoteCount: remotes.length,
      workingTreeSummary,
    });
    const repository = this.buildRepositoryInfo(
      remotes,
      resolvedComparison.currentBranch,
      resolvedComparison.defaultBranch,
    );
    const enrichedRemoteBranches = await enrichRemoteBranches(
      this.rootPath,
      branches,
      remotes,
      forgeProviders,
      warnings,
    );
    const enrichedBranches = await enrichBranchSummaries(
      this.rootPath,
      enrichedRemoteBranches,
      resolvedComparison.defaultBranch,
    );
    const session: ReviewSession = {
      repository,
      comparison: resolvedComparison.comparison,
      files,
      commits,
      branches: enrichedBranches,
      workingTreeSummary,
      renderFingerprint: {
        comparisonMode: resolvedComparison.comparison.mode,
        baseRef: resolvedComparison.comparison.base,
        headRef: resolvedComparison.comparison.head,
        fileCount: 0,
        patchDigest: "",
      },
      warnings,
    };

    return {
      ...session,
      renderFingerprint: buildReviewSessionFingerprint(session),
    };
  }

  private buildRepositoryInfo(
    remotes: GitRemote[],
    currentBranch?: string,
    defaultBranch?: string,
  ): RepositoryInfo {
    return {
      kind: this.kind,
      rootPath: this.rootPath,
      name: basename(this.rootPath),
      remotes,
      currentForgeRepository: selectCurrentForgeRepository(remotes),
      currentBranch,
      defaultBranch,
    };
  }

  private async resolveComparison(options: StartupOptions): Promise<ResolvedComparison> {
    const resolvedOptions = await ensureComparisonRefsAvailable(this.rootPath, options);
    const currentBranch = await this.getCurrentBranch();
    const defaultBranch = await this.selectDefaultBaseRef();
    const head = resolvedOptions.head ?? currentBranch ?? "HEAD";
    const base = resolvedOptions.base ?? defaultBranch;

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

    const [baseSha, headSha] = await Promise.all([
      this.resolveRefSha(base),
      this.resolveRefSha(head),
    ]);

    if (baseSha == null || headSha == null) {
      throw new DiffdiffError(buildMissingComparisonRefMessage(base, head, baseSha, headSha));
    }

    return {
      currentBranch,
      defaultBranch,
      comparison: {
        base,
        baseSha,
        head,
        headSha,
        mergeBase,
        mode: "range",
        range: `${base}...${head}`,
        usesMergeBase: true,
      },
    };
  }

  private async resolveWorkingTreeComparison(base: string): Promise<ResolvedComparison> {
    const currentBranch = await this.getCurrentBranch();
    const defaultBranch = base === EMPTY_TREE_LABEL ? undefined : await this.selectDefaultBaseRef();
    const [baseSha, headSha] = await Promise.all([
      base === EMPTY_TREE_LABEL ? Promise.resolve(undefined) : this.resolveRefSha(base),
      this.resolveRefSha("HEAD"),
    ]);

    return {
      currentBranch,
      defaultBranch,
      comparison: {
        base,
        baseSha,
        head: WORKING_TREE_LABEL,
        headSha,
        mergeBase: undefined,
        mode: "working-tree",
        range: `${base}...${WORKING_TREE_LABEL}`,
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

    return this.getOriginHead();
  }

  private async hasRef(ref: string): Promise<boolean> {
    try {
      await runCommand("git", ["rev-parse", "--verify", ref], { cwd: this.rootPath });
      return true;
    } catch {
      return false;
    }
  }

  private async resolveRefSha(ref: string): Promise<string | undefined> {
    try {
      return (
        await runCommand("git", ["rev-parse", "--verify", ref], { cwd: this.rootPath })
      ).trim();
    } catch {
      return undefined;
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
    const remoteNames = await listGitRemoteNames(this.rootPath);

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
}

async function listGitRemoteNames(rootPath: string): Promise<string[]> {
  const stdout = await runCommand("git", ["remote"], { cwd: rootPath });

  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

async function resolveComparisonRef(
  rootPath: string,
  remoteNames: readonly string[],
  ref: string,
  target: "base" | "head",
  reportProgress?: (message: string) => void,
): Promise<string> {
  if (await hasGitRef(rootPath, ref)) {
    return ref;
  }

  const remoteQualifiedRef = parseRemoteQualifiedRef(ref, remoteNames);
  if (remoteQualifiedRef != null) {
    const remoteTrackingRef = `${remoteQualifiedRef.remoteName}/${remoteQualifiedRef.branchName}`;
    if (
      !(await remoteHasBranch(
        rootPath,
        remoteQualifiedRef.remoteName,
        remoteQualifiedRef.branchName,
      ))
    ) {
      return ref;
    }

    await fetchRemoteBranch(
      rootPath,
      remoteQualifiedRef.remoteName,
      remoteQualifiedRef.branchName,
      ref,
      target,
      reportProgress,
    );
    return remoteTrackingRef;
  }

  for (const remoteName of remoteNames) {
    if (!(await remoteHasBranch(rootPath, remoteName, ref))) {
      continue;
    }

    const remoteTrackingRef = `${remoteName}/${ref}`;
    await fetchRemoteBranch(rootPath, remoteName, ref, ref, target, reportProgress);
    return remoteTrackingRef;
  }

  return ref;
}

async function fetchRemoteBranch(
  rootPath: string,
  remoteName: string,
  branchName: string,
  originalRef: string,
  target: "base" | "head",
  reportProgress?: (message: string) => void,
): Promise<void> {
  const remoteTrackingRef = `${remoteName}/${branchName}`;
  const refspec = `+refs/heads/${branchName}:refs/remotes/${remoteTrackingRef}`;

  reportProgress?.(`Fetching missing --${target} ref '${originalRef}' from ${remoteName}...`);
  reportProgress?.(`$ git fetch --prune --progress ${remoteName} ${refspec}`);
  await runCommand("git", ["fetch", "--prune", "--progress", remoteName, refspec], {
    cwd: rootPath,
  });
  reportProgress?.(`Resolved --${target} to ${remoteTrackingRef}.`);
  logDiffdiffInfo("session", "comparison_ref_fetched", {
    originalRef,
    remoteName,
    remoteTrackingRef,
    rootPath,
    target,
  });
}

async function hasGitRef(rootPath: string, ref: string): Promise<boolean> {
  try {
    await runCommand("git", ["rev-parse", "--verify", ref], { cwd: rootPath });
    return true;
  } catch {
    return false;
  }
}

async function remoteHasBranch(
  rootPath: string,
  remoteName: string,
  branchName: string,
): Promise<boolean> {
  const stdout = await runCommand(
    "git",
    ["ls-remote", "--exit-code", "--heads", remoteName, `refs/heads/${branchName}`],
    {
      allowedExitCodes: [2],
      cwd: rootPath,
    },
  );

  return stdout.trim() !== "";
}

function parseRemoteQualifiedRef(
  ref: string,
  remoteNames: readonly string[],
): { branchName: string; remoteName: string } | undefined {
  for (const remoteName of remoteNames) {
    const prefix = `${remoteName}/`;
    if (!ref.startsWith(prefix)) {
      continue;
    }

    return {
      branchName: ref.slice(prefix.length),
      remoteName,
    };
  }

  return undefined;
}

function prioritizeRemoteNames(remoteNames: readonly string[]): string[] {
  return [...remoteNames].sort((left, right) => {
    if (left === right) {
      return 0;
    }

    if (left === "origin") {
      return -1;
    }

    if (right === "origin") {
      return 1;
    }

    return left.localeCompare(right);
  });
}

function buildMissingComparisonRefMessage(
  base: string,
  head: string,
  baseSha: string | undefined,
  headSha: string | undefined,
): string {
  const missingRefs = [
    baseSha == null ? `base ref '${base}'` : undefined,
    headSha == null ? `head ref '${head}'` : undefined,
  ].filter((value) => value != null);

  return `Unable to resolve ${missingRefs.join(" and ")}. Make sure each ref exists locally or on a configured remote.`;
}
