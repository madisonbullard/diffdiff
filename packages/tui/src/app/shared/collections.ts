import {
  buildReviewedFileFingerprint,
  getReviewedPathsFromGitHubViewedState,
} from "@diffdiff/core";
import type { ReviewCacheState, ReviewedFileState } from "@diffdiff/core";
import type { FileTreeNode, PreparedReviewSession } from "../../types.ts";

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

export function restoreCollapsedPaths(
  files: PreparedReviewSession["files"],
  cacheState?: Pick<ReviewCacheState, "collapsedPaths">,
): Set<string> {
  const nextPaths = reconcileCollapsedPaths(new Set<string>(), files);
  if (cacheState == null) {
    return nextPaths;
  }

  const availablePaths = new Set(files.map((file) => file.path));
  for (const path of cacheState.collapsedPaths) {
    if (availablePaths.has(path)) {
      nextPaths.add(path);
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

export function buildReviewedFiles(
  files: PreparedReviewSession["files"],
  reviewedPaths: ReadonlySet<string>,
): ReviewedFileState[] {
  return files.flatMap((file) =>
    reviewedPaths.has(file.path)
      ? [{ fingerprint: buildReviewedFileFingerprint(file), path: file.path }]
      : [],
  );
}

export function getSessionReviewedPaths(
  session: PreparedReviewSession,
  cacheState?: Pick<ReviewCacheState, "reviewedFiles" | "reviewedPaths">,
): Set<string> {
  if (session.github != null) {
    return getReviewedPathsFromGitHubViewedState(
      session.files,
      session.github.pullRequest.changedFiles,
    );
  }

  return restoreReviewedPaths(session.files, cacheState);
}

export function buildSessionReviewCacheState(
  session: PreparedReviewSession,
  reviewedPaths: ReadonlySet<string>,
  state: Pick<ReviewCacheState, "collapsedPaths" | "commentCollapseStates" | "selectedFilePath">,
): ReviewCacheState {
  if (session.github != null) {
    return {
      reviewedStateSource: "github",
      collapsedPaths: state.collapsedPaths,
      commentCollapseStates: state.commentCollapseStates,
      selectedFilePath: state.selectedFilePath,
    };
  }

  return {
    reviewedStateSource: "local",
    reviewedFiles: buildReviewedFiles(session.files, reviewedPaths),
    collapsedPaths: state.collapsedPaths,
    commentCollapseStates: state.commentCollapseStates,
    selectedFilePath: state.selectedFilePath,
  };
}

function restoreReviewedPaths(
  files: PreparedReviewSession["files"],
  cacheState?: Pick<ReviewCacheState, "reviewedFiles" | "reviewedPaths">,
): Set<string> {
  if (cacheState?.reviewedFiles != null) {
    const reviewedFingerprintsByPath = new Map<string, Set<string>>();

    for (const reviewedFile of cacheState.reviewedFiles) {
      const fingerprints = reviewedFingerprintsByPath.get(reviewedFile.path) ?? new Set<string>();
      fingerprints.add(reviewedFile.fingerprint);
      reviewedFingerprintsByPath.set(reviewedFile.path, fingerprints);
    }

    return new Set(
      files.flatMap((file) => {
        const fingerprints = reviewedFingerprintsByPath.get(file.path);
        if (fingerprints?.has(buildReviewedFileFingerprint(file)) !== true) {
          return [];
        }

        return [file.path];
      }),
    );
  }

  if (cacheState?.reviewedPaths != null) {
    const availablePaths = new Set(files.map((file) => file.path));
    return new Set(cacheState.reviewedPaths.filter((path) => availablePaths.has(path)));
  }

  return new Set();
}
