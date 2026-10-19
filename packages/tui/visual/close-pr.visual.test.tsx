import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";
import type { PreparedReviewSession } from "../src/types.ts";

for (const [width, height] of [
  [120, 40],
  [80, 24],
]) {
  test(`close PR confirms without merge controls at ${width}x${height}, retries safely`, async () => {
    const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("close", 4) }]);
    const github = githubReview(repo.path, []);
    github.auth.isAuthenticated = true;
    github.pullRequest.isDraft = true;
    github.pullRequest.merge.allowedMethods = [];
    let writes = 0;
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const app = await launchApp(repo, {
      width,
      height,
      prepare: (session) => ({ ...session, github }),
      props: {
        closePullRequest: async () => {
          writes += 1;
          if (writes === 1) throw new Error("Permission denied");
          await pending;
        },
        loadSession: async () => {
          throw new Error("offline");
        },
        mergePullRequest: async () => {
          throw new Error("must not merge");
        },
        removeCleanupRefs: async () => {
          throw new Error("must not clean up");
        },
      },
    });
    try {
      await app.press("m", "j");
      expect(app.frame()).toContain("● Close PR");
      expect(app.frame()).not.toContain("Commit title");
      expect(app.frame()).not.toContain("Auto-merge");
      await app.press("\t", "\x1b[Z", "\x07", "\x12");
      expect(app.frame()).toContain("● Close PR");
      await app.press("\r");
      expect(writes).toBe(0);
      expect(app.frame()).toContain("close without merging");
      await app.press("\x1b");
      expect(writes).toBe(0);
      await app.press("\r", "\r");
      expect(writes).toBe(1);
      expect(app.frame()).toContain("Permission denied");
      expect(app.frame()).not.toContain("CLOSED PR");
      await app.burst("\r", "\r", "\r", "\r");
      expect(writes).toBe(2);
      await app.press("\x1b", "m", "j", "\r", "\r");
      expect(writes).toBe(2);
      finish();
      await app.settle();
      // This reopened menu has a new owner; the earlier completion must not dismiss it.
      await app.press("\x1b", "\x1b");
      expect(app.frame()).toContain("CLOSED PR");
    } finally {
      finish();
      await app.settle();
      app.destroy();
      repo.dispose();
    }
  });
}

test("a late close keeps a newer session and its dialog intact", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("close", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  github.pullRequest.merge.allowedMethods = [];
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let original!: PreparedReviewSession;
  let loads = 0;
  const app = await launchApp(repo, {
    prepare: (session) => {
      original = { ...session, github };
      return original;
    },
    props: {
      closePullRequest: async () => pending,
      loadSession: async () => {
        loads += 1;
        return {
          ...original,
          github: {
            ...github,
            pullRequest: {
              ...github.pullRequest,
              url: "https://github.com/test/test/pull/2",
              number: 2,
              title: "Newer session",
            },
          },
        };
      },
    },
  });
  try {
    await app.press("m", "j", "\r", "\r", "\x1b", "R");
    await app.waitFor(() => app.frame().includes("Newer session"));
    await app.press("?");
    finish();
    await app.settle();
    expect(loads).toBe(1);
    expect(app.frame()).toContain("Newer session");
    expect(app.frame()).not.toContain("CLOSED PR");
    expect(app.frame()).toContain("Keys");
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});
