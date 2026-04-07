import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  appendReviewComposerHistory,
  loadReviewComposerHistory,
  MAX_REVIEW_COMPOSER_HISTORY_ENTRIES,
} from "../src/review-composer-history.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("review composer history", () => {
  test("loads valid entries and rewrites away malformed JSONL lines", async () => {
    const directory = await mkdtemp(join(tmpdir(), "diffdiff-review-composer-history-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "review-composer-history.jsonl");

    await writeFile(
      filePath,
      [
        JSON.stringify({
          body: "Looks good",
          createdAt: "2026-04-01T00:00:00.000Z",
          outcome: "dismissed",
          repositoryRootPath: "/tmp/diffdiff",
          target: {
            key: "review-thread:src/app.ts:1:LEFT",
            kind: "review-thread",
            path: "src/app.ts",
          },
        }),
        "not-json",
      ].join("\n") + "\n",
      "utf8",
    );

    const loaded = await loadReviewComposerHistory(filePath);

    expect(loaded).toEqual([
      {
        body: "Looks good",
        createdAt: "2026-04-01T00:00:00.000Z",
        outcome: "dismissed",
        repositoryRootPath: "/tmp/diffdiff",
        target: {
          key: "review-thread:src/app.ts:1:LEFT",
          kind: "review-thread",
          path: "src/app.ts",
        },
      },
    ]);

    const contents = await readFile(filePath, "utf8");
    expect(contents.trim().split("\n")).toHaveLength(1);
  });

  test("appends entries and keeps history bounded", async () => {
    const directory = await mkdtemp(join(tmpdir(), "diffdiff-review-composer-history-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "review-composer-history.jsonl");

    for (let index = 0; index < MAX_REVIEW_COMPOSER_HISTORY_ENTRIES + 5; index += 1) {
      await appendReviewComposerHistory(
        {
          body: `draft-${index}`,
          createdAt: `2026-04-01T00:00:${String(index).padStart(2, "0")}.000Z`,
          outcome: index % 2 === 0 ? "dismissed" : "submitted",
          repositoryRootPath: "/tmp/diffdiff",
          target: {
            key: `review-thread:src/app.ts:${index}:LEFT`,
            kind: "review-thread",
            path: "src/app.ts",
            pullRequestNumber: 42,
          },
        },
        filePath,
      );
    }

    const loaded = await loadReviewComposerHistory(filePath);

    expect(loaded).toHaveLength(MAX_REVIEW_COMPOSER_HISTORY_ENTRIES);
    expect(loaded[0]?.body).toBe("draft-5");
    expect(loaded.at(-1)?.body).toBe(`draft-${MAX_REVIEW_COMPOSER_HISTORY_ENTRIES + 4}`);
  });
});
