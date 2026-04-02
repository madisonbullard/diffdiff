import type { BranchListFilters, FileTreeNode, PreparedReviewSession } from "../types.ts";

export const LIST_FILTER_KEYS = ["workingTree", "localBranch", "openPr", "remoteBranch"] as const;
export const LOADING_INDICATOR_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
export const TERMINAL_FOCUS_EVENT = "focus";
export const TERMINAL_BLUR_EVENT = "blur";
export const LEADER_KEYBIND = "ctrl+x";
export const COMMAND_LIST_KEYBIND = "ctrl+p";

export function haveSamePaths(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const path of left) {
    if (!right.has(path)) {
      return false;
    }
  }

  return true;
}

export function reconcileCollapsedPaths(
  currentPaths: ReadonlySet<string>,
  files: PreparedReviewSession["files"],
): Set<string> {
  const availablePaths = new Set(files.map((file) => file.path));
  const nextPaths = new Set<string>();

  for (const path of currentPaths) {
    if (availablePaths.has(path)) {
      nextPaths.add(path);
    }
  }

  for (const file of files) {
    if (file.status === "deleted") {
      nextPaths.add(file.path);
    }
  }

  return nextPaths;
}

export function getAncestorDirectoryPaths(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const ancestors: string[] = [];

  for (let index = 0; index < parts.length - 1; index += 1) {
    const ancestorPath = index === 0 ? parts[index]! : `${ancestors[index - 1]}/${parts[index]}`;
    ancestors.push(ancestorPath);
  }

  return ancestors;
}

export function reconcileCollapsedDirectories(
  currentPaths: ReadonlySet<string>,
  nodes: readonly FileTreeNode[],
): Set<string> {
  const availablePaths = new Set(
    nodes.filter((node) => node.kind === "directory").map((node) => node.path),
  );
  const nextPaths = new Set<string>();

  for (const path of currentPaths) {
    if (availablePaths.has(path)) {
      nextPaths.add(path);
    }
  }

  return nextPaths;
}

export function getBranchFilterLabel(key: keyof BranchListFilters): string {
  switch (key) {
    case "workingTree":
      return "Working tree";
    case "localBranch":
      return "Local branches";
    case "openPr":
      return "Open PRs";
    case "remoteBranch":
      return "Remote branches";
  }
}

export function truncateInlineMessage(message: string, maxWidth: number): string {
  const normalizedMessage = message.replace(/\s+/gu, " ").trim();
  if (maxWidth <= 0) {
    return "";
  }

  if (normalizedMessage.length <= maxWidth) {
    return normalizedMessage;
  }

  if (maxWidth <= 3) {
    return normalizedMessage.slice(0, maxWidth);
  }

  return `${normalizedMessage.slice(0, maxWidth - 3)}...`;
}

export function getTreeSummaryLabels({
  additions,
  deletions,
  reviewedCount,
  sidebarWidth,
  totalFiles,
}: {
  additions: number;
  deletions: number;
  reviewedCount: number;
  sidebarWidth: number;
  totalFiles: number;
}) {
  const contentWidth = Math.max(sidebarWidth - 6, 0);
  const variants = [
    {
      reviewed: `${reviewedCount} / ${totalFiles} reviewed`,
      diffAdditions: `+${additions}`,
      diffSeparator: " / ",
      diffDeletions: `-${deletions}`,
    },
    {
      reviewed: `${reviewedCount}/${totalFiles} rev`,
      diffAdditions: `+${additions}`,
      diffSeparator: "/",
      diffDeletions: `-${deletions}`,
    },
    {
      reviewed: `${reviewedCount}/${totalFiles}`,
      diffAdditions: `+${additions}`,
      diffSeparator: "/",
      diffDeletions: `-${deletions}`,
    },
  ];

  return (
    variants.find(
      ({ reviewed, diffAdditions, diffSeparator, diffDeletions }) =>
        reviewed.length + diffAdditions.length + diffSeparator.length + diffDeletions.length + 1 <=
        contentWidth,
    ) ?? variants[variants.length - 1]!
  );
}

export function getActiveOverlay({
  showBranchModal,
  showCleanupModal,
  showCommandModal,
  showCommentComposer,
  showCommentsModal,
  showHelp,
  showListFilterModal,
  showMergeModal,
  showSubmitReviewModal,
}: {
  showBranchModal: boolean;
  showCleanupModal: boolean;
  showCommandModal: boolean;
  showCommentComposer: boolean;
  showCommentsModal: boolean;
  showHelp: boolean;
  showListFilterModal: boolean;
  showMergeModal: boolean;
  showSubmitReviewModal: boolean;
}) {
  return showCommandModal
    ? "command-palette"
    : showHelp
      ? "help"
      : showCommentComposer
        ? "comment-composer"
        : showCommentsModal
          ? "comments"
          : showSubmitReviewModal
            ? "submit-review"
            : showMergeModal
              ? "merge"
              : showCleanupModal
                ? "cleanup"
                : showListFilterModal
                  ? "list-filter"
                  : showBranchModal
                    ? "branch"
                    : null;
}
