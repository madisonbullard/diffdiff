import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";
import type { GitHubMergeMethod } from "@madisonbullard/diffdiff-core";

for (const allowedMethods of [
  ["squash"],
  ["merge"],
  ["merge", "squash"],
  [],
] as GitHubMergeMethod[][]) {
  test(`merge picker only lists allowed methods: ${allowedMethods.join(",") || "none"}`, async () => {
    const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("test", 3) }]);
    const github = githubReview(repo.path, []);
    github.auth.isAuthenticated = true;
    Object.assign(github.pullRequest.merge, { allowedMethods, canMerge: true });
    const app = await launchApp(repo, {
      prepare: (session) => ({ ...session, github }),
      props: {
        initialGitHubPreferences: {
          cleanup: { removeLocal: false, removeRemote: false },
          defaultMergeMethod: "merge",
        },
      },
    });
    try {
      await app.press(" ", "m");
      expect(app.frame()).toContain("Merge Pull Request");
      expect(app.frame().includes("Merge commit")).toBe(allowedMethods.includes("merge"));
      expect(app.frame().includes("Squash merge")).toBe(allowedMethods.includes("squash"));
      expect(app.frame()).toContain("○ Close PR");
      if (allowedMethods.length === 0) {
        await app.press("\r");
        expect(app.frame()).toContain("Choose an allowed merge method.");
      }
      if (allowedMethods.length === 1) {
        const selectedLabel = allowedMethods[0] === "merge" ? "Merge commit" : "Squash merge";
        expect(app.frame()).toContain(`● ${selectedLabel}`);
      }
      // Tab from title/body back to the method field, then navigate both directions.
      if (allowedMethods.length > 0) await app.press("\t", "\t");
      await app.press("j", "k", "j");
      expect(app.frame().includes("Merge commit")).toBe(allowedMethods.includes("merge"));
      expect(app.frame().includes("Squash merge")).toBe(allowedMethods.includes("squash"));
      if (allowedMethods.length <= 1) {
        expect(app.frame()).toContain("● Close PR");
        await app.press("\r");
        expect(app.frame()).toContain("close without merging");
      } else {
        const selectedLabel = allowedMethods.at(-1) === "merge" ? "Merge commit" : "Squash merge";
        expect(app.frame()).toContain(`● ${selectedLabel}`);
      }
    } finally {
      app.destroy();
      repo.dispose();
    }
  });
}

test("auto-merge toggle and confirmation render while immediate merge is blocked", async () => {
  const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("test", 3) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  Object.assign(github.pullRequest.merge, {
    allowedMethods: ["squash"],
    canMerge: false,
    autoMergeAllowed: true,
  });
  const app = await launchApp(repo, { prepare: (session) => ({ ...session, github }) });
  try {
    await app.press(" ", "m");
    expect(app.frame()).toContain("[ ] Auto-merge");
    await app.press("\u0007");
    expect(app.frame()).toContain("[x] Auto-merge");
    await app.press("\r");
    expect(app.frame()).toContain("Enable Auto-Merge");
    expect(app.frame()).toContain("confirm enabling auto-merge");
    await app.press("\u001b");
    expect(app.frame()).toContain("[x] Auto-merge");
  } finally {
    app.destroy();
    repo.dispose();
  }
});
