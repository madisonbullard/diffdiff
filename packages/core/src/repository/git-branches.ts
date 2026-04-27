import { runCommand } from "../command.ts";
import { prioritizeRemoteBranches } from "../github/index.ts";
import type { GitRemote } from "../types/github.ts";
import type { ForgeMetadataProvider } from "../types/providers.ts";
import type {
  BranchCollection,
  BranchInfo,
  BranchSummary,
  ComparisonCommit,
  ComparisonInfo,
  ReviewWarning,
} from "../types/session.ts";
import { parseNumstatSummary } from "./patch.ts";

const FIELD_SEPARATOR = "\u0000";
const EMPTY_TREE_LABEL = "(empty tree)";

export async function listBranches(
  rootPath: string,
  currentBranch?: string,
  defaultBranch?: string,
): Promise<BranchCollection> {
  const localBranches = await listRefs(
    rootPath,
    "refs/heads",
    "local",
    currentBranch,
    defaultBranch,
  );
  const remoteBranches = await listRefs(
    rootPath,
    "refs/remotes",
    "remote",
    currentBranch,
    defaultBranch,
  );

  return {
    local: localBranches.sort((left, right) => left.name.localeCompare(right.name)),
    remote: remoteBranches,
  };
}

export async function enrichRemoteBranches(
  rootPath: string,
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
        repositoryRoot: rootPath,
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

export async function enrichBranchSummaries(
  rootPath: string,
  branches: BranchCollection,
  defaultBranch?: string,
): Promise<BranchCollection> {
  if (defaultBranch == null) {
    return branches;
  }

  return {
    local: await Promise.all(
      branches.local.map((branch) => attachBranchSummary(rootPath, branch, defaultBranch)),
    ),
    // Remote branch summaries require two git commands per branch. Deferring them keeps
    // startup responsive on repositories with lots of open PR refs while preserving the
    // richer local-branch summaries most people use to change the base/head selection.
    remote: branches.remote,
  };
}

export async function listComparisonCommits(
  rootPath: string,
  comparison: ComparisonInfo,
): Promise<ComparisonCommit[]> {
  if (comparison.mode === "working-tree" && comparison.base === EMPTY_TREE_LABEL) {
    return [];
  }

  const logRange =
    comparison.mode === "working-tree" ? comparison.base : `${comparison.base}..${comparison.head}`;

  const stdout = await runCommand(
    "git",
    ["log", "--decorate=short", "--format=%H%x00%h%x00%D%x00%s%x00%an", logRange],
    { cwd: rootPath },
  );

  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      const [
        sha = "",
        shortSha = sha.slice(0, 7),
        decoration = "",
        subject = "",
        author = "Unknown author",
      ] = line.split(FIELD_SEPARATOR);

      return {
        sha,
        shortSha,
        decoration: decoration === "" ? undefined : decoration,
        subject,
        author,
      } satisfies ComparisonCommit;
    });
}

async function listRefs(
  rootPath: string,
  prefix: string,
  kind: BranchInfo["kind"],
  currentBranch?: string,
  defaultBase?: string,
): Promise<BranchInfo[]> {
  const format = [
    "%(refname)",
    "%(refname:short)",
    "%(objectname)",
    "%(upstream:short)",
    "%(HEAD)",
    "%(symref)",
    "%(authorname)",
  ].join("%00");

  const stdout = await runCommand("git", ["for-each-ref", prefix, `--format=${format}`], {
    cwd: rootPath,
  });

  return stdout
    .split(/\r?\n/u)
    .map((record) => record.trimEnd())
    .filter((record) => record !== "")
    .map((record) => {
      const [ref, name, sha, upstream, headMarker, symref, authorName] =
        record.split(FIELD_SEPARATOR);
      return { ref, name, sha, upstream, headMarker, symref, authorName };
    })
    .filter((record) => record.symref === "")
    .filter((record) => !record.name.endsWith("/HEAD"))
    .map((record) => {
      const remoteName = kind === "remote" ? record.name.split("/")[0] : undefined;
      const isCurrent = kind === "local" && record.name === currentBranch;
      const remoteShortName =
        remoteName == null ? undefined : record.name.slice((remoteName.length ?? 0) + 1);
      const isDefault =
        record.name === defaultBase ||
        (remoteShortName != null &&
          (remoteShortName === defaultBase || `${remoteName}/${remoteShortName}` === defaultBase));

      return {
        kind,
        name: record.name,
        ref: record.ref,
        sha: record.sha,
        upstream: record.upstream || undefined,
        remoteName,
        isCurrent: isCurrent || record.headMarker === "*",
        isDefault,
        tipAuthor: record.authorName || undefined,
        pullRequest: undefined,
      };
    });
}

async function attachBranchSummary(
  rootPath: string,
  branch: BranchInfo,
  defaultBranch: string,
): Promise<BranchInfo> {
  const summary = await buildBranchSummary(
    rootPath,
    branch.name,
    defaultBranch,
    branch.tipAuthor,
  ).catch(() => undefined);
  return { ...branch, summary };
}

async function buildBranchSummary(
  rootPath: string,
  branchName: string,
  defaultBranch: string,
  tipAuthor?: string,
): Promise<BranchSummary> {
  const stdout = await runCommand(
    "git",
    ["log", "--format=%an", `${defaultBranch}..${branchName}`],
    {
      cwd: rootPath,
    },
  );
  const commitAuthors = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const authors = [...new Set(commitAuthors)];
  const changeSummary = await summarizeDiffRange(rootPath, `${defaultBranch}...${branchName}`);

  return {
    comparedTo: defaultBranch,
    commitCount: commitAuthors.length,
    authors: authors.length > 0 ? authors : tipAuthor != null ? [tipAuthor] : [],
    ...changeSummary,
  };
}

async function summarizeDiffRange(rootPath: string, range: string) {
  const stdout = await runCommand(
    "git",
    ["diff", "--numstat", "--find-renames", "--find-copies", range],
    { cwd: rootPath },
  );

  return parseNumstatSummary(stdout);
}
