import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";
import type { PreparedReviewSession } from "../src/types.ts";

test("draft toggle accepts uppercase D from both prefix menus and updates the PR banner", async () => {
  const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("test", 3) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  const writes: boolean[] = [];
  let prepared: PreparedReviewSession;
  const app = await launchApp(repo, {
    width: 120,
    height: 40,
    prepare: (session) => (prepared = { ...session, github }),
    props: {
      isGitHubAuthenticated: true,
      loadSession: async () => ({ ...prepared, github: { ...github } }),
      setPullRequestDraft: async (_session, isDraft) => {
        writes.push(isDraft);
        github.pullRequest = {
          ...github.pullRequest,
          isDraft,
          merge: { ...github.pullRequest.merge, isDraft },
        };
      },
    },
  });
  try {
    await app.press(" ");
    expect(app.frame()).toContain("Convert PR to draft");
    await app.press("D");
    await app.waitFor(() => writes.length === 1);
    expect(writes).toEqual([true]);
    expect(app.frame()).toContain("draft");
    await app.press("\x18");
    await app.press("D");
    expect(writes, app.frame()).toEqual([true, false]);
    expect(app.frame()).toContain("Marked pull request as ready for review.");
  } finally {
    app.destroy();
    repo.dispose();
  }
});
