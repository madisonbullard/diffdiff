import type {
  BranchInfo,
  ChangeSummary,
  ChangedFile,
  ComparisonCommit,
  ComparisonInfo,
  GitHubDashboardPullRequest,
} from "@madisonbullard/diffdiff-core";
import type {
  BranchListFilters,
  BranchListItem,
  CommitListItem,
  DiffView,
  DiffViewPreference,
  FileTreeNode,
  TextSegment,
} from "./types.ts";

export const MIN_SIDE_BY_SIDE_DIFF_WIDTH = 121;
export const FILE_TREE_SIDEBAR_MIN_WIDTH = 30;
export const FILE_TREE_SIDEBAR_MAX_WIDTH = 45;

export const DEFAULT_BRANCH_LIST_FILTERS: BranchListFilters = {
  workingTree: true,
  localBranch: true,
  openPr: true,
  remoteBranch: false,
};

export function getVisibleRemoteBranches(
  branches: readonly BranchInfo[],
  comparison: ComparisonInfo,
  showAll: boolean,
): BranchInfo[] {
  if (showAll) {
    return [...branches];
  }

  return branches.filter((branch) => {
    return (
      branch.pullRequest != null ||
      branch.name === comparison.base ||
      branch.name === comparison.head ||
      branch.isDefault
    );
  });
}

export function buildBranchListItems({
  filters,
  localBranches,
  remoteBranches,
  workingTreeSummary,
}: {
  filters: BranchListFilters;
  localBranches: readonly BranchInfo[];
  remoteBranches: readonly BranchInfo[];
  workingTreeSummary: ChangeSummary;
}): BranchListItem[] {
  const items: BranchListItem[] = [];

  if (filters.workingTree) {
    items.push({
      key: "working-tree",
      kind: "working-tree",
      summary: workingTreeSummary,
    });
  }

  if (filters.openPr) {
    items.push(
      ...remoteBranches
        .filter((branch) => branch.pullRequest != null)
        .map((branch) => ({
          key: `pr:${branch.ref}`,
          kind: "open-pr" as const,
          branch,
        })),
    );
  }

  if (filters.localBranch) {
    items.push(
      ...localBranches.map((branch) => ({
        key: `local:${branch.ref}`,
        kind: "local-branch" as const,
        branch,
      })),
    );
  }

  if (filters.remoteBranch) {
    items.push(
      ...remoteBranches
        .filter((branch) => branch.pullRequest == null)
        .map((branch) => ({
          key: `remote:${branch.ref}`,
          kind: "remote-branch" as const,
          branch,
        })),
    );
  }

  return items;
}

export function buildCommitListItems(commits: readonly ComparisonCommit[]): CommitListItem[] {
  return commits.map((commit) => ({
    key: commit.sha,
    commit,
  }));
}

export function filterCommitListItems(
  items: readonly CommitListItem[],
  query: string,
): CommitListItem[] {
  if (query === "") {
    return [...items];
  }

  return items.filter((item) => fuzzyMatch(query, item.commit.subject));
}

export function filterPullRequests(
  items: readonly GitHubDashboardPullRequest[],
  query: string,
): GitHubDashboardPullRequest[] {
  if (query === "") {
    return [...items];
  }

  return items.filter((pullRequest) => {
    return fuzzyMatch(
      query,
      `${pullRequest.repository.owner}/${pullRequest.repository.repo} ${pullRequest.title} ${pullRequest.author.login}`,
    );
  });
}

/**
 * Case-insensitive fuzzy match: every character of `query` must appear
 * in `target` in order, but not necessarily contiguously.
 */
function fuzzyMatch(query: string, target: string): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  let qi = 0;

  for (let ti = 0; ti < lowerTarget.length && qi < lowerQuery.length; ti++) {
    if (lowerTarget[ti] === lowerQuery[qi]) {
      qi++;
    }
  }

  return qi === lowerQuery.length;
}

export function formatCommitListEntry(commit: ComparisonCommit): string {
  const decoration = commit.decoration == null ? "" : ` (${commit.decoration})`;
  const subject = commit.subject === "" ? "" : ` ${commit.subject}`;
  return `${commit.shortSha}${decoration}${subject}`;
}

export function findInitialBranchListSelection({
  comparison,
  currentBranch,
  items,
}: {
  comparison: ComparisonInfo;
  currentBranch?: string;
  items: readonly BranchListItem[];
}): number {
  if (comparison.mode === "working-tree") {
    const workingTreeIndex = items.findIndex((item) => item.kind === "working-tree");
    if (workingTreeIndex >= 0) {
      return workingTreeIndex;
    }
  }

  const matchingIndex = items.findIndex((item) => {
    if (item.branch == null) {
      return false;
    }

    return (
      item.branch.name === comparison.head ||
      item.branch.name === comparison.base ||
      item.branch.isCurrent ||
      item.branch.name === currentBranch
    );
  });

  return matchingIndex >= 0 ? matchingIndex : 0;
}

export function formatAuthorList(authors: readonly string[], maxAuthors = 2): string {
  if (authors.length === 0) {
    return "No unique commits";
  }

  if (authors.length <= maxAuthors) {
    return authors.join(", ");
  }

  return `${authors.slice(0, maxAuthors).join(", ")} +${authors.length - maxAuthors}`;
}

export function formatCommitDelta(count: number, comparedTo: string): string {
  const commitLabel = count === 1 ? "commit" : "commits";
  return `${count} ${commitLabel} vs ${comparedTo}`;
}

export function formatChangeSummary(summary: ChangeSummary): string {
  const fileLabel = summary.filesChanged === 1 ? "file" : "files";
  return `${summary.filesChanged} ${fileLabel}  \u2502  +${summary.additions}/-${summary.deletions}`;
}

export function clampIndex(index: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, size - 1));
}

export function getTopIntersectingFileIndex(
  itemOffsets: readonly number[],
  viewportTop: number,
): number {
  if (itemOffsets.length === 0) {
    return 0;
  }

  let activeIndex = 0;

  for (const [index, offset] of itemOffsets.entries()) {
    if (offset > viewportTop) {
      break;
    }

    activeIndex = index;
  }

  return activeIndex;
}

/**
 * Sort files into the order they appear in the file tree: directories first
 * (alphabetical), then files (alphabetical), recursively at each level.
 * The diff pane should use this sorted array so its top-to-bottom order
 * matches the tree sidebar.
 */
export function sortFilesInTreeOrder<T extends { path: string }>(files: readonly T[]): T[] {
  interface DirectoryBucket {
    name: string;
    directories: Map<string, DirectoryBucket>;
    files: T[];
  }

  const root: DirectoryBucket = { name: "", directories: new Map(), files: [] };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (fileName == null) {
      continue;
    }

    let bucket = root;
    for (const part of parts) {
      let next = bucket.directories.get(part);
      if (next == null) {
        next = { name: part, directories: new Map(), files: [] };
        bucket.directories.set(part, next);
      }
      bucket = next;
    }

    bucket.files.push(file);
  }

  const sorted: T[] = [];

  function collect(bucket: DirectoryBucket): void {
    const childDirs = Array.from(bucket.directories.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const childFiles = [...bucket.files].sort((a, b) => a.path.localeCompare(b.path));

    for (const dir of childDirs) {
      collect(dir);
    }

    for (const file of childFiles) {
      sorted.push(file);
    }
  }

  collect(root);
  return sorted;
}

export function buildFileTreeNodes(files: readonly ChangedFile[]): FileTreeNode[] {
  interface DirectoryBuilder {
    path: string;
    name: string;
    parentPath?: string;
    directories: Map<string, DirectoryBuilder>;
    fileCount: number;
    files: Array<{ file: ChangedFile; fileIndex: number }>;
  }

  const root: DirectoryBuilder = {
    path: "",
    name: "",
    parentPath: undefined,
    directories: new Map(),
    fileCount: 0,
    files: [],
  };

  for (const [fileIndex, file] of files.entries()) {
    const parts = file.path.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (fileName == null) {
      continue;
    }

    let directory = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath === "" ? part : `${currentPath}/${part}`;
      let nextDirectory = directory.directories.get(part);
      if (nextDirectory == null) {
        nextDirectory = {
          path: currentPath,
          name: part,
          parentPath: directory.path === "" ? undefined : directory.path,
          directories: new Map(),
          fileCount: 0,
          files: [],
        };
        directory.directories.set(part, nextDirectory);
      }
      // Keep descendant counts incrementally so the tree renderer does not have to recursively
      // recount every directory on each rebuild.
      nextDirectory.fileCount += 1;
      directory = nextDirectory;
    }

    directory.files.push({ file, fileIndex });
  }

  const nodes: FileTreeNode[] = [];

  function emitDirectory(
    directory: DirectoryBuilder,
    depth: number,
    ancestorPaths: string[],
  ): void {
    const childDirectories = Array.from(directory.directories.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    const childFiles = [...directory.files].sort((left, right) =>
      left.file.path.localeCompare(right.file.path),
    );

    nodes.push({
      kind: "directory",
      path: directory.path,
      name: directory.name,
      depth,
      parentPath: directory.parentPath,
      ancestorPaths: ancestorPaths.filter(Boolean),
      fileCount: directory.fileCount,
    });

    for (const childDirectory of childDirectories) {
      emitDirectory(childDirectory, depth + 1, [...ancestorPaths, directory.path]);
    }

    for (const { file, fileIndex } of childFiles) {
      const fileName = file.path.split("/").pop() ?? file.path;
      nodes.push({
        kind: "file",
        path: file.path,
        name: fileName,
        depth: depth + 1,
        parentPath: directory.path,
        ancestorPaths: [...ancestorPaths, directory.path].filter(Boolean),
        fileIndex,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
      });
    }
  }

  const rootDirectories = Array.from(root.directories.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const rootFiles = [...root.files].sort((left, right) =>
    left.file.path.localeCompare(right.file.path),
  );

  for (const directory of rootDirectories) {
    emitDirectory(directory, 0, []);
  }

  for (const { file, fileIndex } of rootFiles) {
    nodes.push({
      kind: "file",
      path: file.path,
      name: file.path,
      depth: 0,
      parentPath: undefined,
      ancestorPaths: [],
      fileIndex,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
    });
  }

  return nodes;
}

export function getVisibleFileTreeNodes(
  nodes: readonly FileTreeNode[],
  collapsedDirectories: ReadonlySet<string>,
): FileTreeNode[] {
  return nodes.filter((node) => !node.ancestorPaths.some((path) => collapsedDirectories.has(path)));
}

export function getFileTreeSidebarWidth(terminalWidth: number): number {
  return Math.max(
    FILE_TREE_SIDEBAR_MIN_WIDTH,
    Math.min(Math.floor(terminalWidth * 0.3), FILE_TREE_SIDEBAR_MAX_WIDTH),
  );
}

export function getDiffPaneWidth(terminalWidth: number, sidebarWidth: number): number {
  return Math.max(terminalWidth - sidebarWidth - 4, 0);
}

export function resolveDiffView(preference: DiffViewPreference, terminalWidth: number): DiffView {
  if (preference === "side-by-side" && terminalWidth >= MIN_SIDE_BY_SIDE_DIFF_WIDTH) {
    return "split";
  }

  return "unified";
}

export function getDiffViewLabel(view: DiffView): string {
  return view === "split" ? "side-by-side" : "unified";
}

export function truncateSegments(
  segments: readonly TextSegment[],
  maxWidth: number,
): TextSegment[] {
  if (maxWidth <= 0) {
    return [];
  }

  const result: TextSegment[] = [];
  let remaining = maxWidth;

  for (const segment of segments) {
    if (remaining <= 0) {
      break;
    }

    const normalizedText = segment.text.replace(/\t/gu, "  ");
    const truncatedText =
      normalizedText.length > remaining ? normalizedText.slice(0, remaining) : normalizedText;

    if (truncatedText.length === 0) {
      continue;
    }

    result.push({
      ...segment,
      text: truncatedText,
    });

    remaining -= truncatedText.length;
  }

  return result;
}
