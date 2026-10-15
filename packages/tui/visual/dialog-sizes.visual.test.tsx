import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";
import { dialogLayoutErrors } from "./harness/dialog-layout.ts";
for (const [width, height] of [
  [120, 40],
  [80, 24],
  [40, 12],
]) {
  test(`clear-review confirmation floats safely at ${width}x${height}`, async () => {
    const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("clear", 3) }]);
    const app = await launchApp(repo, { width, height });
    try {
      await app.press("r", "\x1br");
      expect(app.frame()).toContain("Clear Review Marks");
      expect(app.frame()).toContain("clear marks");
      expect(dialogLayoutErrors(app.renderer.root).join("\n")).toBe("");
      await app.press("\r");
      expect(app.frame()).not.toContain("Clear Review Marks");
      expect(app.frame()).toContain("0 / 1 reviewed");
    } finally {
      app.destroy();
      repo.dispose();
    }
  });
}
for (const [width, height] of [
  [80, 24],
  [120, 40],
  [160, 48],
  [58, 16],
  [60, 18],
  [100, 30],
]) {
  test(`all dialog families fit and survive resizing at ${width}x${height}`, async () => {
    const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("dialogs", 3) }]);
    const github = githubReview(repo.path, []);
    github.auth.isAuthenticated = true;
    Object.assign(github.pullRequest.merge, {
      allowedMethods: ["squash"],
      canMerge: true,
      autoMergeAllowed: true,
    });
    const app = await launchApp(repo, {
      width,
      height,
      prepare: (session) => ({ ...session, github }),
      props: {
        listReviewerCandidates: async () => ({
          users: Array.from({ length: 40 }, (_, i) => ({
            login: `person-${i}`,
            name: `Reviewer ${i} 日本語 👩🏽‍💻`,
          })),
          recommendationsUnavailable: false,
        }),
      },
    });
    try {
      for (const keys of [
        ["\x10"],
        ["?"],
        ["l"],
        ["A"],
        ["m"],
        ["t"],
        [" ", "s"],
        [" ", "w"],
        ["d"],
      ]) {
        await app.press(...keys);
        expect(dialogLayoutErrors(app.renderer.root).join("\n")).toBe("");
        await app.resize(80, 24);
        expect(dialogLayoutErrors(app.renderer.root).join("\n")).toBe("");
        await app.resize(width!, height!);
        await app.press("\x1b");
        await app.waitFor(
          () => dialogLayoutErrors(app.renderer.root)[0] === "Missing dialog panel",
        );
      }
      await app.press("j", "]", "a");
      expect(dialogLayoutErrors(app.renderer.root).join("\n")).toBe("");
    } finally {
      app.destroy();
      repo.dispose();
    }
  }, 30000);
}
