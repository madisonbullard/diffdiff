import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { logDiffdiffError, logDiffdiffInfo } from "./logging.ts";
import type { ReviewedFileState } from "./reviewed-file-fingerprint.ts";

const DEFAULT_CACHE_DIRECTORY = join(homedir(), ".diffdiff", "review-cache");

export type ReviewCacheReviewedStateSource = "local" | "github";

export interface ReviewCacheState {
  reviewedStateSource?: ReviewCacheReviewedStateSource;
  reviewedFiles?: ReviewedFileState[];
  reviewedPaths?: string[];
  collapsedPaths: string[];
  commentCollapseStates?: Record<string, boolean>;
  selectedFilePath?: string;
}

interface ReviewCacheRecord extends ReviewCacheState {
  repositoryRootPath: string;
  base: string;
  head: string;
  updatedAt: string;
}

export interface ReviewCacheKey {
  repositoryRootPath: string;
  base: string;
  head: string;
}

function getReviewedStateSource(
  state: Pick<ReviewCacheState, "reviewedFiles" | "reviewedPaths" | "reviewedStateSource">,
): ReviewCacheReviewedStateSource | undefined {
  if (state.reviewedStateSource != null) {
    return state.reviewedStateSource;
  }

  return state.reviewedFiles != null || state.reviewedPaths != null ? "local" : undefined;
}

function getLoadedReviewCacheState(record: ReviewCacheRecord): ReviewCacheState {
  const reviewedStateSource = getReviewedStateSource(record);
  const nextState: ReviewCacheState = {
    reviewedStateSource,
    collapsedPaths: record.collapsedPaths,
    commentCollapseStates: record.commentCollapseStates,
    selectedFilePath: record.selectedFilePath,
  };

  if (reviewedStateSource === "github") {
    return nextState;
  }

  return {
    ...nextState,
    reviewedFiles: record.reviewedFiles,
    reviewedPaths: record.reviewedPaths,
  };
}

function getReviewCacheRecord(key: ReviewCacheKey, state: ReviewCacheState): ReviewCacheRecord {
  const reviewedStateSource = getReviewedStateSource(state);

  return {
    repositoryRootPath: key.repositoryRootPath,
    base: key.base,
    head: key.head,
    reviewedStateSource,
    reviewedFiles: reviewedStateSource === "github" ? undefined : state.reviewedFiles,
    reviewedPaths: reviewedStateSource === "github" ? undefined : state.reviewedPaths,
    collapsedPaths: state.collapsedPaths,
    commentCollapseStates: state.commentCollapseStates,
    selectedFilePath: state.selectedFilePath,
    updatedAt: new Date().toISOString(),
  };
}

function buildCacheFileName(key: ReviewCacheKey): string {
  const hash = createHash("sha256")
    .update(`${key.repositoryRootPath}\0${key.base}\0${key.head}`)
    .digest("hex")
    .slice(0, 16);
  return `review-${hash}.json`;
}

export async function loadReviewCache(
  key: ReviewCacheKey,
  cacheDirectoryPath = DEFAULT_CACHE_DIRECTORY,
): Promise<ReviewCacheState | undefined> {
  const filePath = join(cacheDirectoryPath, buildCacheFileName(key));

  try {
    const contents = await readFile(filePath, "utf8");
    const record = JSON.parse(contents) as ReviewCacheRecord;

    if (
      record.repositoryRootPath !== key.repositoryRootPath ||
      record.base !== key.base ||
      record.head !== key.head
    ) {
      logDiffdiffInfo("review-cache", "cache_key_mismatch", {
        expected: key,
        stored: {
          repositoryRootPath: record.repositoryRootPath,
          base: record.base,
          head: record.head,
        },
      });
      return undefined;
    }

    logDiffdiffInfo("review-cache", "cache_loaded", {
      base: key.base,
      collapsedPathCount: record.collapsedPaths.length,
      commentCollapseStateCount: Object.keys(record.commentCollapseStates ?? {}).length,
      head: key.head,
      repositoryRootPath: key.repositoryRootPath,
      reviewedPathCount:
        getReviewedStateSource(record) === "github"
          ? 0
          : (record.reviewedFiles?.length ?? record.reviewedPaths?.length ?? 0),
      reviewedStateSource: getReviewedStateSource(record),
      selectedFilePath: record.selectedFilePath,
    });

    return getLoadedReviewCacheState(record);
  } catch {
    return undefined;
  }
}

export async function saveReviewCache(
  key: ReviewCacheKey,
  state: ReviewCacheState,
  cacheDirectoryPath = DEFAULT_CACHE_DIRECTORY,
): Promise<void> {
  const filePath = join(cacheDirectoryPath, buildCacheFileName(key));
  const record = getReviewCacheRecord(key, state);

  try {
    await mkdir(cacheDirectoryPath, { recursive: true });
    await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    logDiffdiffInfo("review-cache", "cache_saved", {
      base: key.base,
      collapsedPathCount: state.collapsedPaths.length,
      commentCollapseStateCount: Object.keys(state.commentCollapseStates ?? {}).length,
      head: key.head,
      repositoryRootPath: key.repositoryRootPath,
      reviewedPathCount:
        record.reviewedStateSource === "github"
          ? 0
          : (state.reviewedFiles?.length ?? state.reviewedPaths?.length ?? 0),
      reviewedStateSource: record.reviewedStateSource,
      selectedFilePath: state.selectedFilePath,
    });
  } catch (error) {
    logDiffdiffError("review-cache", "cache_save_failed", error, {
      base: key.base,
      head: key.head,
      repositoryRootPath: key.repositoryRootPath,
    });
  }
}
