import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";
import type { GitHubPullRequestChecksSummary } from "@madisonbullard/diffdiff-core";
import type { PreparedReviewSession } from "../src/types.ts";

for (const [width, height] of [
  [120, 40],
  [80, 24],
]) {
  test(`clicking the checks badge opens PR checks at ${width}x${height}`, async () => {
    const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("test", 3) }]);
    const github = githubReview(repo.path, []);
    github.pullRequest.checks = {
      state: "failure",
      failed: 1,
      pending: 1,
      successful: 18,
      total: 20,
      items: Array.from({ length: 20 }, (_, index) => ({
        id: `check:${index}`,
        name: `job-${index}`,
        state:
          index === 19
            ? ("failure" as const)
            : index === 18
              ? ("pending" as const)
              : ("success" as const),
        status: index === 19 ? "failure" : index === 18 ? "in_progress" : "success",
        source: "check-run" as const,
        provider: "GitHub Actions",
        summary: index === 19 ? "Type checking failed" : undefined,
        url: `https://github.com/example/repo/actions/runs/${index}`,
      })).sort(
        (a, b) =>
          ({ failure: 0, pending: 1, success: 2 })[a.state] -
          { failure: 0, pending: 1, success: 2 }[b.state],
      ),
    };
    const app = await launchApp(repo, {
      width,
      height,
      prepare: (session) => ({ ...session, github }),
    });
    try {
      const rows = app.frame().split("\n");
      const y = rows.findIndex((row) => row.includes("1 check failed"));
      const x = rows[y]!.indexOf("1 check failed");
      await app.click(x + 2, y);
      expect(app.frame()).toContain("PR Checks");
      expect(app.frame()).toContain("job-19");
      expect(app.frame()).toContain("Type checking failed");
      expect(app.frame()).toContain("job-18");
      expect(app.frame()).toContain("esc");
      await app.press("\x1b[F");
      expect(app.frame()).toContain("job-17");
      await app.press("\x1b");
      await app.waitFor(() => !app.frame().includes("PR Checks"));
      expect(app.frame()).not.toContain("PR Checks");
      await app.press(" ", "s");
      expect(app.frame()).toContain("PR Checks");
      await app.press("q");
      expect(app.frame()).not.toContain("PR Checks");
    } finally {
      app.destroy();
      repo.dispose();
    }
  });
}

for (const [label, checks, expected] of [
  [
    "no checks",
    { state: "unknown", total: 0, failed: 0, pending: 0, successful: 0, items: [] },
    "No checks have run",
  ],
  [
    "checks unavailable",
    {
      state: "unknown",
      total: 0,
      failed: 0,
      pending: 0,
      successful: 0,
      items: [],
      unavailable: true,
    },
    "Unable to load PR checks",
  ],
  [
    "1/1 checks success",
    {
      state: "success",
      total: 1,
      failed: 0,
      pending: 0,
      successful: 1,
      items: [
        {
          id: "success",
          name: "Build passed",
          state: "success",
          status: "success",
          source: "check-run",
        },
      ],
    },
    "Build passed",
  ],
] satisfies [string, GitHubPullRequestChecksSummary, string][]) {
  test(`the ${label} badge also opens a useful checks dialog`, async () => {
    const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("test", 3) }]);
    const github = githubReview(repo.path, []);
    github.pullRequest.title = "A very long title ".repeat(10);
    github.pullRequest.checks = checks;
    const app = await launchApp(repo, {
      width: 80,
      height: 24,
      prepare: (session) => ({ ...session, github }),
    });
    try {
      const rows = app.frame().split("\n");
      const y = rows.findIndex((row) => row.includes(label));
      expect(y >= 0).toBe(true);
      await app.click(rows[y]!.indexOf(label) + 1, y);
      expect(app.frame()).toContain("PR Checks");
      expect(app.frame()).toContain(expected);
      expect(app.frame()).toContain("refresh");
      expect(app.frame()).toContain("close");
    } finally {
      app.destroy();
      repo.dispose();
    }
  });
}

test("mouse selection, detail scrolling, and refreshing stay within the checks dialog", async () => {
  const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("test", 3) }]);
  const github = githubReview(repo.path, []);
  github.pullRequest.checks = {
    state: "failure",
    total: 2,
    failed: 1,
    pending: 1,
    successful: 0,
    items: [
      {
        id: "fail",
        name: "Lint failed",
        state: "failure",
        status: "failure",
        source: "check-run",
        summary: Array.from({ length: 50 }, (_, index) => `Lint error ${index}`).join("\n"),
      },
      {
        id: "pending",
        name: "Deploy waiting",
        state: "pending",
        status: "queued",
        source: "check-run",
      },
    ],
  };
  let initial!: PreparedReviewSession;
  let reloads = 0;
  const app = await launchApp(repo, {
    width: 80,
    height: 24,
    prepare: (session) => (initial = { ...session, github }),
    props: {
      loadSession: async () => {
        reloads++;
        return {
          ...initial,
          github: {
            ...github,
            pullRequest: {
              ...github.pullRequest,
              checks: {
                state: "success",
                total: 1,
                failed: 0,
                pending: 0,
                successful: 1,
                items: [
                  {
                    id: "done",
                    name: "All done",
                    state: "success",
                    status: "success",
                    source: "check-run",
                  },
                ],
              },
            },
          },
        };
      },
    },
  });
  try {
    await app.press(" ", "s");
    expect(app.frame()).toContain("Lint error 0");
    await app.press("\x1b[6~");
    expect(app.frame()).not.toContain("Lint error 0");
    expect(app.frame()).toContain("Lint error 4");
    const rows = app.frame().split("\n");
    const y = rows.findIndex((row) => row.includes("Deploy waiting"));
    await app.click(rows[y]!.indexOf("Deploy waiting") + 1, y);
    expect(app.frame()).toContain("Check run · queued");
    await app.press("y");
    expect(app.frame()).toContain("No details link is available");
    await app.press("r");
    await app.waitFor(() => app.frame().includes("All done"));
    expect(reloads).toBe(1);
    expect(app.frame()).toContain("PR Checks");
    expect(app.frame()).toContain("0 failed · 0 pending · 1 passed");
  } finally {
    app.destroy();
    repo.dispose();
  }
});
