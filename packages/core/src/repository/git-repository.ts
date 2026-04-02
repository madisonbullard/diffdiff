import { basename } from "node:path";
import { runCommand } from "../command.ts";
import { DiffdiffError } from "../errors.ts";
import { parseGitHubRemote } from "../github/index.ts";
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
    return {
      repository,
      comparison: resolvedComparison.comparison,
      files,
      commits,
      branches: enrichedBranches,
      workingTreeSummary,
      warnings,
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
      currentBranch,
      defaultBranch,
    };
  }

  private async resolveComparison(options: StartupOptions): Promise<ResolvedComparison> {
    const currentBranch = await this.getCurrentBranch();
    const defaultBranch = await this.selectDefaultBaseRef();
    const head = options.head ?? currentBranch ?? "HEAD";
    const base = options.base ?? defaultBranch;

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
      defaultBranch,
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

  private async resolveWorkingTreeComparison(base: string): Promise<ResolvedComparison> {
    const currentBranch = await this.getCurrentBranch();
    const defaultBranch = base === EMPTY_TREE_LABEL ? undefined : await this.selectDefaultBaseRef();

    return {
      currentBranch,
      defaultBranch,
      comparison: {
        base,
        head: WORKING_TREE_LABEL,
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
}
