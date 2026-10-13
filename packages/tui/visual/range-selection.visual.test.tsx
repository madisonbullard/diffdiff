import { expect, test } from "bun:test";
import type { GitHubReviewLineAnchor } from "@madisonbullard/diffdiff-core";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview, thread } from "./harness/review-fixture.ts";

for (const split of [false, true]) {
  test(`removed-line ranges highlight only LEFT lines and context (${split ? "split" : "unified"})`, async () => {
    const repo = createFixtureRepo([
      {
        path: "a.ts",
        before: "context_start\nremoved_one\nremoved_two\ncontext_end\n",
        after: "context_start\nadded_one\nadded_two\ncontext_end\n",
      },
    ]);
    const app = await launchApp(repo, { width: 180 });
    try {
      if (split) await app.press("v");
      await app.press("2", "s", "s", "}", "}", "{");
      expect(app.frame()).toContain("Selected a.ts:1-4 (LEFT)");
      for (const marker of ["removed_one", "removed_two", "context_end"]) {
        expect(app.diffPane().rows.find((row) => row.includes(marker))).toContain("▎");
      }
      if (!split) {
        for (const marker of ["added_one", "added_two"]) {
          expect(app.diffPane().rows.find((row) => row.includes(marker))).not.toContain("▎");
        }
      }
      await app.press("}");
      expect(app.frame()).toContain("Selection reached the edge");
    } finally {
      app.destroy();
      repo.dispose();
    }
  });

  test(`range selection paints every line and resets on line/file navigation (${split ? "split" : "unified"})`, async () => {
    const repo = createFixtureRepo([
      { path: "a.ts", after: numberedLines("range", 6) },
      { path: "b.ts", after: numberedLines("other", 6) },
    ]);
    const app = await launchApp(repo, { width: 180 });
    try {
      if (split) await app.press("v");
      await app.press("]", "}", "{");
      const rows = app.diffPane().rows;
      expect(rows.find((row) => row.includes("range line 1"))).toContain("▶");
      expect(rows.find((row) => row.includes("range line 2"))).toContain("▎");
      expect(rows.find((row) => row.includes("range line 3"))).toContain("▎");
      expect(rows.find((row) => row.includes("range line 4"))).not.toContain("▎");
      expect(app.frame()).toContain("Selected a.ts:1-3 (RIGHT)");
      await app.press("]");
      expect(app.diffPane().rows.join("\n")).not.toContain("▎");
      await app.press("}", "j");
      expect(app.diffPane().rows.join("\n")).not.toContain("▎");
      await app.press("k", "}");
      expect(app.frame()).toContain("Selected a.ts:3-4 (RIGHT)");
    } finally {
      app.destroy();
      repo.dispose();
    }
  });
}

test("thread mode range opens and submits a normalized multiline GitHub comment", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("range", 6) }]);
  let submitted: GitHubReviewLineAnchor | undefined;
  const app = await launchApp(repo, {
    prepare: (session) => {
      const github = githubReview(repo.path, [thread("a.ts", 4)]);
      github.auth.isAuthenticated = true;
      return { ...session, github };
    },
    props: {
      addReviewThread: async (_session, anchor) => {
        submitted = anchor;
      },
    },
  });
  try {
    await app.press("j", "}", "}");
    expect(app.frame()).toContain("Selected a.ts:1-3 (RIGHT)");
    await app.press("a");
    expect(app.frame()).toContain("Comment on a.ts:1-3");
    await app.press("n", "o", "t", "e", "\r");
    await app.waitFor(() => submitted != null);
    expect({
      path: submitted?.path,
      startLine: submitted?.startLine,
      line: submitted?.line,
      startSide: submitted?.startSide,
      side: submitted?.side,
    }).toEqual({
      path: "a.ts",
      startLine: 1,
      line: 3,
      startSide: "RIGHT",
      side: "RIGHT",
    });
  } finally {
    app.destroy();
    repo.dispose();
  }
});
