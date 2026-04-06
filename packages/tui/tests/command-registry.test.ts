import type { GitHubReviewSession } from "@diffdiff/core";
import { describe, expect, test, vi } from "vite-plus/test";
import {
  buildAppCommands,
  findAppCommandByKey,
  findAppCommandByValue,
  getPaletteCommands,
} from "../src/app/commands/registry.ts";

function createRegistryOptions(
  overrides: Partial<Parameters<typeof buildAppCommands>[0]> = {},
): Parameters<typeof buildAppCommands>[0] {
  return {
    activePane: "diff",
    canClearReviewed: true,
    canOpenFocusedFileInEditor: true,
    canMoveToNextUnreviewed: true,
    canOpenSelectedTreeFile: true,
    clearReviewed: vi.fn(),
    copyFocusedReviewCommentUrl: vi.fn(async () => undefined),
    copyPullRequestUrl: vi.fn(async () => undefined),
    hasFiles: true,
    hasFocusedReviewComment: true,
    hasFocusedReviewThread: true,
    hasReviewThreads: true,
    hasSelectedReviewThread: true,
    isGitHubAuthenticated: true,
    markAllReviewed: vi.fn(),
    moveFocusedReviewComment: vi.fn(),
    moveFocusedReviewThread: vi.fn(),
    moveToNextUnreviewed: vi.fn(),
    onExit: vi.fn(),
    openBranchModal: vi.fn(),
    openCommandModal: vi.fn(),
    openCommentComposer: vi.fn(),
    openDiagnostics: vi.fn(),
    openFocusedReviewThreadReplyComposer: vi.fn(),
    openGitHubPullRequestList: vi.fn(),
    openHelp: vi.fn(),
    openFocusedFileInEditor: vi.fn(async () => undefined),
    openMergeModal: vi.fn(),
    openPullRequestCommentsModal: vi.fn(),
    openSelectedTreeFile: vi.fn(),
    openSubmitReviewModal: vi.fn(),
    refreshComparison: vi.fn(),
    selectedTreeNode: {
      additions: 3,
      ancestorPaths: [],
      deletions: 1,
      depth: 0,
      fileIndex: 0,
      kind: "file",
      name: "app.ts",
      path: "src/app.ts",
      status: "modified",
    },
    sessionGitHub: {
      auth: {
        isAuthenticated: true,
      },
    } as GitHubReviewSession,
    toggleActivePane: vi.fn(),
    toggleCollapsedSelectedFile: vi.fn(),
    toggleDiffView: vi.fn(),
    toggleFocusedReviewThreadCollapsed: vi.fn(),
    toggleReviewedSelectedFile: vi.fn(),
    ...overrides,
  };
}

describe("command registry", () => {
  test("keeps unavailable GitHub actions discoverable in the palette", () => {
    const commands = buildAppCommands(
      createRegistryOptions({
        hasFocusedReviewComment: false,
        hasSelectedReviewThread: false,
        isGitHubAuthenticated: false,
        sessionGitHub: undefined,
      }),
    );

    expect(findAppCommandByValue(commands, "github.reply-thread")).toMatchObject({
      disabledReason: "Open a GitHub pull request first.",
      enabled: false,
    });
    expect(findAppCommandByValue(commands, "github.pull-request-list")).toMatchObject({
      disabledReason: "GitHub auth is required. Run `diffdiff auth login --token-stdin` first.",
      enabled: false,
    });
    expect(
      getPaletteCommands(commands).some((command) => command.value === "github.reply-thread"),
    ).toBe(true);
    expect(findAppCommandByKey(commands, { name: "[" }, { activePane: "diff" })).toBeUndefined();
  });

  test("prefers focused diff actions over broader review shortcuts", () => {
    const commands = buildAppCommands(createRegistryOptions());

    expect(findAppCommandByKey(commands, { name: "r" }, { activePane: "diff" })?.value).toBe(
      "github.reply-thread",
    );
    expect(findAppCommandByKey(commands, { name: "y" }, { activePane: "diff" })?.value).toBe(
      "github.copy-comment-url",
    );
    expect(findAppCommandByKey(commands, { name: "return" }, { activePane: "tree" })?.value).toBe(
      "view.open-selected-file",
    );
    expect(findAppCommandByKey(commands, { name: "e" }, { activePane: "diff" })?.value).toBe(
      "view.open-file-in-editor",
    );
    expect(
      findAppCommandByKey(
        commands,
        { name: "l", sequence: "l" },
        { activePane: "diff", prefix: "space" },
      )?.value,
    ).toBe("comparison.list");
    expect(
      findAppCommandByKey(commands, { name: "p", sequence: "p" }, { activePane: "diff" })?.value,
    ).toBe("github.pull-request-list");
    expect(
      findAppCommandByKey(commands, { name: "tab", sequence: "\t" }, { activePane: "diff" })?.value,
    ).toBe("view.pane-toggle");
  });

  test("models next-unreviewed and view-open commands as command metadata", () => {
    const commands = buildAppCommands(
      createRegistryOptions({
        activePane: "tree",
        canOpenFocusedFileInEditor: false,
        canMoveToNextUnreviewed: false,
        canOpenSelectedTreeFile: false,
        selectedTreeNode: {
          ancestorPaths: [],
          depth: 0,
          fileCount: 2,
          kind: "directory",
          name: "src",
          path: "src",
        },
      }),
    );

    expect(findAppCommandByValue(commands, "review.next-unreviewed")).toMatchObject({
      disabledReason: "All files are already reviewed.",
      enabled: false,
      keybind: "u,<leader>u",
    });
    expect(findAppCommandByValue(commands, "view.open-file-in-editor")).toMatchObject({
      disabledReason: "Select a file in the tree first.",
      enabled: false,
      keybind: "e,<leader>e",
    });
    expect(findAppCommandByValue(commands, "view.open-selected-file")).toMatchObject({
      disabledReason: "Select a file in the tree first.",
      enabled: false,
      keybind: "return,right",
    });
    expect(findAppCommandByValue(commands, "view.pane-toggle")).toMatchObject({
      keybind: "tab",
    });
    expect(findAppCommandByValue(commands, "github.pull-request-list")).toMatchObject({
      keybind: "p,<leader>p,<space>p",
    });
  });

  test("moves refresh to shift+r and leaves mark-all-reviewed palette-only", () => {
    const commands = buildAppCommands(createRegistryOptions());

    expect(findAppCommandByValue(commands, "comparison.refresh")).toMatchObject({
      keybind: "shift+r,<leader>shift+r",
    });
    expect(
      findAppCommandByKey(
        commands,
        { name: "r", sequence: "R", shift: true },
        { activePane: "diff" },
      )?.value,
    ).toBe("comparison.refresh");
    expect(findAppCommandByValue(commands, "review.mark-all-reviewed")?.keybind).toBeUndefined();
  });

  test("does not register the removed key legend toggle command", () => {
    const commands = buildAppCommands(createRegistryOptions());

    expect(findAppCommandByValue(commands, "system.key-legend")).toBeUndefined();
    expect(findAppCommandByKey(commands, { name: "z" }, { activePane: "diff" })).toBeUndefined();
  });
});
