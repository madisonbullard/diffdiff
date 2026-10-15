// Live-terminal fixture launcher for the menu/modal audit.
// Renders the real DiffdiffApp in a real CLI renderer (real stdin parsing, paste,
// modifier keys) with synthetic GitHub data and write callbacks that never touch
// GitHub or delete refs. HOME is isolated so preferences/history are not changed.
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.HOME = mkdtempSync(join(tmpdir(), "diffdiff-live-home-"));
delete process.env.DIFFDIFF_GITHUB_TOKEN;

const REPO = fileURLToPath(new URL("../../../", import.meta.url)).replace(/\/$/u, "");
const mode = process.argv[2] ?? "pr"; // "pr" | "pr-long" | "local"
const writeLog = join(tmpdir(), "diffdiff-live-writes.log");
const recordWrite = (name: string, detail: unknown) =>
  appendFileSync(writeLog, `${new Date().toISOString()} ${name} ${JSON.stringify(detail)}\n`);

const { createCliRenderer } = await import(
  `${REPO}/packages/tui/node_modules/@opentui/core/index.js`
);
const { createRoot } = await import(`${REPO}/packages/tui/node_modules/@opentui/react/index.js`);
const { createElement } = await import(`${REPO}/packages/tui/node_modules/react/index.js`);
const { DiffdiffApp } = await import(`${REPO}/packages/tui/src/app/DiffdiffApp.tsx`);
const { loadPreparedReviewSession } = await import(
  `${REPO}/packages/tui/src/diff/prepare-review-session.ts`
);
const { loadStartupPreparedReviewSession } = await import(
  `${REPO}/packages/tui/src/startup-session.ts`
);
const { getSyntaxPalette } = await import(`${REPO}/packages/tui/src/syntax-palette.ts`);
const { getSyntaxStyle } = await import(`${REPO}/packages/tui/src/syntax-style.ts`);
const { getUiTheme } = await import(`${REPO}/packages/tui/src/theme.ts`);
const { createFixtureRepo } = await import(`${REPO}/packages/tui/visual/harness/fixture-repo.ts`);
const { githubReview, thread } = await import(
  `${REPO}/packages/tui/visual/harness/review-fixture.ts`
);

const THEME = "pierre-dark" as const;
const theme = getUiTheme(THEME);
const syntaxPalette = getSyntaxPalette(THEME);
const repo = createFixtureRepo([
  {
    path: "src/review.ts",
    before: "export function review() {\n  return false;\n}\n",
    after:
      "export function review() {\n  // Keep the review workflow keyboard-first.\n  return true;\n}\n",
  },
  { path: "README.md", after: "# Review workflow\n\nA terminal-first code review experience.\n" },
]);
const options = { base: repo.base, head: repo.head, repoPath: repo.path };
if (mode === "pr-long") {
  const { execFileSync } = await import("node:child_process");
  for (let index = 0; index < 40; index += 1) {
    execFileSync(
      "git",
      ["branch", `topic/${index}-a-very-long-branch-name-that-keeps-going-and-going`, "feature"],
      { cwd: repo.path },
    );
  }
}
const loadSession = (next: typeof options) =>
  loadStartupPreparedReviewSession(loadPreparedReviewSession, next, THEME, theme, syntaxPalette);
const loaded = await loadSession(options);

const long = mode === "pr-long";
const github = githubReview(repo.path, [thread("src/review.ts", 3)]);
github.auth.isAuthenticated = true;
github.pullRequest.title = long
  ? "Improve the keyboard-driven review workflow so destructive actions, long titles, and narrow terminals all stay legible"
  : "Improve the keyboard-driven review workflow";
github.pullRequest.body =
  "## Summary\nMake review navigation faster.\n\n- Preserve keyboard-first interactions";
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
      summary: "Type checking failed",
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

const fail =
  (name: string) =>
  async (...args: unknown[]) => {
    recordWrite(name, args.slice(1));
    await new Promise((resolve) => setTimeout(resolve, 600));
    throw new Error(`Live fixture: ${name} is disabled (no GitHub writes).`);
  };

const renderer = await createCliRenderer({
  useAlternateScreen: true,
  useConsole: false,
  exitOnCtrlC: true,
  backgroundColor: "transparent",
});
renderer.setBackgroundColor(theme.appBackground);
const keyLog = join(tmpdir(), "diffdiff-live-keys.log");
renderer.keyInput.on("keypress", (event: any) =>
  appendFileSync(
    keyLog,
    `${JSON.stringify({ name: event.name, seq: event.sequence, raw: event.raw, ctrl: event.ctrl, meta: event.meta, shift: event.shift, super: event.super, source: event.source })}\n`,
  ),
);
renderer.keyInput.on("paste", (event: any) =>
  appendFileSync(
    keyLog,
    `PASTE ${JSON.stringify({ text: event.text ?? String(event.bytes ?? "") })}\n`,
  ),
);
const root = createRoot(renderer);
const session = mode === "local" ? loaded : { ...loaded, github };
root.render(
  createElement(DiffdiffApp, {
    initialOptions: options,
    initialSession: session,
    loadSession: async (next: typeof options) => {
      const fresh = await loadSession(next);
      return mode === "local" ? fresh : { ...fresh, github };
    },
    onExit: () => {
      renderer.destroy();
      repo.dispose();
      process.exit(0);
    },
    openExternalEditor: async (_root: string, value: string) => value,
    openFileInEditor: async () => undefined,
    syntaxStyle: getSyntaxStyle(THEME),
    theme: theme,
    isGitHubAuthenticated: mode !== "local",
    initialGitHubPreferences: {
      cleanup: { removeLocal: false, removeRemote: false },
      defaultMergeMethod: "squash",
    },
    listGitHubPullRequests: async () =>
      Array.from({ length: long ? 40 : 2 }, (_, index) => ({
        author: { login: index % 2 ? "sam" : "alex" },
        isAuthor: false,
        isDraft: index % 3 === 1,
        isReviewRequested: index % 2 === 0,
        number: 42 - index,
        repository: github.repository,
        title: long
          ? `PR ${42 - index}: ${"a long pull request title that keeps going ".repeat(2)}`
          : index === 0
            ? "Improve the keyboard-driven review workflow"
            : "Add clearer review status indicators",
        updatedAt: "2026-10-14T09:00:00Z",
        url: `https://github.com/example/repo/pull/${42 - index}`,
      })),
    listReviewerCandidates: async () => ({
      recommendationsUnavailable: false,
      users: long
        ? Array.from({ length: 30 }, (_, index) => ({
            login: `user-${index}`,
            name:
              index === 3
                ? "李小龍 Bruce Lee 🐉"
                : `Person ${index} with a fairly long display name`,
            ...(index % 4 === 0
              ? { recommendation: { basedOnCommits: true, basedOnReviewComments: false } }
              : {}),
          }))
        : [
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
    addReviewThread: fail("addReviewThread"),
    addPullRequestComment: fail("addPullRequestComment"),
    replyToReviewComment: fail("replyToReviewComment"),
    submitPendingReview: fail("submitPendingReview"),
    requestReviewers: fail("requestReviewers"),
    setPullRequestDraft: fail("setPullRequestDraft"),
    markFileAsViewed: async () => {},
    unmarkFileAsViewed: async () => {},
    removeCleanupRefs: fail("removeCleanupRefs"),
    mergePullRequest: fail("mergePullRequest"),
    probeFreshness: async () => ({ hasComparisonUpdates: false, hasGitHubUpdates: false }),
    syncRemotes: async () => undefined,
  }),
);
