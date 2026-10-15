// Current real-app captures. All GitHub data/callbacks are fixtures; HOME is isolated.
// bun --preload ./packages/tui/visual/preload.ts artifacts/ui-review/implemented/capture.tsx
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
process.env.HOME = mkdtempSync(join(process.env.TMPDIR!, "diffdiff-implemented-"));
delete process.env.DIFFDIFF_GITHUB_TOKEN;
const { launchApp } = await import("../../../packages/tui/visual/harness/app-harness.tsx");
const { createFixtureRepo, numberedLines } =
  await import("../../../packages/tui/visual/harness/fixture-repo.ts");
const { githubReview } = await import("../../../packages/tui/visual/harness/review-fixture.ts");
const output = dirname(fileURLToPath(import.meta.url));
const repo = createFixtureRepo([{ path: "src/review.ts", after: numberedLines("review", 6) }]);
const manifest: { name: string; size: string }[] = [];
try {
  for (const [width, height] of [
    [120, 40],
    [80, 24],
    [58, 16],
  ]) {
    const github = githubReview(repo.path, []);
    github.auth.isAuthenticated = true;
    github.pullRequest.title = "Make terminal reviews clear, fast, and safe";
    github.pullRequest.body =
      "## Summary\nUnify terminal menus and dialogs.\n\nKeep keyboard workflows fast.";
    Object.assign(github.pullRequest.merge, {
      allowedMethods: ["merge", "squash"],
      canMerge: true,
      autoMergeAllowed: true,
    });
    github.pullRequest.conversationItems = [
      {
        id: "comment-1",
        kind: "pull-request-comment",
        author: { login: "alex" },
        body: "The compact sheets look good. Please keep all write actions explicit.",
        createdAt: "2026-10-15T09:00:00Z",
        updatedAt: "2026-10-15T09:00:00Z",
        url: "https://github.com/example/repo/pull/1#issuecomment-1",
      },
    ];
    github.pullRequest.checks = {
      state: "failure",
      total: 2,
      failed: 1,
      pending: 1,
      successful: 0,
      items: [
        {
          id: "lint",
          name: "Type checking",
          status: "failure",
          state: "failure",
          source: "check-run",
          provider: "GitHub Actions",
          summary: "One type error in src/review.ts:3.\nRun vp check before merging.",
          url: "https://github.com/example/repo/actions/runs/1",
        },
        {
          id: "build",
          name: "Build packages",
          status: "queued",
          state: "pending",
          source: "check-run",
          summary: "Waiting for a runner.",
        },
      ],
    };
    let prepared: any;
    const disabled = async () => {
      throw new Error("Offline fixture: writes disabled");
    };
    const app = await launchApp(repo, {
      width,
      height,
      prepare: (session) =>
        (prepared = {
          ...session,
          github,
          branches: {
            remote: [],
            local: Array.from({ length: 43 }, (_, i) => ({
              kind: "local" as const,
              name: `feature/review-${String(i).padStart(2, "0")}`,
              ref: `feature/review-${i}`,
              sha: "a".repeat(40),
              isCurrent: false,
              isDefault: false,
            })),
          },
        }),
      props: {
        loadSession: async () => prepared,
        loadComparisonBrowserData: async () => prepared,
        initialGitHubPreferences: { cleanup: { afterMerge: true }, defaultMergeMethod: "squash" },
        listGitHubPullRequests: async () =>
          Array.from({ length: 40 }, (_, i) => ({
            author: { login: "alex" },
            isAuthor: true,
            isDraft: i % 7 === 0,
            isReviewRequested: i % 3 === 0,
            number: i + 1,
            repository: github.repository,
            title: `Improve keyboard-driven review workflow ${i + 1}`,
            updatedAt: "2026-10-15T09:00:00Z",
            url: `https://github.com/example/repo/pull/${i + 1}`,
          })),
        listReviewerCandidates: async () => ({
          recommendationsUnavailable: false,
          users: Array.from({ length: 31 }, (_, i) => ({
            login: `reviewer-${i}`,
            name: `Reviewer ${i} 李`,
            recommendation:
              i < 3 ? { basedOnCommits: true, basedOnReviewComments: true } : undefined,
          })),
        }),
        loadSessionDiagnostics: async () => [
          {
            sequence: 1,
            scope: "startup",
            event: "startup_first_diff_frame",
            level: "info",
            sessionId: "fixture",
            timestamp: "2026-10-15T09:00:00Z",
            summaryText: "First diff frame rendered in 142 ms",
            detailText: '{"durationMs":142,"budgetMs":1000}',
          },
        ],
        loadReviewComposerHistory: async () => [],
        appendReviewComposerHistory: async () => {},
        requestReviewers: disabled,
        addReviewThread: disabled,
        addPullRequestComment: disabled,
        replyToReviewComment: disabled,
        submitPendingReview: disabled,
        mergePullRequest: disabled,
        removeCleanupRefs: disabled,
      },
    });
    const size = `${width}x${height}`;
    mkdirSync(join(output, size), { recursive: true });
    async function capture(name: string) {
      await app.settle();
      const lines = app.renderer.currentRenderBuffer.getSpanLines().map((line) =>
        line.spans.map((span) => ({
          text: span.text,
          width: span.width,
          attributes: span.attributes,
          fg: [span.fg.r, span.fg.g, span.fg.b, span.fg.a],
          bg: [span.bg.r, span.bg.g, span.bg.b, span.bg.a],
        })),
      );
      writeFileSync(join(output, size, `${name}.json`), JSON.stringify({ width, height, lines }));
      writeFileSync(join(output, size, `${name}.txt`), app.frame());
      manifest.push({ name, size });
    }
    async function close(title: string) {
      await app.press("\x1b");
      await app.waitFor(() => !app.frame().includes(title));
    }
    try {
      await app.press("\x10");
      await capture("commands");
      await close("Commands");
      await app.press("?");
      await capture("keys");
      await close("Search keys");
      await app.press("l");
      await capture("compare");
      await app.press("f");
      await capture("compare-facets");
      await close("toggle");
      await close("Compare");
      await app.press("p");
      await capture("pull-requests");
      await close("GitHub PRs");
      await app.press(" ", "w");
      await capture("reviewers");
      await app.press("\r");
      await capture("reviewers-selected");
      await close("Request reviewers");
      await app.press("t");
      await capture("conversation");
      await close("PR Conversation");
      await app.press(" ", "s");
      await capture("checks");
      await close("PR Checks");
      await app.press("d");
      await capture("diagnostics");
      await close("Diagnostics");
      await app.press("A");
      await capture("submit-review");
      await close("Submit Review");
      await app.press("m");
      await capture("merge");
      if (width >= 60) {
        await app.press("\r");
        await capture("merge-confirm");
        await app.press("\x1b");
        await app.waitFor(() => !app.frame().includes("merge now"));
        await app.press("\x07");
        await app.press("\r");
        await capture("auto-merge-confirm");
        await app.press("\x1b");
        await app.waitFor(() => !app.frame().includes("back to editing"));
        await close("Enable Auto-Merge");
      } else await close("Merge Pull Request");
      await app.press("j", "]", "a");
      await capture("comment");
      if (width >= 60) {
        await app.paste("Please explain this default. See @");
        await capture("comment-files");
        await app.press("\x1b");
        await app.waitFor(() => !app.frame().includes("insert file"));
      }
      await close("Add Comment");
      await app.press(" ");
      await capture("space-menu");
      await app.press("\x1b");
      await app.waitFor(() => !app.frame().includes("Modal Picker"));
      await app.press("g");
      await capture("goto-menu");
    } finally {
      app.destroy();
    }
  }
} finally {
  repo.dispose();
}
writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(
  join(output, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Implemented dialogs</title><style>body{background:#12141b;color:#ddd;font:14px system-ui;margin:24px}section{margin:30px 0}img{max-width:100%;display:block}a{color:#9dd4ff}</style><h1>Implemented diffdiff dialogs</h1><p>Real application captures with isolated offline fixtures; not proposal mockups.</p>${manifest.map(({ name, size }) => `<section><h2>${size} · ${name}</h2><a href="${size}/${name}.txt">Text</a><img src="${size}/${name}.png" loading="lazy"></section>`).join("")}`,
);
