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
      if (allowedMethods.length === 1) {
        const selectedLabel = allowedMethods[0] === "merge" ? "Merge commit" : "Squash merge";
        expect(app.frame()).toContain(`${selectedLabel}  │  default selection`);
      }
      // Tab from title/body back to the method field, then navigate both directions.
      if (allowedMethods.length > 0) await app.press("\t", "\t");
      await app.press("j", "k", "j");
      expect(app.frame().includes("Merge commit")).toBe(allowedMethods.includes("merge"));
      expect(app.frame().includes("Squash merge")).toBe(allowedMethods.includes("squash"));
      if (allowedMethods.length === 0) {
        expect(app.frame()).toContain("No supported merge methods are enabled");
        await app.press("\r");
        expect(app.frame()).toContain("Merge Pull Request");
      } else {
        const selectedLabel = allowedMethods.at(-1) === "merge" ? "Merge commit" : "Squash merge";
        expect(app.frame()).toContain(`> ${selectedLabel}  │  default selection`);
      }
    } finally {
      app.destroy();
      repo.dispose();
    }
  });
}
