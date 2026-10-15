import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";
import type { PreparedReviewSession } from "../src/types.ts";

test("a failed background reviewer request keeps its selection for retry", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let fail!: (error: Error) => void;
  const pending = new Promise<void>((_resolve, reject) => {
    fail = reject;
  });
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      listReviewerCandidates: async () => ({
        users: [{ login: "alice" }],
        recommendationsUnavailable: false,
      }),
      requestReviewers: async () => pending,
    },
  });
  try {
    await app.press(" ", "w", "\r", "\x13", "\x1b");
    await app.waitFor(() => !app.frame().includes("Filter by name or username"));
    fail(new Error("offline"));
    await app.settle();
    await app.press(" ", "w");
    expect(app.frame()).toContain("Selected: alice");
    expect(app.frame()).toContain("Your selection is preserved");
  } finally {
    fail(new Error("done"));
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a background merge cannot reload an older session over a newer refresh", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  Object.assign(github.pullRequest.merge, { canMerge: true, allowedMethods: ["squash"] });
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let original!: PreparedReviewSession;
  let loads = 0;
  const app = await launchApp(repo, {
    prepare: (loaded) => {
      original = { ...loaded, github };
      return original;
    },
    props: {
      mergePullRequest: async () => {
        await pending;
        return { cleanupCandidates: [], deletedRemoteRefs: [], message: "Merged" };
      },
      loadSession: async () => {
        loads += 1;
        return loads === 1
          ? {
              ...original,
              github: {
                ...github,
                pullRequest: { ...github.pullRequest, number: 2, title: "Newer session" },
              },
            }
          : original;
      },
    },
  });
  try {
    await app.press("m", "\r", "\r", "\x1b");
    await app.waitFor(() => !app.frame().includes("Merge Pull Request"));
    await app.press("R");
    await app.waitFor(() => app.frame().includes("Newer session"));
    finish();
    await app.settle();
    expect(app.frame()).toContain("Newer session");
    expect(loads).toBe(1);
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a background comment cannot reload an older session over a newer refresh", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let original!: PreparedReviewSession;
  let loads = 0;
  const app = await launchApp(repo, {
    prepare: (loaded) => {
      original = { ...loaded, github };
      return original;
    },
    props: {
      addReviewThread: async () => pending,
      loadSession: async () => {
        loads += 1;
        return loads === 1
          ? {
              ...original,
              github: {
                ...github,
                pullRequest: { ...github.pullRequest, number: 2, title: "Newer session" },
              },
            }
          : original;
      },
    },
  });
  try {
    await app.press("j", "]", "a", "n", "\r", "\x1b");
    await app.waitFor(() => !app.frame().includes("Add Comment"));
    await app.press("R");
    await app.waitFor(() => app.frame().includes("Newer session"));
    expect(app.frame()).toContain("Newer session");
    finish();
    await app.settle();
    expect(app.frame()).toContain("Newer session");
    expect(loads).toBe(1);
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a background review cannot reload an older session over a newer refresh", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let original!: PreparedReviewSession;
  let loads = 0;
  const app = await launchApp(repo, {
    prepare: (loaded) => {
      original = { ...loaded, github };
      return original;
    },
    props: {
      submitPendingReview: async () => pending,
      loadSession: async () => {
        loads += 1;
        return loads === 1
          ? {
              ...original,
              github: {
                ...github,
                pullRequest: { ...github.pullRequest, number: 2, title: "Newer session" },
              },
            }
          : original;
      },
    },
  });
  try {
    await app.press("A", "\r", "\x1b");
    await app.waitFor(() => !app.frame().includes("Submit Review"));
    await app.press("R");
    await app.waitFor(() => app.frame().includes("Newer session"));
    finish();
    await app.settle();
    expect(app.frame()).toContain("Newer session");
    expect(loads).toBe(1);
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("remembered cleanup runs once without opening another dialog", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  Object.assign(github.pullRequest.merge, { canMerge: true, allowedMethods: ["squash"] });
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  let session!: PreparedReviewSession;
  const app = await launchApp(repo, {
    prepare: (loaded) => {
      session = { ...loaded, github };
      return session;
    },
    props: {
      loadSession: async () => session,
      mergePullRequest: async () => ({
        cleanupCandidates: [{ branchName: "feature", kind: "local-branch", ref: "feature" }],
        deletedRemoteRefs: ["origin/feature"],
        message: "Merged",
      }),
      removeCleanupRefs: async () => {
        calls += 1;
        await pending;
      },
    },
  });
  try {
    await app.press("m", "\r", "\r");
    expect(app.frame()).not.toContain("Post-Merge Cleanup");
    await app.burst("\r", "\r");
    expect(calls).toBe(1);
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a failed comment releases its write claim for an explicit retry", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let calls = 0;
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      addReviewThread: async () => {
        calls += 1;
        throw new Error("offline");
      },
    },
  });
  try {
    await app.press("j", "]", "a", "n", "o", "t", "e", "\r");
    expect(calls).toBe(1);
    await app.burst("\r", "\r");
    expect(calls).toBe(2);
    expect(app.frame()).toContain("note");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("Esc backgrounds reviewer requests and reopening cannot resend", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  let session!: PreparedReviewSession;
  const app = await launchApp(repo, {
    prepare: (loaded) => {
      session = { ...loaded, github };
      return session;
    },
    props: {
      loadSession: async () => session,
      listReviewerCandidates: async () => ({
        users: [{ login: "alice" }],
        recommendationsUnavailable: false,
      }),
      requestReviewers: async () => {
        calls += 1;
        await pending;
      },
    },
  });
  try {
    await app.press(" ", "w", "\r", "\x13", "\x1b");
    await app.waitFor(() => !app.frame().includes("Filter by name or username"));
    await app.press(" ", "w", "\x13");
    expect(app.frame()).toContain("Request reviewers");
    expect(calls).toBe(1);
    finish();
    await app.settle();
    expect(app.frame()).toContain("Request reviewers");
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
}, 20000);

test("a failed background comment is reported without covering the current dialog", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let fail!: (error: Error) => void;
  const pending = new Promise<void>((_resolve, reject) => {
    fail = reject;
  });
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: { addReviewThread: async () => pending },
  });
  try {
    await app.press("j", "]", "a", "n", "o", "t", "e", "\r", "\u001b");
    await app.waitFor(() => !app.frame().includes("Add Comment"));
    await app.press("A");
    fail(new Error("permission denied"));
    await app.settle();
    expect(app.frame()).toContain("Submit Review");
    expect(app.frame().split("\n").at(-2)).toContain("✗");
    expect(app.frame()).not.toContain("Error  ");
    expect(app.frame().split("permission denied").length - 1).toBe(1);
  } finally {
    fail(new Error("done"));
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a backgrounded merge cannot replace another dialog with cleanup", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  Object.assign(github.pullRequest.merge, {
    canMerge: true,
    mergeable: true,
    allowedMethods: ["squash"],
  });
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let session!: PreparedReviewSession;
  const app = await launchApp(repo, {
    prepare: (loaded) => {
      session = { ...loaded, github };
      return session;
    },
    props: {
      loadSession: async () => session,
      mergePullRequest: async () => {
        await pending;
        return {
          cleanupCandidates: [{ branchName: "feature", kind: "local-branch", ref: "feature" }],
          deletedRemoteRefs: ["origin/feature"],
          message: "Merged",
        };
      },
    },
  });
  try {
    await app.press("m", "\r", "\r", "\u001b");
    await app.waitFor(() => !app.frame().includes("Merge Pull Request"));
    await app.press("A");
    expect(app.frame()).toContain("Submit Review");
    finish();
    await app.settle();
    expect(app.frame()).toContain("Submit Review");
    expect(app.frame()).not.toContain("Post-Merge Cleanup");
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a comment completing after Esc cannot close a reopened composer", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let session!: PreparedReviewSession;
  const app = await launchApp(repo, {
    prepare: (loaded) => {
      session = { ...loaded, github };
      return session;
    },
    props: { loadSession: async () => session, addReviewThread: async () => pending },
  });
  try {
    await app.press("j", "]", "a", "n", "o", "t", "e", "\r", "\u001b");
    await app.waitFor(() => !app.frame().includes("Add Comment"));
    await app.press("]", "a");
    expect(app.frame()).toContain("Add Comment");
    finish();
    await app.settle();
    expect(app.frame()).toContain("Add Comment");
    await app.press("n", "e", "w");
    expect(app.frame()).toContain("new");
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a review completing after Esc cannot close a reopened submission form", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let session!: PreparedReviewSession;
  const app = await launchApp(repo, {
    prepare: (loaded) => {
      session = { ...loaded, github };
      return session;
    },
    props: { loadSession: async () => session, submitPendingReview: async () => pending },
  });
  try {
    await app.press("A", "\r", "\u001b");
    await app.waitFor(() => !app.frame().includes("Submit Review"));
    await app.press("A");
    finish();
    await app.settle();
    expect(app.frame()).toContain("Submit Review");
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a burst of confirmation Enters merges only once", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  github.pullRequest.merge.canMerge = true;
  github.pullRequest.merge.mergeable = true;
  github.pullRequest.merge.mergeableState = "clean";
  github.pullRequest.merge.allowedMethods = ["squash"];
  let calls = 0;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      mergePullRequest: async () => {
        calls += 1;
        await pending;
        return { cleanupCandidates: [], deletedRemoteRefs: [], message: "Merged" };
      },
    },
  });
  try {
    await app.press("m", "\r");
    expect(app.frame()).toContain("Press Enter to merge now");
    await app.burst("\r", "\r");
    expect(calls).toBe(1);
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a burst of Enters submits a review only once", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let calls = 0;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      submitPendingReview: async () => {
        calls += 1;
        await pending;
      },
    },
  });
  try {
    await app.press("A");
    expect(app.frame()).toContain("Submit Review");
    await app.burst("\r", "\r");
    expect(calls).toBe(1);
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("a burst of Enters sends a comment only once", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let calls = 0;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: {
      addReviewThread: async () => {
        calls += 1;
        await pending;
      },
    },
  });
  try {
    await app.press("j", "]", "a", "n", "o", "t", "e");
    expect(app.frame()).toContain("Add Comment");
    await app.burst("\r", "\r");
    expect(calls).toBe(1);
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});

test("sending pauses composer input but Esc still closes it", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("guard", 4) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, github }),
    props: { addReviewThread: async () => pending },
  });
  try {
    await app.press("j", "]", "a", "n", "o", "t", "e", "\r");
    await app.press("X", "Y", "Z");
    expect(app.frame()).not.toContain("noteXYZ");
    await app.press("\u001b");
    await app.waitFor(() => !app.frame().includes("Add Comment"));
    expect(app.frame()).toContain("Sending comment in the background");
  } finally {
    finish();
    await app.settle();
    app.destroy();
    repo.dispose();
  }
});
