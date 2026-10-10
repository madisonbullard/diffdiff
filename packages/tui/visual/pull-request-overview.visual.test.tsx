import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";
import { getOverviewStateKeys, PR_OVERVIEW_PATH } from "../src/app/review/pull-request-overview.ts";
import type { PreparedReviewSession } from "../src/types.ts";

test("PR overview renders first, navigates with files, and reviews locally", async () => {
  const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("FIRST_FILE", 5) }]);
  const github = githubReview(repo.path, []);
  github.pullRequest.body =
    "## Why this matters\n\nA **careful** description.\n\n- First benefit\n- Second benefit";
  let writes = 0;
  let prepared: PreparedReviewSession;
  const app = await launchApp(repo, {
    prepare: (session) => (prepared = { ...session, github }),
    props: {
      markFileAsViewed: async () => {
        writes++;
      },
      loadSession: async () => ({ ...prepared, github }),
    },
  });
  try {
    await app.waitFor(
      () => app.frame().includes("Why this matters") && !app.frame().includes("## Why"),
    );
    expect(app.frame()).not.toContain("**careful**");
    expect(app.frame()).toContain("PR overview");
    expect(app.frame()).toContain("Why this matters");
    expect(app.frame()).toContain("@author");
    expect(app.frame()).toContain("feature → main");
    await app.press("c");
    expect(app.frame()).not.toContain("Why this matters");
    await app.press("c");
    expect(app.frame()).toContain("Why this matters");
    await app.press("j");
    expect(app.diffPane().stickyPath).toBe("src/a.ts");
    await app.press("k");
    expect(app.frame()).toContain("Why this matters");
    await app.press("x");
    expect(writes).toBe(0);
    expect(app.diffPane().stickyPath).toBe("src/a.ts");
    await app.press("g", "g");
    expect(app.frame()).toContain("✓ Reviewed");
    expect(app.frame()).not.toContain("Why this matters");
    await app.press("c");
    expect(app.frame()).toContain("Why this matters");
    await app.press("TAB", "ENTER");
    expect(app.frame()).toContain("Why this matters");
    await app.press("R");
    await app.waitFor(() => app.frame().includes("Why this matters"));
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("cached overview state restores; edited descriptions become unread and expanded", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: "changed\n" }]);
  const github = githubReview(repo.path, []);
  github.pullRequest.body = "Original description";
  const keys = getOverviewStateKeys(github.pullRequest);
  let prepared: PreparedReviewSession;
  const app = await launchApp(repo, {
    prepare: (session) => (prepared = { ...session, github }),
    props: {
      initialReviewCache: {
        collapsedPaths: [],
        selectedFilePath: PR_OVERVIEW_PATH,
        commentCollapseStates: { [keys.reviewed]: true, [keys.collapsed]: true },
      },
      loadSession: async () => ({
        ...prepared,
        github: { ...github, pullRequest: { ...github.pullRequest, body: "Updated description" } },
      }),
    },
  });
  try {
    expect(app.frame()).toContain("✓ Reviewed");
    expect(app.frame()).not.toContain("Original description");
    await app.press("R");
    await app.waitFor(() => app.frame().includes("Updated description"));
    expect(app.frame()).not.toContain("✓ Reviewed");
    await app.resize(70, 30);
    expect(app.frame()).toContain("Updated description");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("a PR with no changed files still supports overview review and collapse", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: "changed\n" }]);
  const github = githubReview(repo.path, []);
  const app = await launchApp(repo, { prepare: (session) => ({ ...session, files: [], github }) });
  try {
    expect(app.frame()).toContain("No description provided.");
    await app.press("x");
    expect(app.frame()).toContain("✓ Reviewed");
    expect(app.frame()).not.toContain("No description provided.");
    await app.press("x", "c");
    expect(app.frame()).toContain("No description provided.");
    expect(app.frame()).not.toContain("✓ Reviewed");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("long overview scroll position survives refresh and file navigation remains anchored", async () => {
  const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("AFTER_OVERVIEW", 6) }]);
  const github = githubReview(repo.path, []);
  github.pullRequest.body = Array.from(
    { length: 100 },
    (_, index) => `OVERVIEW_PARAGRAPH_${index}`,
  ).join("\n\n");
  let prepared: PreparedReviewSession;
  const app = await launchApp(repo, {
    prepare: (session) => (prepared = { ...session, github }),
    props: { loadSession: async () => ({ ...prepared, github }) },
  });
  try {
    await app.waitFor(() => app.frame().includes("OVERVIEW_PARAGRAPH_0"));
    await app.press("\x04", "\x04");
    const visibleParagraphs = () =>
      app
        .frame()
        .split("\n")
        .filter((line) => line.includes("OVERVIEW_PARAGRAPH"));
    const before = visibleParagraphs();
    expect(before.length > 0).toBe(true);
    expect(before.join("\n")).not.toContain("OVERVIEW_PARAGRAPH_0 ");
    await app.press("R");
    await app.waitFor(() => app.frame().includes("Refreshed branches and GitHub data."));
    expect(visibleParagraphs()).toEqual(before);
    await app.press("j");
    expect(app.diffPane().stickyPath).toBe("src/a.ts");
    expect(app.diffPane().rows[0]).toContain("AFTER_OVERVIEW line 1");
    await app.press("k");
    expect(app.frame()).toContain("OVERVIEW_PARAGRAPH_0");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("mouse review and collapse controls work without opening a fictitious file in the editor", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: "changed\n" }]);
  const github = githubReview(repo.path, []);
  let editorCalls = 0;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      openFileInEditor: async () => {
        editorCalls++;
      },
    },
  });
  try {
    await app.press("TAB", "\x18", "e");
    expect(editorCalls).toBe(0);
    const lines = app.frame().split("\n");
    const row = lines.findIndex((line) => line.includes("○ Mark reviewed"));
    await app.click(lines[row]!.indexOf("○ Mark reviewed") + 2, row);
    await app.press("g", "g");
    expect(app.frame()).toContain("✓ Reviewed");
    const collapsed = app.frame().split("\n");
    const collapsedRow = collapsed.findIndex((line) => line.includes("▶ PR overview"));
    await app.click(collapsed[collapsedRow]!.indexOf("▶ PR overview") + 1, collapsedRow);
    expect(app.frame()).toContain("No description provided.");
  } finally {
    app.destroy();
    repo.dispose();
  }
});
