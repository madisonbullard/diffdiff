import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";

for (const [width, height] of [
  [120, 40],
  [80, 24],
]) {
  test(`reviewer picker stays usable at ${width}x${height} and scrolls filtered selections`, async () => {
    const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("test", 3) }]);
    const github = githubReview(repo.path, []);
    github.auth.isAuthenticated = true;
    github.pullRequest.reviewRequests = [{ kind: "user", label: "USER-10" }];
    let writes = 0;
    const app = await launchApp(repo, {
      width,
      height,
      prepare: (session) => ({ ...session, github }),
      props: {
        isGitHubAuthenticated: true,
        listReviewerCandidates: async () => ({
          recommendationsUnavailable: false,
          users: Array.from({ length: 20 }, (_, index) => ({
            login: `user-${index}`,
            name: `Person ${index}`,
            recommendation: { basedOnCommits: true, basedOnReviewComments: false },
          })),
        }),
        requestReviewers: async () => {
          writes += 1;
        },
      },
    });
    try {
      await app.press(" ", "w");
      expect(app.frame()).toContain("Request reviewers");
      expect(app.frame()).toContain("Filter by name or username");
      expect(app.frame()).toContain("ctrl+s");
      expect(app.frame()).toContain("cancel");
      expect(app.frame()).toContain("Requested");
      expect(app.frame()).toContain("@user-10");
      if (height >= 30) {
        expect(app.frame().indexOf("@user-10")).toBeLessThan(app.frame().indexOf("@user-0"));
      }
      for (let index = 0; index < 19; index++) await app.press("\x1b[B");
      expect(app.frame()).toContain("@user-19");
      await app.press("\r");
      expect(app.frame()).toContain("Selected: user-19");
      await app.press("P", "e", "r", "s", "o", "n", " ", "1");
      expect(app.frame()).toContain("11 matching users");
      expect(app.frame()).toContain("Selected: user-19");
      expect(writes).toBe(0);
      await app.press("\x1b");
      await app.waitFor(() => !app.frame().includes("Filter by name or username"));
      expect(app.frame()).not.toContain("Filter by name or username");
    } finally {
      app.destroy();
      repo.dispose();
    }
  });
}

test("compact reviewer picker keeps selection, failure notices, and submission controls visible", async () => {
  const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("test", 3) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  const app = await launchApp(repo, {
    width: 80,
    height: 24,
    prepare: (session) => ({ ...session, github }),
    props: {
      isGitHubAuthenticated: true,
      listReviewerCandidates: async () => ({
        users: [{ login: "alice" }],
        recommendationsUnavailable: true,
      }),
      requestReviewers: async () => {
        throw new Error("permission denied");
      },
    },
  });
  try {
    await app.press(" ", "w", "\r", "\x13");
    expect(app.frame()).toContain("Request reviewers");
    expect(app.frame()).toContain("Selected: alice");
    expect(app.frame()).toContain("Your selection is preserved");
    expect(app.frame()).toContain("GitHub suggestions unavailable");
    expect(app.frame()).toContain("ctrl+s");
    expect(app.frame()).toContain("cancel");
  } finally {
    app.destroy();
    repo.dispose();
  }
});
