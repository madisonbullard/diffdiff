import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";

test("the block caret renders the whole emoji it rests on", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  const app = await launchApp(repo, { prepare: (session) => ({ ...session, github }) });
  try {
    await app.press("j", "]", "a");
    await app.paste("A👩🏽‍💻B");
    await app.press("\x1b[D", "\x1b[D");
    expect(app.frame()).toContain("A👩🏽‍💻B");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("paste reaches the active commit search field", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const app = await launchApp(repo);
  try {
    await app.press("l", "\t", "/");
    await app.paste("needle");
    expect(app.frame()).toContain("needle");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("paste reaches the active PR search field", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: { listGitHubPullRequests: async () => [] },
  });
  try {
    await app.press("p", "/");
    await app.paste("needle");
    expect(app.frame()).toContain("needle");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("merge paste is single-line in the title and multiline in the body", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  Object.assign(github.pullRequest.merge, { allowedMethods: ["squash"], canMerge: true });
  let message: { commitTitle?: string; commitMessage?: string } | undefined;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      mergePullRequest: async (_session, input) => {
        message = input;
        return { cleanupCandidates: [], deletedRemoteRefs: [], message: "Merged" };
      },
    },
  });
  try {
    await app.press("m", "\x15");
    await app.paste("New\r\nTitle");
    await app.press("\t");
    await app.paste("first\r\nsecond");
    expect(message).toBeUndefined();
    await app.press("\r", "\r");
    expect(message?.commitTitle).toBe("New Title");
    expect(message?.commitMessage).toBe("first\nsecond");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("pasting a review summary preserves newlines without sending it", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let body: string | undefined;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      submitPendingReview: async (_session, _event, text) => {
        body = text;
      },
    },
  });
  try {
    await app.press("A", "\t");
    await app.paste("first\r\nsecond");
    expect(body).toBeUndefined();
    await app.press("\r");
    expect(body).toBe("first\nsecond");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("pasting into Commands filters literally instead of executing pasted newlines", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  let exits = 0;
  const app = await launchApp(repo, {
    props: {
      onExit: () => {
        exits += 1;
      },
    },
  });
  try {
    await app.press("\x10");
    await app.paste("Quit\r\n");
    expect(app.frame()).toContain('Filtering commands for "Quit"');
    expect(exits).toBe(0);
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("pasting into a reviewer filter joins lines and resets selection to the match", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let requested: readonly string[] | undefined;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      listReviewerCandidates: async () => ({
        users: [{ login: "carol" }, { login: "alice", name: "Alice Bob" }],
        recommendationsUnavailable: false,
      }),
      requestReviewers: async (_session, logins) => {
        requested = logins;
      },
    },
  });
  try {
    await app.press(" ", "w");
    await app.paste("Alice\r\nBob");
    expect(app.frame()).toContain("1 matching user");
    await app.press("\r", "\x13");
    expect(requested).toEqual(["alice"]);
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("bracketed paste inserts text literally without submitting", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let body: string | undefined;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      addReviewThread: async (_session, _anchor, text) => {
        body = text;
      },
    },
  });
  try {
    await app.press("j", "]", "a");
    await app.paste("first\r\nsecond 👩🏽‍💻 李\n");
    expect(body).toBeUndefined();
    expect(app.frame()).toContain("second 👩🏽‍💻 李");
    await app.press("\r");
    expect(body).toBe("first\nsecond 👩🏽‍💻 李");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("opening a composer and typing in one input burst never runs diff commands", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let body: string | undefined;
  let editorCalls = 0;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      addReviewThread: async (_session, _anchor, text) => {
        body = text;
      },
      openFileInEditor: async () => {
        editorCalls += 1;
      },
    },
  });
  try {
    await app.press("j", "]");
    await app.burst("a", "n", "i", "c", "e", "\r");
    expect(body).toBe("nice");
    expect(editorCalls).toBe(0);
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("Tab without a completion never submits a comment", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let calls = 0;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      addReviewThread: async () => {
        calls += 1;
      },
    },
  });
  try {
    await app.press("j", "]", "a", "n", "o", "t", "e", "\t");
    expect(calls).toBe(0);
    expect(app.frame()).toContain("Add Comment");
    expect(app.frame()).toContain("note");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("Tab accepts a file completion without submitting and typing continues after it", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let body: string | undefined;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      addReviewThread: async (_session, _anchor, text) => {
        body = text;
      },
    },
  });
  try {
    await app.press("j", "]");
    await app.burst("a", "@", "\t", "o", "k");
    expect(body).toBeUndefined();
    expect(app.frame()).toContain("`a.ts` ok");
    await app.press("\r");
    expect(body).toBe("`a.ts` ok");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("legacy-terminal Ctrl+J inserts a newline, not a submission", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("input", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let body: string | undefined;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      addReviewThread: async (_session, _anchor, text) => {
        body = text;
      },
    },
  });
  try {
    await app.press("j", "]", "a", "o", "n", "e", "\n", "t", "w", "o");
    expect(body).toBeUndefined();
    await app.press("\r");
    expect(body).toBe("one\ntwo");
  } finally {
    app.destroy();
    repo.dispose();
  }
});
