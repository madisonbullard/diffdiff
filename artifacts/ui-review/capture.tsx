import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const output = dirname(fileURLToPath(import.meta.url));
process.env.HOME = mkdtempSync(join(process.env.TMPDIR!, "diffdiff-capture-home-"));
delete process.env.DIFFDIFF_GITHUB_TOKEN;
const { launchApp } = await import("../../packages/tui/visual/harness/app-harness.tsx");
const { createFixtureRepo } = await import("../../packages/tui/visual/harness/fixture-repo.ts");
const { githubReview, thread } =
  await import("../../packages/tui/visual/harness/review-fixture.ts");
const repo = createFixtureRepo([
  {
    path: "src/review.ts",
    before: "export function review() {\n  return false;\n}\n",
    after:
      "export function review() {\n  // Keep the review workflow keyboard-first.\n  return true;\n}\n",
  },
  { path: "README.md", after: "# Review workflow\n\nA terminal-first code review experience.\n" },
]);
const entries: { name: string; size: string; description: string }[] = [];
const neverWrite = async () => {
  throw new Error("Screenshot fixture: writes disabled");
};
try {
  for (const [width, height] of [
    [120, 40],
    [80, 24],
  ]) {
    const size = `${width}x${height}`;
    mkdirSync(join(output, size), { recursive: true });
    const github = githubReview(repo.path, [thread("src/review.ts", 3)]);
    github.auth.isAuthenticated = true;
    github.pullRequest.title = "Improve the keyboard-driven review workflow";
    github.pullRequest.body =
      "## Summary\nMake review navigation faster and keep actions discoverable.\n\n- Preserve keyboard-first interactions\n- Clarify destructive actions\n- Improve review feedback";
    github.pullRequest.reviewThreads[0].comments[0].body =
      "Could we explain why this defaults to true?";
    github.pullRequest.reviewRequests = [{ kind: "user", label: "alex" }];
    github.pullRequest.conversationItems = [
      {
        id: "discussion-1",
        kind: "pull-request-comment",
        author: { login: "alex" },
        body: "The keyboard shortcuts feel good. Please make destructive actions more explicit before merging.",
        createdAt: "2026-10-14T09:00:00Z",
        updatedAt: "2026-10-14T09:00:00Z",
        url: "https://github.com/example/repo/pull/1#issuecomment-1",
      },
    ];
    Object.assign(github.pullRequest.merge, {
      canMerge: true,
      mergeable: true,
      mergeableState: "clean",
      autoMergeAllowed: true,
    });
    github.pullRequest.checks = {
      state: "failure",
      total: 3,
      failed: 1,
      pending: 1,
      successful: 1,
      items: [
        {
          id: "lint",
          name: "Type checking",
          state: "failure",
          status: "completed",
          source: "check-run",
          provider: "GitHub Actions",
          summary:
            "Type checking failed\n\nsrc/review.ts:3 — Expected a documented default.\nRun vp check before merging.",
          url: "https://github.com/example/repo/actions/runs/1",
        },
        {
          id: "build",
          name: "Build packages",
          state: "pending",
          status: "in_progress",
          source: "check-run",
          provider: "GitHub Actions",
        },
        {
          id: "test",
          name: "Unit tests",
          state: "success",
          status: "completed",
          source: "check-run",
          provider: "GitHub Actions",
        },
      ],
    };
    let prepared: any;
    let app = await launchApp(repo, {
      width,
      height,
      prepare: (session) => (prepared = { ...session, github }),
      props: {
        isGitHubAuthenticated: true,
        initialGitHubPreferences: {
          cleanup: { removeLocal: false, removeRemote: false },
          defaultMergeMethod: "squash",
        },
        loadSession: async () => prepared,
        listGitHubPullRequests: async () => [
          {
            author: { login: "alex" },
            isAuthor: false,
            isDraft: false,
            isReviewRequested: true,
            number: 42,
            repository: github.repository,
            title: "Improve the keyboard-driven review workflow",
            updatedAt: "2026-10-14T09:00:00Z",
            url: "https://github.com/example/repo/pull/42",
          },
          {
            author: { login: "sam" },
            isAuthor: false,
            isDraft: true,
            isReviewRequested: false,
            number: 41,
            repository: github.repository,
            title: "Add clearer review status indicators",
            updatedAt: "2026-10-13T09:00:00Z",
            url: "https://github.com/example/repo/pull/41",
          },
        ],
        listReviewerCandidates: async () => ({
          recommendationsUnavailable: false,
          users: [
            { login: "alex", name: "Alex Rivera" },
            {
              login: "sam",
              name: "Sam Chen",
              recommendation: { basedOnCommits: true, basedOnReviewComments: false },
            },
            { login: "jordan", name: "Jordan Lee" },
          ],
        }),
        logFilePath: "/fixture/session.jsonl",
        loadSessionDiagnostics: async () => [
          {
            event: "startup_first_diff_frame",
            level: "info",
            scope: "startup",
            sequence: 1,
            sessionId: "fixture",
            timestamp: "2026-10-14T09:00:00Z",
            summaryText: "First diff frame rendered in 142 ms",
            detailText: '{"durationMs":142,"networkWaitMs":0,"budgetMs":1000}',
          },
        ],
        loadReviewComposerHistory: async () => [],
        appendReviewComposerHistory: async () => {},
        addReviewThread: neverWrite,
        addPullRequestComment: neverWrite,
        replyToReviewComment: neverWrite,
        submitPendingReview: neverWrite,
        requestReviewers: neverWrite,
        setPullRequestDraft: neverWrite,
        markFileAsViewed: async () => {},
        unmarkFileAsViewed: async () => {},
        removeCleanupRefs: neverWrite,
        // Simulate a merge only to reach cleanup; never contact GitHub or delete refs.
        mergePullRequest: async () => ({
          cleanupCandidates: [
            { kind: "local-branch", branchName: "feature", ref: "feature" },
            { kind: "remote-tracking", branchName: "feature", ref: "origin/feature" },
          ],
          deletedRemoteRefs: [],
          message: "Fixture merge complete",
        }),
      },
    });
    async function capture(name: string, description: string, expected?: string) {
      await app.settle();
      const text = app.frame();
      if (expected && !text.includes(expected))
        throw new Error(`${size}/${name}: missing ${expected}\n${text}`);
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
      writeFileSync(join(output, size, `${name}.txt`), text);
      entries.push({ name, size, description });
      console.log(`Captured ${size}/${name}`);
    }
    const esc = () => app.press("\x1b");
    try {
      await capture("00-overview", "PR overview and application chrome");
      await app.press(" ");
      await capture("01-space-menu", "Space action menu");
      await esc();
      await app.press("\x18");
      await capture("02-leader-menu", "Ctrl+X action menu");
      await esc();
      await app.press("g");
      await capture("03-goto-menu", "Go-to navigation menu");
      await esc();
      await app.press("s");
      await capture("04-in-file-menu", "In-file navigation prefix", "In File");
      await esc();
      await app.press("\x10");
      await capture("05-command-palette", "Command palette", "Commands");
      await esc();
      await app.press("? ".trim());
      await capture("06-help-diff", "Help from diff pane", "Help");
      await esc();
      await app.press("\t", "?");
      await capture("07-help-tree", "Help from tree pane", "Help");
      await esc();
      await app.press("\t");
      await app.press("l");
      await capture("08-compare-branches", "Comparison browser: branches");
      await app.press("f");
      await capture("09-branch-filters", "Branch filters");
      await esc();
      await app.press("\t");
      await capture("10-compare-commits", "Comparison browser: commits");
      await app.press("/");
      await capture("11-commit-search", "Commit search input");
      await esc();
      await esc();
      await app.press("p");
      await app.waitFor(() => app.frame().includes("Add clearer"));
      await capture("12-pull-requests", "PR dashboard list");
      await app.press("/");
      await capture("13-pull-request-search", "PR dashboard search");
      await esc();
      await esc();
      await app.press(" ", "w");
      await app.waitFor(() => app.frame().includes("matching users"));
      await capture(
        "14-reviewer-picker",
        "Reviewer picker with requested and suggested users",
        "Request reviewers",
      );
      await app.press("\x1b[B", "\r");
      await capture("15-reviewer-selected", "Reviewer picker with a pending selection");
      await esc();
      await app.press(" ", "s");
      await capture("16-checks", "Checks list and failure details", "PR Checks");
      await esc();
      await app.press("t");
      await capture("17-conversation", "PR conversation", "PR Conversation");
      await esc();
      await app.press("t", "r");
      await capture("18-pr-comment", "PR conversation reply composer", "Replying to alex");
      await esc();
      await esc();
      await app.press("j", "]", "a");
      await capture(
        "19-inline-comment",
        "Inline code comment composer",
        "Commenting on src/review.ts",
      );
      await app.press("@");
      await capture(
        "18b-file-autocomplete",
        "Changed-file autocomplete menu inside composer",
        "README.md",
      );
      await esc();
      await esc();
      await app.press("o", "r");
      await capture("20-thread-reply", "Inline thread reply composer");
      await esc();
      await app.press(" ", "A");
      await capture("21-submit-review", "Review submission and event choices", "Submit Review");
      await esc();
      await app.press(" ", "d");
      await capture("22-diagnostics", "Session diagnostics list and event details");
      await esc();
      const prApp = app;
      app = await launchApp(repo, { width, height });
      try {
        await app.press("x", "\x1br");
        await capture(
          "23-clear-reviewed",
          "Clear local reviewed-state confirmation (not available for PRs)",
          "Clear",
        );
      } finally {
        app.destroy();
        app = prApp;
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
      }
      await app.press(" ", "m");
      await capture(
        "24-merge",
        "Merge picker, title, body, and auto-merge option",
        "Merge Pull Request",
      );
      await app.press("\r");
      await capture("25-confirm-merge", "Immediate merge confirmation", "Confirm Merge");
      await esc();
      await app.press("\x07");
      await capture("26-auto-merge", "Merge picker with auto-merge enabled");
      await app.press("\r");
      await capture(
        "27-confirm-auto-merge",
        "Auto-merge confirmation (title clips at compact size)",
        "Confirm Auto-Mer",
      );
      await esc();
      await app.press("\x07", "\r", "\r");
      await app.waitFor(() => app.frame().includes("Post-Merge Cleanup"));
      await capture(
        "28-cleanup",
        "Post-merge cleanup: local and remote-tracking refs",
        "Post-Merge Cleanup",
      );
    } finally {
      app.destroy();
    }
  }
  writeFileSync(join(output, "manifest.json"), JSON.stringify(entries, null, 2));
} finally {
  repo.dispose();
}
