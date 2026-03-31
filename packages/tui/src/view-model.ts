import type { BranchInfo, ChangeSummary, ComparisonCommit, ComparisonInfo } from "@diffdiff/core";
import type {
  BranchListFilters,
  BranchListItem,
  CommitListItem,
  DiffView,
  DiffViewPreference,
  TextSegment,
} from "./types.ts";

export const MIN_SIDE_BY_SIDE_DIFF_WIDTH = 121;

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

  if (filters.localBranch) {
    items.push(
      ...localBranches.map((branch) => ({
        key: `local:${branch.ref}`,
        kind: "local-branch" as const,
        branch,
      })),
    );
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

export function hasEnabledBranchListFilters(filters: BranchListFilters): boolean {
  return Object.values(filters).some(Boolean);
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
  return `${summary.filesChanged} ${fileLabel}  •  +${summary.additions}/-${summary.deletions}`;
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
