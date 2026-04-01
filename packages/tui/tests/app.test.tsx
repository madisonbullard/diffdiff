import type { StartupOptions } from "@diffdiff/core";
import type { ReactNode } from "react";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { DiffdiffApp } from "../src/app.tsx";
import { FileCard } from "../src/components.tsx";
import { getUiTheme } from "../src/theme.ts";
import type { PreparedReviewFile, PreparedReviewSession } from "../src/types.ts";

interface KeyboardInput {
  name: string;
  sequence?: string;
  shift?: boolean;
}

const selectionCopyState = vi.hoisted(() => ({
  copySelection: vi.fn(),
}));

type MockRenderer = {
  clearSelection: () => void;
  getSelection: () => null;
  on: (event: string, handler: (...args: unknown[]) => void) => MockRenderer;
  off: (event: string, handler: (...args: unknown[]) => void) => MockRenderer;
  emit: (event: string, ...args: unknown[]) => boolean;
  removeAllListeners: () => MockRenderer;
};

const rendererState = vi.hoisted(() => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const renderer: MockRenderer = {
    clearSelection: () => undefined,
    getSelection: () => null,
    on(event, handler) {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(handler);
      listeners.set(event, eventListeners);
      return renderer;
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
      return renderer;
    },
    emit(event, ...args) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }

      return (listeners.get(event)?.size ?? 0) > 0;
    },
    removeAllListeners() {
      listeners.clear();
      return renderer;
    },
  };

  return { renderer };
});

const registeredKeyboardHandlers = new Set<(key: KeyboardInput) => void>();

vi.mock("@opentui/react", () => {
  return {
    useKeyboard(handler: (key: KeyboardInput) => void) {
      registeredKeyboardHandlers.add(handler);
    },
    useRenderer() {
      return rendererState.renderer;
    },
    useTerminalDimensions() {
      return { width: 160, height: 40 };
    },
  };
});

vi.mock("../src/selection-copy.ts", () => ({
  copySelection: selectionCopyState.copySelection,
}));

const theme = getUiTheme("pierre-dark");
const syntaxStyle = { kind: "syntax-style" } as unknown as import("@opentui/core").SyntaxStyle;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  registeredKeyboardHandlers.clear();
  rendererState.renderer.removeAllListeners();
  selectionCopyState.copySelection.mockReset().mockReturnValue(false);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  registeredKeyboardHandlers.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("removes main scroll focus while a modal is open", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(true);

  emitKey({ name: "l" });
  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(false);

  emitKey({ name: "escape" });
  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(true);
});

test("tab switches to the file tree and tree navigation opens files", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "tab", sequence: "\t" });

  expect(getTreeScrollbox(tree).props.focused).toBe(true);
  expect(getDiffScrollbox(tree).props.focused).toBe(false);

  emitKey({ name: "j" });
  expect(getSelectedFileLabel(tree)).toContain("src/utils.ts");

  emitKey({ name: "right" });
  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(true);
});

test("keeps background file selection stable when modal handlers rerender", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  expect(getSelectedFileLabel(tree)).toContain("src/app.ts");
  expect(registeredKeyboardHandlers.size).toBe(1);

  emitKey({ name: "l" });
  expect(registeredKeyboardHandlers.size).toBe(1);

  emitKey({ name: "j" });

  expect(getSelectedFileLabel(tree)).toContain("src/app.ts");
});

test("starts deleted file diffs collapsed", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          files: [
            createPreparedFile({ path: "src/removed.ts", status: "deleted" }),
            createPreparedFile({ path: "src/app.ts" }),
          ],
        }),
      })}
    />,
  );

  const [deletedCard] = tree.root.findAllByType(FileCard);

  expect(deletedCard?.props.file.path).toBe("src/removed.ts");
  expect(deletedCard?.props.isCollapsed).toBe(true);
});

test("shows a copy toast for five seconds after a successful copy", () => {
  vi.useFakeTimers();
  selectionCopyState.copySelection.mockImplementation(
    (_renderer: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
      return true;
    },
  );

  const tree = render(<DiffdiffApp {...createAppProps()} />);

  expect(getAppText(tree)).not.toContain("Copied to clipboard");

  act(() => {
    getRootBox(tree).props.onMouseUp?.();
  });

  expect(getAppText(tree)).toContain("Copied to clipboard");

  act(() => {
    vi.advanceTimersByTime(4999);
  });

  expect(getAppText(tree)).toContain("Copied to clipboard");

  act(() => {
    vi.advanceTimersByTime(1);
  });

  expect(getAppText(tree)).not.toContain("Copied to clipboard");
});

test("starts commit browsing at the top of the commit list", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          commits: [
            {
              sha: "1111111111111111",
              shortSha: "1111111",
              subject: "Newest commit",
              author: "Top Author",
            },
            {
              sha: "2222222222222222",
              shortSha: "2222222",
              subject: "Older commit",
              author: "Bottom Author",
            },
          ],
        }),
      })}
    />,
  );

  emitKey({ name: "l" });
  emitKey({ name: "tab", sequence: "\t" });

  expect(getAppText(tree)).toContain("Newest commit");
  expect(getAppText(tree)).toContain("Top Author");
  expect(getAppText(tree)).not.toContain("Bottom Author");
});

test("shows an animated event log entry while loading a new base branch", async () => {
  vi.useFakeTimers();
  const nextSession = createPreparedSession({
    comparison: {
      base: "main",
      head: "feature/tui",
      range: "main...feature/tui",
      mode: "range",
      usesMergeBase: true,
    },
  });
  const deferredSession = createDeferred<PreparedReviewSession>();
  const loadSession = vi.fn(() => deferredSession.promise);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession(),
        loadSession,
      })}
    />,
  );

  emitKey({ name: "l" });
  emitKey({ name: "j" });
  emitKey({ name: "b" });

  expect(loadSession).toHaveBeenCalledWith({
    base: "main",
    head: "feature/tui",
  });
  expect(getAppText(tree)).toContain("Updating base to main...");
  expect(getAppText(tree)).not.toContain("Loading...");
  expect(getAppText(tree)).toMatch(/⠋\s+Updating base to main\.\.\./);

  act(() => {
    vi.advanceTimersByTime(80);
  });

  expect(getAppText(tree)).toMatch(/⠙\s+Updating base to main\.\.\./);

  deferredSession.resolve(nextSession);
  await act(async () => {
    await deferredSession.promise;
  });

  expect(getAppText(tree)).not.toContain("Updating base to main...");
});

test("refreshes git state when the terminal regains focus", async () => {
  const nextSession = createPreparedSession({
    repository: {
      kind: "git",
      rootPath: "/tmp/diffdiff",
      name: "diffdiff",
      remotes: [{ name: "origin", fetchUrl: "git@github.com:diffdiff/diffdiff.git" }],
      currentBranch: "feature/fresh",
      defaultBranch: "main",
    },
    branches: {
      local: [
        {
          kind: "local",
          name: "feature/fresh",
          ref: "refs/heads/feature/fresh",
          sha: "1234abc",
          isCurrent: true,
          isDefault: false,
        },
        {
          kind: "local",
          name: "main",
          ref: "refs/heads/main",
          sha: "7654321",
          isCurrent: false,
          isDefault: true,
        },
      ],
      remote: [
        {
          kind: "remote",
          name: "origin/feature/fresh",
          ref: "refs/remotes/origin/feature/fresh",
          sha: "fedcba9",
          remoteName: "origin",
          isCurrent: false,
          isDefault: false,
        },
        {
          kind: "remote",
          name: "origin/main",
          ref: "refs/remotes/origin/main",
          sha: "fedcba0",
          remoteName: "origin",
          isCurrent: false,
          isDefault: true,
        },
      ],
    },
  });
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        loadSession,
      })}
    />,
  );

  await act(async () => {
    rendererState.renderer.emit("blur");
    rendererState.renderer.emit("focus");
  });

  expect(loadSession).toHaveBeenCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
  expect(getAppText(tree)).toContain("feature/fresh");

  emitKey({ name: "l" });

  expect(getAppText(tree)).toContain("feature/fresh");
});

test("opens PR review mode from the list modal", () => {
  const loadSession = vi.fn(async () =>
    createPreparedSession({ github: createGitHubReviewSession() }),
  );
  render(
    <DiffdiffApp
      {...createAppProps({
        loadSession,
      })}
    />,
  );

  emitKey({ name: "l" });
  emitKey({ name: "j" });
  emitKey({ name: "j" });
  emitKey({ name: "return" });

  expect(loadSession).toHaveBeenCalledWith({
    base: "origin/main",
    head: "origin/feature/tui",
  });
});

test("shows PR review context and can toggle outdated threads", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  expect(getAppText(tree)).toContain("PR #42");
  expect(getAppText(tree)).toContain("Build TUI reviewer");
  expect(getAppText(tree)).toContain("Please rename this variable.");
  expect(getAppText(tree)).not.toContain("This thread is outdated.");

  emitKey({ name: "u" });

  expect(getAppText(tree)).toContain("This thread is outdated.");
});

test("opens the PR comments modal from review mode", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  expect(getAppText(tree)).not.toContain("Looks ready to merge.");

  emitKey({ name: "t" });

  expect(getAppText(tree)).toContain("Comments");
  expect(getAppText(tree)).toContain("Looks ready to merge.");
});

test("opens the comment composer and submits a pending review thread", async () => {
  const addReviewThread = vi.fn(async () => undefined);
  const nextSession = createPreparedSession({ github: createGitHubReviewSession() });
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        addReviewThread,
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
      })}
    />,
  );

  emitKey({ name: "a" });

  expect(getAppText(tree)).toContain("Add Comment");
  expect(getAppText(tree)).toContain("const count = 0");

  emitText("Looks good");
  await emitAsyncKey({ name: "return" });

  expect(addReviewThread).toHaveBeenCalledWith(
    expect.objectContaining({ pullRequest: expect.objectContaining({ number: 42 }) }),
    expect.objectContaining({ line: 1, path: "src/app.ts", side: "LEFT" }),
    "Looks good",
  );
  expect(loadSession).toHaveBeenLastCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
});

test("opens the submit review modal and submits the pending review", async () => {
  const submitPendingReview = vi.fn(async () => undefined);
  const loadSession = vi.fn(async () =>
    createPreparedSession({ github: createGitHubReviewSession() }),
  );
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
        submitPendingReview,
      })}
    />,
  );

  emitKey({ name: "s" });

  expect(getAppText(tree)).toContain("Submit Review");
  expect(getAppText(tree)).toContain("Comment");

  emitKey({ name: "j" });
  emitText("Ship it");
  await emitAsyncKey({ name: "return" });

  expect(submitPendingReview).toHaveBeenCalledWith(
    expect.objectContaining({ pullRequest: expect.objectContaining({ number: 42 }) }),
    "APPROVE",
    "Ship it",
  );
});

function createAppProps(overrides: Partial<ReturnType<typeof createAppPropsBase>> = {}) {
  return {
    ...createAppPropsBase(),
    ...overrides,
  };
}

function createAppPropsBase() {
  const initialOptions = {
    base: "origin/main",
    head: "feature/tui",
  } satisfies StartupOptions;

  const initialSession = createPreparedSession();

  return {
    addReviewThread: vi.fn(async () => undefined),
    initialOptions,
    initialSession,
    loadSession: vi.fn(async () => initialSession),
    onExit: vi.fn(),
    submitPendingReview: vi.fn(async () => undefined),
    syntaxStyle,
    theme,
  };
}

function createPreparedSession(
  overrides: Partial<PreparedReviewSession> = {},
): PreparedReviewSession {
  return {
    repository: {
      kind: "git",
      rootPath: "/tmp/diffdiff",
      name: "diffdiff",
      remotes: [{ name: "origin", fetchUrl: "git@github.com:diffdiff/diffdiff.git" }],
      currentBranch: "feature/tui",
      defaultBranch: "main",
    },
    comparison: {
      base: "origin/main",
      head: "feature/tui",
      range: "origin/main...feature/tui",
      mode: "range",
      usesMergeBase: true,
    },
    files: [createPreparedFile(), createPreparedFile({ path: "src/utils.ts" })],
    branches: {
      local: [
        {
          kind: "local",
          name: "feature/tui",
          ref: "refs/heads/feature/tui",
          sha: "1234567",
          isCurrent: true,
          isDefault: false,
        },
        {
          kind: "local",
          name: "main",
          ref: "refs/heads/main",
          sha: "7654321",
          isCurrent: false,
          isDefault: true,
        },
      ],
      remote: [
        {
          kind: "remote",
          name: "origin/feature/tui",
          ref: "refs/remotes/origin/feature/tui",
          sha: "abcdef0",
          remoteName: "origin",
          isCurrent: false,
          isDefault: false,
          pullRequest: {
            number: 42,
            title: "Build TUI reviewer",
            url: "https://github.com/diffdiff/diffdiff/pull/42",
            headRefName: "feature/tui",
            baseRefName: "main",
          },
        },
        {
          kind: "remote",
          name: "origin/main",
          ref: "refs/remotes/origin/main",
          sha: "fedcba0",
          remoteName: "origin",
          isCurrent: false,
          isDefault: true,
        },
      ],
    },
    commits: [
      {
        sha: "1234567890abcdef",
        shortSha: "1234567",
        subject: "Revamp the list modal",
        author: "Madison Bullard",
      },
    ],
    workingTreeSummary: {
      filesChanged: 3,
      additions: 12,
      deletions: 4,
    },
    warnings: [],
    themeName: "pierre-dark",
    ...overrides,
  };
}

function createGitHubReviewSession(): PreparedReviewSession["github"] {
  return {
    auth: {
      host: "github.com",
      isAuthenticated: true,
      tokenSource: "config",
    },
    pullRequest: {
      author: {
        login: "madison",
        url: "https://github.com/madison",
      },
      baseRefName: "main",
      body: "Adds PR review mode.",
      checks: {
        failed: 0,
        pending: 0,
        state: "success",
        successful: 1,
        total: 1,
      },
      headRefName: "feature/tui",
      headSha: "headsha",
      isDraft: false,
      isMerged: false,
      merge: {
        canMerge: true,
        isDraft: false,
        isMerged: false,
        mergeable: true,
        mergeableState: "clean",
      },
      nodeId: "PR_node_42",
      number: 42,
      pendingReview: {
        body: "",
        comments: [],
        id: 9010,
        nodeId: "PRR_pending_9010",
      },
      reviewGroups: [
        {
          author: {
            login: "octocat",
            url: "https://github.com/octocat",
          },
          body: "Looks ready to merge.",
          comments: [
            {
              author: {
                login: "octocat",
                url: "https://github.com/octocat",
              },
              body: "Please rename this variable.",
              createdAt: "2026-04-01T12:01:00Z",
              id: 101,
              isOutdated: false,
              line: 1,
              nodeId: "PRRC_101",
              path: "src/app.ts",
              reviewId: 700,
              side: "RIGHT",
              updatedAt: "2026-04-01T12:01:00Z",
              url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r101",
            },
          ],
          reviewId: 700,
          reviewNodeId: "PRR_700",
          state: "APPROVED",
          submittedAt: "2026-04-01T12:00:00Z",
        },
      ],
      reviewThreads: [
        {
          comments: [
            {
              author: {
                login: "octocat",
                url: "https://github.com/octocat",
              },
              body: "Please rename this variable.",
              createdAt: "2026-04-01T12:01:00Z",
              id: 101,
              isOutdated: false,
              line: 1,
              nodeId: "PRRC_101",
              path: "src/app.ts",
              reviewId: 700,
              side: "RIGHT",
              updatedAt: "2026-04-01T12:01:00Z",
              url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r101",
            },
          ],
          id: "101",
          isOutdated: false,
          line: 1,
          path: "src/app.ts",
          reviewId: 700,
          side: "RIGHT",
        },
        {
          comments: [
            {
              author: {
                login: "review-bot",
                url: "https://github.com/review-bot",
              },
              body: "This thread is outdated.",
              createdAt: "2026-04-01T12:03:00Z",
              id: 102,
              isOutdated: true,
              nodeId: "PRRC_102",
              originalLine: 1,
              path: "src/app.ts",
              reviewId: 701,
              side: "RIGHT",
              updatedAt: "2026-04-01T12:03:00Z",
              url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r102",
            },
          ],
          id: "102",
          isOutdated: true,
          originalLine: 1,
          path: "src/app.ts",
          reviewId: 701,
          side: "RIGHT",
        },
      ],
      state: "open",
      title: "Build TUI reviewer",
      url: "https://github.com/diffdiff/diffdiff/pull/42",
    },
    remoteName: "origin",
    repository: {
      forge: "github",
      host: "github.com",
      owner: "diffdiff",
      repo: "diffdiff",
    },
  };
}

function createPreparedFile(overrides: Partial<PreparedReviewFile> = {}): PreparedReviewFile {
  return {
    additions: 3,
    deletions: 1,
    diff: undefined,
    isBinary: false,
    lineNumberWidth: 2,
    patch: "diff --git a/src/app.ts b/src/app.ts",
    path: "src/app.ts",
    renderError: undefined,
    sideBySideRows: [
      {
        kind: "hunk",
        segments: [{ text: "@@ -1,2 +1,3 @@" }],
      },
      {
        kind: "line",
        left: {
          kind: "deletion",
          lineNumber: 1,
          segments: [{ text: "const count = 0", fg: "#ff7b72" }],
        },
        right: {
          kind: "addition",
          lineNumber: 1,
          segments: [{ text: "const count = 1", fg: "#3fb950" }],
        },
      },
    ],
    status: "modified",
    unifiedLines: [
      {
        kind: "hunk",
        segments: [{ text: "@@ -1,2 +1,3 @@" }],
      },
      {
        kind: "deletion",
        oldLineNumber: 1,
        segments: [{ text: "const count = 0", fg: "#ff7b72" }],
      },
      {
        kind: "addition",
        newLineNumber: 1,
        segments: [{ text: "const count = 1", fg: "#3fb950" }],
      },
    ],
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function emitKey(key: KeyboardInput): void {
  act(() => {
    for (const handler of Array.from(registeredKeyboardHandlers)) {
      handler(key);
    }
  });
}

async function emitAsyncKey(key: KeyboardInput): Promise<void> {
  await act(async () => {
    for (const handler of Array.from(registeredKeyboardHandlers)) {
      handler(key);
    }
  });
}

function emitText(value: string): void {
  for (const character of value) {
    emitKey({ name: character, sequence: character });
  }
}

function getTreeScrollbox(tree: ReactTestRenderer) {
  return tree.root.findAll((node) => String(node.type) === "scrollbox")[0]!;
}

function getDiffScrollbox(tree: ReactTestRenderer) {
  return tree.root.findAll((node) => String(node.type) === "scrollbox")[1]!;
}

function getRootBox(tree: ReactTestRenderer) {
  return tree.root.find((node) => String(node.type) === "box");
}

function getSelectedFileLabel(tree: ReactTestRenderer): string {
  return getAppText(tree);
}

function getAppText(tree: ReactTestRenderer): string {
  return collectText(tree.toJSON());
}

function render(node: ReactNode): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;

  act(() => {
    tree = create(node as never);
  });

  return tree!;
}

function collectText(node: unknown): string {
  if (node == null) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child) => collectText(child)).join(" ");
  }

  if (typeof node === "object" && "children" in node) {
    const children = (node as { children?: unknown[] }).children;
    return children?.map((child) => collectText(child)).join(" ") ?? "";
  }

  return "";
}
