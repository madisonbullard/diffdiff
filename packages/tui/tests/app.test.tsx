import type { GitHubUserPreferences, StartupOptions } from "@diffdiff/core";
import type { ComponentProps, ReactNode } from "react";
import type {
  ReactTestInstance,
  ReactTestRenderer,
  TestRendererOptions,
} from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { DiffdiffApp } from "../src/app/DiffdiffApp.tsx";
import { FileCard } from "../src/components/file-card.tsx";
import { getUiTheme } from "../src/theme.ts";
import type { PreparedReviewFile, PreparedReviewSession } from "../src/types.ts";

interface KeyboardInput {
  name: string;
  sequence?: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  super?: boolean;
}

const selectionCopyState = vi.hoisted(() => ({
  copySelection: vi.fn(),
}));

const clipboardState = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(async () => true),
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

const terminalDimensionsState = vi.hoisted(() => ({
  height: 40,
  width: 160,
}));

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
      return terminalDimensionsState;
    },
  };
});

vi.mock("../src/selection-copy.ts", () => ({
  copySelection: selectionCopyState.copySelection,
}));

vi.mock("../src/clipboard.ts", () => ({
  copyTextToClipboard: clipboardState.copyTextToClipboard,
}));

const theme = getUiTheme("pierre-dark");
const syntaxStyle = { kind: "syntax-style" } as unknown as import("@opentui/core").SyntaxStyle;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  registeredKeyboardHandlers.clear();
  rendererState.renderer.removeAllListeners();
  terminalDimensionsState.width = 160;
  terminalDimensionsState.height = 40;
  selectionCopyState.copySelection.mockReset().mockReturnValue(false);
  clipboardState.copyTextToClipboard.mockReset().mockResolvedValue(true);
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

test("opens the command palette with ctrl+p and runs the selected command", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ ctrl: true, name: "p" });

  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(false);
  expect(getAppText(tree)).toContain("Commands");

  emitText("list");
  emitKey({ name: "return" });

  expect(getAppText(tree)).toContain("Opened list modal.");
  expect(getAppText(tree)).toContain("Working tree");
});

test("runs leader key commands with ctrl+x", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ ctrl: true, name: "x" });

  expect(getAppText(tree)).toContain("Leader key active");

  emitKey({ name: "l", sequence: "l" });

  expect(getAppText(tree)).toContain("Opened list modal.");
  expect(getAppText(tree)).toContain("Working tree");
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

test("uses a compact file tree summary when the sidebar is narrow", () => {
  terminalDimensionsState.width = 80;
  const files = [
    createPreparedFile({ additions: 206, deletions: 1 }),
    createPreparedFile({ path: "src/components.tsx", additions: 104, deletions: 3 }),
    createPreparedFile({ path: "src/github-review.tsx", additions: 63, deletions: 35 }),
    createPreparedFile({ path: "src/view-model.ts", additions: 3, deletions: 3 }),
    createPreparedFile({
      path: "tests/__snapshots__/components.test.tsx.snap",
      additions: 219,
      deletions: 0,
    }),
    createPreparedFile({ path: "tests/app.test.tsx", additions: 137, deletions: 5 }),
    createPreparedFile({ path: "tests/components.test.tsx", additions: 41, deletions: 0 }),
    createPreparedFile({ path: "tests/view-model.test.ts", additions: 1, deletions: 0 }),
  ];
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ files }),
        initialReviewCache: {
          collapsedPaths: [],
          selectedFilePath: files[5]!.path,
          reviewedPaths: [files[0]!.path, files[5]!.path],
        },
      })}
    />,
  );

  expect(getAppText(tree)).toContain("2 /8 rev");
  expect(getAppText(tree)).toContain("+774 / -47");
  expect(getAppText(tree)).not.toContain("2 / 8 reviewed");
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

test("uses a compact header for the sticky diff card and removes top list padding", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  const [firstCard, secondCard] = tree.root.findAllByType(FileCard);
  const diffListContent = getDiffScrollbox(tree).find(
    (node) =>
      String(node.type) === "box" &&
      node.parent === getDiffScrollbox(tree) &&
      node.props.paddingLeft === 1 &&
      node.props.gap === 1,
  );

  expect(firstCard?.props.headerVariant).toBe("sticky-compact");
  expect(firstCard?.props.removeTopPadding).toBe(true);
  expect(secondCard?.props.headerVariant).toBeUndefined();
  expect(secondCard?.props.removeTopPadding).toBe(false);
  expect(diffListContent.props.paddingTop).toBeUndefined();
  expect(diffListContent.props.paddingBottom).toBe(1);
});

test("renders base and head as the header comparison tags", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  expect(getAppText(tree)).toContain("base ← origin/main");
  expect(getAppText(tree)).toContain("head → feature/tui");
  expect(getAppText(tree)).not.toContain("branch range");
});

test("renders the current branch with the muted gray header badge", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: {
          ...createPreparedSession(),
          repository: {
            kind: "git",
            rootPath: "/tmp/diffdiff",
            name: "diffdiff",
            remotes: [{ name: "origin", fetchUrl: "git@github.com:diffdiff/diffdiff.git" }],
            currentBranch: "feature/current-branch",
            defaultBranch: "main",
          },
        },
      })}
    />,
  );

  const branchBadge = tree.root.find(
    (node) =>
      String(node.type) === "span" &&
      collectInstanceText(node).includes("feature/current-branch") &&
      node.props.bg != null,
  );

  expect(branchBadge.props.fg).toBe(theme.accent);
  expect(branchBadge.props.bg).toBe(theme.surfaceMuted);
});

test("does not duplicate the working tree label in the header", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          comparison: {
            base: "HEAD",
            head: "working tree",
            range: "HEAD...working tree",
            mode: "working-tree",
            usesMergeBase: false,
          },
        }),
      })}
    />,
  );

  expect(getAppText(tree)).toContain("base ← HEAD");
  expect(getAppText(tree)).toContain("head → working tree");
  expect(getAppText(tree).match(/working tree/gu) ?? []).toHaveLength(1);
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

test("shows a persistent error log toast until dismissed", async () => {
  const logFilePath = "/Users/test/.diffdiff/logs/log-test.jsonl";
  const loadSession = vi.fn(async () => {
    throw new Error("Unable to refresh git state.");
  });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        loadSession,
        logFilePath,
      })}
    />,
  );

  await act(async () => {
    rendererState.renderer.emit("blur");
    rendererState.renderer.emit("focus");
  });

  expect(getAppText(tree)).toContain("Unable to refresh git state.");
  expect(getAppText(tree)).toContain(`View error logs at ${logFilePath}`);

  emitKey({ name: "j" });

  expect(getAppText(tree)).toContain(`View error logs at ${logFilePath}`);

  emitKey({ name: "x", sequence: "x" });

  expect(getAppText(tree)).not.toContain(`View error logs at ${logFilePath}`);
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
  const footerEventBox = tree.root.find(
    (node) =>
      String(node.type) === "box" &&
      node.props.flexGrow === 1 &&
      collectInstanceText(node).includes("Updating base to main..."),
  );

  expect(footerEventBox.props.flexDirection).toBe("row");
  expect(footerEventBox.props.justifyContent).toBe("flex-end");

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

test("shows outdated PR threads collapsed by default and expands them on click", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  expect(getAppText(tree)).toContain("#42");
  expect(getAppText(tree)).toContain("Build TUI reviewer");
  expect(getAppText(tree)).not.toContain("threads");
  expect(getAppText(tree)).toContain("Please rename this variable.");
  expect(getAppText(tree)).not.toContain("This thread is outdated.");
  expect(getAppText(tree)).toContain("outdated");

  const outdatedThreadHeader = tree.root.find(
    (node) =>
      String(node.type) === "box" &&
      typeof node.props.onMouseUp === "function" &&
      node.props.justifyContent === "space-between" &&
      collectInstanceText(node).includes("src/app.ts:1") &&
      collectInstanceText(node).includes("outdated"),
  );

  act(() => {
    outdatedThreadHeader.props.onMouseUp?.();
  });

  expect(getAppText(tree)).toContain("This thread is outdated.");
});

test("uses cached comment collapse state for PR review threads", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialReviewCache: {
          reviewedPaths: [],
          collapsedPaths: [],
          commentCollapseStates: {
            "thread:101": true,
            "thread:102": false,
          },
        },
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  expect(getAppText(tree)).not.toContain("Please rename this variable.");
  expect(getAppText(tree)).toContain("This thread is outdated.");
});

test("renders the PR banner flush with the header", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  const prBanner = tree.root.find(
    (node) =>
      String(node.type) === "box" &&
      collectInstanceText(node).includes("#42") &&
      collectInstanceText(node).includes("Build TUI reviewer") &&
      collectInstanceText(node).includes("merge ready") &&
      !collectInstanceText(node).includes("diffdiff"),
  );

  expect(prBanner.props.border).toBeUndefined();
  expect(prBanner.props.paddingLeft).toBeUndefined();
  expect(prBanner.props.paddingRight).toBeUndefined();
  expect(prBanner.props.paddingTop).toBeUndefined();
  expect(prBanner.props.paddingBottom).toBeUndefined();
  expect(prBanner.props.backgroundColor).toBeUndefined();
  expect(prBanner.findAll((node) => String(node.type) === "text")).toHaveLength(1);
});

test("uses the draft PR tag instead of a separate draft status", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession()!.pullRequest,
              isDraft: true,
              merge: {
                ...createGitHubReviewSession()!.pullRequest.merge,
                canMerge: false,
                isDraft: true,
                mergeableState: "blocked",
              },
            },
          }),
        }),
      })}
    />,
  );

  const draftTag = tree.root.find(
    (node) => String(node.type) === "span" && collectInstanceText(node).includes("DRAFT PR"),
  );

  expect(draftTag.props.bg).toBe(theme.warning);
  expect(getAppText(tree)).toContain("DRAFT PR");
  expect(getAppText(tree)).toContain("#42");
  expect(getAppText(tree)).not.toContain(" draft ");
  expect(getAppText(tree)).toContain("merge blocked");
});

test("shows a red closed PR tag", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession()!.pullRequest,
              state: "closed",
              merge: {
                ...createGitHubReviewSession()!.pullRequest.merge,
                canMerge: false,
                mergeableState: "blocked",
              },
            },
          }),
        }),
      })}
    />,
  );

  const closedTag = tree.root.find(
    (node) => String(node.type) === "span" && collectInstanceText(node).includes("CLOSED PR"),
  );

  expect(closedTag.props.bg).toBe(theme.danger);
  expect(getAppText(tree)).toContain("CLOSED PR");
  expect(getAppText(tree)).toContain("#42");
  expect(getAppText(tree)).toContain("closed");
});

test("opens the PR comments modal from review mode", () => {
  const pendingComment = "This pending review note should stay hidden.";
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession()!.pullRequest,
              pendingReview: {
                body: pendingComment,
                comments: [
                  {
                    author: {
                      login: "madisonbullard",
                      url: "https://github.com/madisonbullard",
                    },
                    body: pendingComment,
                    createdAt: "2026-04-01T12:02:00Z",
                    id: 102,
                    isOutdated: false,
                    nodeId: "PRRC_102",
                    path: "src/app.ts",
                    reviewId: 9010,
                    side: "RIGHT",
                    updatedAt: "2026-04-01T12:02:00Z",
                    url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r102",
                  },
                ],
                id: 9010,
                nodeId: "PRR_pending_9010",
              },
              reviewGroups: [
                ...createGitHubReviewSession()!.pullRequest.reviewGroups,
                {
                  author: {
                    login: "madisonbullard",
                    url: "https://github.com/madisonbullard",
                  },
                  body: pendingComment,
                  comments: [
                    {
                      author: {
                        login: "madisonbullard",
                        url: "https://github.com/madisonbullard",
                      },
                      body: pendingComment,
                      createdAt: "2026-04-01T12:02:00Z",
                      id: 102,
                      isOutdated: false,
                      nodeId: "PRRC_102",
                      path: "src/app.ts",
                      reviewId: 9010,
                      side: "RIGHT",
                      updatedAt: "2026-04-01T12:02:00Z",
                      url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r102",
                    },
                  ],
                  reviewId: 9010,
                  reviewNodeId: "PRR_pending_9010",
                  state: "PENDING",
                },
              ],
            },
          }),
        }),
      })}
    />,
  );

  expect(getAppText(tree)).not.toContain("Looks ready to merge.");

  emitKey({ name: "t" });

  expect(getAppText(tree)).toContain("Comments");
  expect(getAppText(tree)).toContain("Looks ready to merge.");
  expect(getAppText(tree)).not.toContain("Grouped by GitHub review");
  expect(getAppText(tree)).not.toContain(pendingComment);
  expect(getAppText(tree)).not.toContain("pending");
});

test("copies the PR URL from review mode", async () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  emitKey({ name: "y", sequence: "y" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(clipboardState.copyTextToClipboard).toHaveBeenCalledWith(
    "https://github.com/diffdiff/diffdiff/pull/42",
  );
  expect(getAppText(tree)).toContain("Copied PR URL to clipboard");
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

test("opens the comment composer when only the raw patch is available", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          files: [
            createPreparedFile({
              patch: [
                "diff --git a/src/app.ts b/src/app.ts",
                "--- a/src/app.ts",
                "+++ b/src/app.ts",
                "@@ -1 +1 @@",
                "-const count = 0",
                "+const count = 1",
              ].join("\n"),
              sideBySideRows: [],
              unifiedLines: [],
            }),
          ],
          github: createGitHubReviewSession(),
        }),
      })}
    />,
  );

  emitKey({ name: "a" });

  expect(getAppText(tree)).toContain("Add Comment");
  expect(getAppText(tree)).toContain("const count = 0");
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

test("opens the merge modal and merges with the selected method", async () => {
  const mergePullRequestSpy = vi.fn();
  const mergePullRequest: NonNullable<DiffdiffAppProps["mergePullRequest"]> = async (
    reviewSession,
    input,
  ) => {
    mergePullRequestSpy(reviewSession, input);
    return {
      cleanupCandidates: [],
      deletedRemoteRefs: [],
      message: "Pull Request successfully merged",
      sha: "mergedsha",
    };
  };
  const nextSession = createPreparedSession({
    github: createGitHubReviewSession({
      pullRequest: {
        ...createGitHubReviewSession()!.pullRequest,
        isMerged: true,
        merge: {
          ...createGitHubReviewSession()!.pullRequest.merge,
          canMerge: false,
          isMerged: true,
          mergedAt: "2026-04-01T13:00:00Z",
        },
      },
    }),
  });
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
        mergePullRequest,
      })}
    />,
  );

  emitKey({ name: "m" });

  expect(getAppText(tree)).toContain("Merge Pull Request");
  expect(getAppText(tree)).toContain("Adds PR review mode.");

  emitKey({ name: "j" });
  await emitAsyncKey({ name: "return" });

  expect(mergePullRequestSpy).toHaveBeenCalledWith(
    expect.objectContaining({ pullRequest: expect.objectContaining({ number: 42 }) }),
    expect.objectContaining({
      commitMessage: "Adds PR review mode.",
      commitTitle: "Build TUI reviewer",
      method: "squash",
    }),
  );
  expect(loadSession).toHaveBeenLastCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
});

test("caps the merge body input height and scrolls to the cursor", () => {
  const scrollboxes: ReturnType<typeof createMockScrollbox>[] = [];
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
    {
      createNodeMock(element) {
        if (element.type === "scrollbox") {
          const scrollbox = createMockScrollbox(false);
          scrollboxes.push(scrollbox);
          return scrollbox;
        }

        return null;
      },
    },
  );

  emitKey({ name: "m" });
  emitKey({ name: "tab", sequence: "\t" });
  emitKey({ name: "tab", sequence: "\t" });

  const mergeBodyScrollbox = tree.root.findAll((node) => String(node.type) === "scrollbox")[2]!;

  expect(mergeBodyScrollbox.props.height).toBe(8);
  expect(mergeBodyScrollbox.props.focused).toBe(true);
  expect(scrollboxes[2]?.scrollTo).toHaveBeenCalledWith({ x: 0, y: Number.MAX_SAFE_INTEGER });
});

test("opens cleanup automatically after merge and removes the selected refs", async () => {
  const mergePullRequestSpy = vi.fn();
  const mergePullRequest: NonNullable<DiffdiffAppProps["mergePullRequest"]> = async (
    reviewSession,
    input,
  ) => {
    mergePullRequestSpy(reviewSession, input);
    return {
      cleanupCandidates: [
        { branchName: "feature/tui", kind: "local-branch", ref: "feature/tui" },
        { branchName: "feature/tui", kind: "remote-tracking", ref: "origin/feature/tui" },
      ],
      deletedRemoteRefs: ["origin/feature/tui"],
      message: "Pull Request successfully merged",
      sha: "mergedsha",
    };
  };
  const removeCleanupRefsSpy = vi.fn();
  const removeCleanupRefs: NonNullable<DiffdiffAppProps["removeCleanupRefs"]> = async (
    repositoryRootPath,
    refs,
  ) => {
    removeCleanupRefsSpy(repositoryRootPath, refs);
  };
  const loadSession = vi.fn(async () =>
    createPreparedSession({
      github: createGitHubReviewSession({
        pullRequest: {
          ...createGitHubReviewSession()!.pullRequest,
          isMerged: true,
          merge: {
            ...createGitHubReviewSession()!.pullRequest.merge,
            canMerge: false,
            isMerged: true,
            mergedAt: "2026-04-01T13:00:00Z",
          },
        },
      }),
    }),
  );
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        initialGitHubPreferences: createGitHubPreferences({
          cleanup: {
            removeLocal: true,
            removeRemote: false,
          },
          defaultMergeMethod: "merge",
        }),
        loadSession,
        mergePullRequest,
        removeCleanupRefs,
      })}
    />,
  );

  emitKey({ name: "m" });
  await emitAsyncKey({ name: "return" });

  expect(getAppText(tree)).toContain("Post-Merge Cleanup");
  expect(getAppText(tree)).toContain("Local branch feature/tui");
  expect(getAppText(tree)).toContain("Remote-tracking ref origin/feature/tui");

  emitKey({ name: "j" });
  emitKey({ name: "space" });
  await emitAsyncKey({ name: "return" });

  expect(removeCleanupRefsSpy).toHaveBeenCalledWith("/tmp/diffdiff", [
    { branchName: "feature/tui", kind: "local-branch", ref: "feature/tui" },
    { branchName: "feature/tui", kind: "remote-tracking", ref: "origin/feature/tui" },
  ]);
});

type DiffdiffAppProps = ComponentProps<typeof DiffdiffApp>;

function createAppProps(overrides: Partial<DiffdiffAppProps> = {}): DiffdiffAppProps {
  return {
    ...createAppPropsBase(),
    ...overrides,
  };
}

function createAppPropsBase(): DiffdiffAppProps {
  const initialOptions = {
    base: "origin/main",
    head: "feature/tui",
  } satisfies StartupOptions;

  const initialSession = createPreparedSession();

  return {
    addReviewThread: vi.fn(async () => undefined),
    initialGitHubPreferences: createGitHubPreferences(),
    initialOptions,
    initialSession,
    loadSession: vi.fn(async () => initialSession),
    logFilePath: "/Users/test/.diffdiff/logs/log-test.jsonl",
    mergePullRequest: async () => ({
      cleanupCandidates: [],
      deletedRemoteRefs: [],
      message: "Pull Request successfully merged",
      sha: "mergedsha",
    }),
    onExit: vi.fn(),
    removeCleanupRefs: async () => undefined,
    submitPendingReview: vi.fn(async () => undefined),
    syntaxStyle,
    theme,
  };
}

function createGitHubPreferences(
  overrides: Partial<GitHubUserPreferences> = {},
): GitHubUserPreferences {
  return {
    cleanup: {
      removeLocal: true,
      removeRemote: false,
      ...overrides.cleanup,
    },
    defaultMergeMethod: overrides.defaultMergeMethod,
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

function createGitHubReviewSession(
  overrides: Partial<NonNullable<PreparedReviewSession["github"]>> = {},
): PreparedReviewSession["github"] {
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
    repositoryRootPath: "/tmp/diffdiff",
    ...overrides,
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

function render(node: ReactNode, options: Partial<TestRendererOptions> = {}): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  const rendererOptions: TestRendererOptions | undefined =
    options.createNodeMock == null ? undefined : { createNodeMock: options.createNodeMock };

  act(() => {
    tree = create(node as never, rendererOptions);
  });

  return tree!;
}

function createMockScrollbox(visible: boolean) {
  return {
    content: { y: 0 },
    scrollTo: vi.fn(),
    verticalScrollBar: {
      visible,
      on: vi.fn(),
      off: vi.fn(),
    },
  };
}

function collectInstanceText(node: ReactTestInstance): string {
  return normalizeWhitespace(
    node.children
      .map((child) => (typeof child === "string" ? child : collectInstanceText(child)))
      .join(" "),
  );
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
    return normalizeWhitespace(children?.map((child) => collectText(child)).join(" ") ?? "");
  }

  return "";
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}
