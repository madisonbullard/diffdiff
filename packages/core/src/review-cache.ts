import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { logDiffdiffError, logDiffdiffInfo } from "./logging.ts";

const DEFAULT_CACHE_DIRECTORY = join(homedir(), ".diffdiff", "review-cache");

export interface ReviewCacheState {
  reviewedPaths: string[];
  collapsedPaths: string[];
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
      head: key.head,
      repositoryRootPath: key.repositoryRootPath,
      reviewedPathCount: record.reviewedPaths.length,
      selectedFilePath: record.selectedFilePath,
    });

    return {
      reviewedPaths: record.reviewedPaths,
      collapsedPaths: record.collapsedPaths,
      selectedFilePath: record.selectedFilePath,
    };
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

  const record: ReviewCacheRecord = {
    repositoryRootPath: key.repositoryRootPath,
    base: key.base,
    head: key.head,
    reviewedPaths: state.reviewedPaths,
    collapsedPaths: state.collapsedPaths,
    selectedFilePath: state.selectedFilePath,
    updatedAt: new Date().toISOString(),
  };

  try {
    await mkdir(cacheDirectoryPath, { recursive: true });
    await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    logDiffdiffInfo("review-cache", "cache_saved", {
      base: key.base,
      collapsedPathCount: state.collapsedPaths.length,
      head: key.head,
      repositoryRootPath: key.repositoryRootPath,
      reviewedPathCount: state.reviewedPaths.length,
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
