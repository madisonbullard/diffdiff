import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { loadReviewCache, saveReviewCache } from "../src/review-cache.ts";
import type { ReviewCacheKey, ReviewCacheState } from "../src/review-cache.ts";

const temporaryDirectories: string[] = [];

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "diffdiff-review-cache-")).then((dir) => {
    temporaryDirectories.push(dir);
    return dir;
  });
}

describe("review cache", () => {
  test("returns undefined when no cache exists", async () => {
    const cacheDir = await createTempDir();
    const key: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo",
      base: "origin/main",
      head: "feature/ui",
    };

    const result = await loadReviewCache(key, cacheDir);

    expect(result).toBeUndefined();
  });

  test("saves and loads review state for a base/head combination", async () => {
    const cacheDir = await createTempDir();
    const key: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo",
      base: "origin/main",
      head: "feature/ui",
    };
    const state: ReviewCacheState = {
      reviewedFiles: [
        { fingerprint: "fingerprint-app", path: "src/app.ts" },
        { fingerprint: "fingerprint-index", path: "src/index.ts" },
      ],
      collapsedPaths: ["src/app.ts"],
      commentCollapseStates: {
        "group:PRR_700": true,
        "thread:101": false,
      },
      selectedFilePath: "src/index.ts",
    };

    await saveReviewCache(key, state, cacheDir);
    const loaded = await loadReviewCache(key, cacheDir);

    expect(loaded).toEqual(state);
  });

  test("different base/head pairs produce separate caches", async () => {
    const cacheDir = await createTempDir();
    const keyA: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo",
      base: "origin/main",
      head: "feature/a",
    };
    const keyB: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo",
      base: "origin/main",
      head: "feature/b",
    };
    const stateA: ReviewCacheState = {
      reviewedFiles: [{ fingerprint: "fingerprint-a", path: "a.ts" }],
      collapsedPaths: [],
    };
    const stateB: ReviewCacheState = {
      reviewedFiles: [{ fingerprint: "fingerprint-b", path: "b.ts" }],
      collapsedPaths: ["b.ts"],
      selectedFilePath: "b.ts",
    };

    await saveReviewCache(keyA, stateA, cacheDir);
    await saveReviewCache(keyB, stateB, cacheDir);

    const loadedA = await loadReviewCache(keyA, cacheDir);
    const loadedB = await loadReviewCache(keyB, cacheDir);

    expect(loadedA).toEqual(stateA);
    expect(loadedB).toEqual(stateB);
  });

  test("different repositories produce separate caches for the same refs", async () => {
    const cacheDir = await createTempDir();
    const keyA: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo-a",
      base: "origin/main",
      head: "feature/x",
    };
    const keyB: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo-b",
      base: "origin/main",
      head: "feature/x",
    };
    const stateA: ReviewCacheState = {
      reviewedFiles: [{ fingerprint: "fingerprint-a", path: "a.ts" }],
      collapsedPaths: [],
    };
    const stateB: ReviewCacheState = {
      reviewedFiles: [{ fingerprint: "fingerprint-b", path: "b.ts" }],
      collapsedPaths: [],
    };

    await saveReviewCache(keyA, stateA, cacheDir);
    await saveReviewCache(keyB, stateB, cacheDir);

    expect(await loadReviewCache(keyA, cacheDir)).toEqual(stateA);
    expect(await loadReviewCache(keyB, cacheDir)).toEqual(stateB);
  });

  test("overwrites an existing cache when saved again", async () => {
    const cacheDir = await createTempDir();
    const key: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo",
      base: "origin/main",
      head: "feature/ui",
    };

    await saveReviewCache(
      key,
      { reviewedFiles: [{ fingerprint: "fingerprint-old", path: "old.ts" }], collapsedPaths: [] },
      cacheDir,
    );
    await saveReviewCache(
      key,
      {
        reviewedFiles: [{ fingerprint: "fingerprint-new", path: "new.ts" }],
        collapsedPaths: ["new.ts"],
        selectedFilePath: "new.ts",
      },
      cacheDir,
    );

    const loaded = await loadReviewCache(key, cacheDir);

    expect(loaded).toEqual({
      reviewedFiles: [{ fingerprint: "fingerprint-new", path: "new.ts" }],
      collapsedPaths: ["new.ts"],
      selectedFilePath: "new.ts",
    });
  });

  test("saves state without a selected file path", async () => {
    const cacheDir = await createTempDir();
    const key: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo",
      base: "origin/main",
      head: "feature/ui",
    };
    const state: ReviewCacheState = {
      reviewedFiles: [],
      collapsedPaths: [],
    };

    await saveReviewCache(key, state, cacheDir);
    const loaded = await loadReviewCache(key, cacheDir);

    expect(loaded).toEqual(state);
    expect(loaded?.selectedFilePath).toBeUndefined();
  });

  test("writes valid JSON to disk", async () => {
    const cacheDir = await createTempDir();
    const key: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo",
      base: "main",
      head: "HEAD",
    };

    await saveReviewCache(
      key,
      { reviewedFiles: [{ fingerprint: "fingerprint-x", path: "x.ts" }], collapsedPaths: [] },
      cacheDir,
    );

    const { readdir } = await import("node:fs/promises");
    const files = await readdir(cacheDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^review-[0-9a-f]+\.json$/);

    const contents = await readFile(join(cacheDir, files[0]!), "utf8");
    const parsed = JSON.parse(contents);
    expect(parsed).toMatchObject({
      repositoryRootPath: "/tmp/repo",
      base: "main",
      head: "HEAD",
      reviewedFiles: [{ fingerprint: "fingerprint-x", path: "x.ts" }],
      collapsedPaths: [],
      updatedAt: expect.any(String),
    });
  });

  test("loads legacy reviewed paths when present", async () => {
    const cacheDir = await createTempDir();
    const key: ReviewCacheKey = {
      repositoryRootPath: "/tmp/repo",
      base: "origin/main",
      head: "feature/ui",
    };
    const legacyRecord = {
      repositoryRootPath: key.repositoryRootPath,
      base: key.base,
      head: key.head,
      reviewedPaths: ["src/app.ts"],
      collapsedPaths: [],
      updatedAt: "2026-04-02T00:00:00Z",
    };

    const hash = createHash("sha256")
      .update(`${key.repositoryRootPath}\0${key.base}\0${key.head}`)
      .digest("hex")
      .slice(0, 16);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      join(cacheDir, `review-${hash}.json`),
      `${JSON.stringify(legacyRecord, null, 2)}\n`,
      "utf8",
    );

    expect(await loadReviewCache(key, cacheDir)).toEqual({
      reviewedPaths: ["src/app.ts"],
      collapsedPaths: [],
    });
  });
});
