import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";

test("request-changes requires a summary before sending", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("validation", 3) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let calls = 0;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      submitPendingReview: async () => {
        calls += 1;
      },
    },
  });
  try {
    await app.press("A", "\x1b[B", "\x1b[B", "\r");
    expect(calls).toBe(0);
    await app.press("\t");
    await app.paste("Please fix the failing check.");
    await app.press("\r");
    expect(calls).toBe(1);
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("clicking a reviewer toggles the clicked person, not the previous cursor", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("pointer", 3) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      listReviewerCandidates: async () => ({
        users: [{ login: "alice" }, { login: "bob" }],
        recommendationsUnavailable: false,
      }),
    },
  });
  try {
    await app.press(" ", "w");
    const rows = app.frame().split("\n");
    const row = rows.findIndex((line) => line.includes("@bob"));
    await app.click(rows[row]!.indexOf("@bob") + 1, row);
    expect(app.frame()).toContain("Selected: bob");
    expect(app.frame()).not.toContain("Selected: alice");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("action-bar remaps are truthful and clickable", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("bindings", 3) }]);
  const app = await launchApp(repo, {
    width: 80,
    height: 24,
    props: {
      initialUserKeymapConfig: { commands: { return: "no_op", "ctrl+s": "command-palette.run" } },
    },
  });
  try {
    await app.press("\x10");
    expect(app.frame()).toContain("ctrl+s run");
    expect(app.frame()).not.toContain("enter run");
    const rows = app.frame().split("\n");
    const row = rows.findIndex((line) => line.includes("ctrl+s run"));
    await app.click(rows[row]!.indexOf("ctrl+s run") + 1, row);
    expect(app.frame()).toContain("Compare");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("Compare searches branches without turning typed letters into list commands", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("dialogs", 3) }]);
  const app = await launchApp(repo, { width: 80, height: 24 });
  try {
    await app.press("l", "/");
    await app.paste("no-branch-matches");
    expect(app.frame()).toContain("no-branch-matches");
    expect(app.frame()).toContain("No results");
    await app.press("\x1b");
    await app.waitFor(() => app.frame().includes("[x] Working tree"));
    expect(app.frame()).toContain("Compare");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("review starts on event, Tab edits summary, Esc preserves the draft", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("dialogs", 3) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let submitted: string | undefined;
  const app = await launchApp(repo, {
    width: 80,
    height: 24,
    prepare: (session) => ({ ...session, github }),
    props: {
      submitPendingReview: async (_session, _event, body) => {
        submitted = body;
      },
    },
  });
  try {
    await app.press("A", "j", "\t");
    await app.paste("Summary draft");
    await app.press("\x1b");
    await app.waitFor(() => !app.frame().includes("Submit Review"));
    await app.press("A");
    expect(app.frame()).toContain("Summary draft");
    await app.press("\r");
    expect(submitted).toBe("Summary draft");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("Commands and Keys share one searchable sheet and leader never opens a menu", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("dialogs", 3) }]);
  const app = await launchApp(repo, { width: 80, height: 24 });
  try {
    await app.press("\x18");
    expect(app.frame()).not.toContain("Search keys");
    await app.press("?");
    expect(app.frame()).toContain("Keys");
    expect(app.frame()).toContain("Leader · ctrl+x");
    await app.paste("system.help");
    expect(app.frame()).toContain("system help");
    await app.press("\t");
    expect(app.frame()).toContain('Filtering commands for "system.help"');
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("the compact command picker has readable rows and keeps its selected command visible", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("dialogs", 3) }]);
  const app = await launchApp(repo, { width: 80, height: 24 });
  try {
    await app.press("\x10");
    expect(app.frame()).toContain("Commands");
    expect(app.frame()).toContain("enter run");
    expect(app.frame()).toContain("Open comparison list");
    for (let i = 0; i < 50; i += 1) await app.press("\x1b[B");
    const rows = app.frame().split("\n");
    expect(rows.filter((row) => row.includes("› ")).length).toBe(2);
    expect(app.frame()).not.toContain("Browseotherworking");
  } finally {
    app.destroy();
    repo.dispose();
  }
});
