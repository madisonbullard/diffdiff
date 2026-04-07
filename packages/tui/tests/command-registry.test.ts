import type { GitHubReviewSession } from "@madisonbullard/diffdiff-core";
import { describe, expect, test, vi } from "vite-plus/test";
import {
  formatCommandBindings,
  buildReverseKeymaps,
  getDefaultKeymaps,
} from "../src/app/keymap/index.ts";
import {
  buildAppCommands,
  findAppCommandByValue,
  getPaletteCommands,
} from "../src/app/commands/registry.ts";

const reverseKeymaps = buildReverseKeymaps(getDefaultKeymaps());

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
    copyCurrentSessionReopenCommand: vi.fn(async () => undefined),
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
  });

  test("derives command labels from the resolved keymaps", () => {
    const commands = buildAppCommands(createRegistryOptions());

    expect(
      formatCommandBindings(
        reverseKeymaps,
        findAppCommandByValue(commands, "view.copy-reopen-command")!,
      ),
    ).toBe("shift+y / ctrl+x shift+y / space shift+y");
    expect(
      formatCommandBindings(
        reverseKeymaps,
        findAppCommandByValue(commands, "view.open-file-in-editor")!,
      ),
    ).toBe("e / ctrl+x e");
    expect(
      formatCommandBindings(reverseKeymaps, findAppCommandByValue(commands, "comparison.list")!),
    ).toBe("l / ctrl+x l / space l");
    expect(
      formatCommandBindings(
        reverseKeymaps,
        findAppCommandByValue(commands, "github.pull-request-list")!,
      ),
    ).toBe("p / ctrl+x p / space p");
    expect(
      formatCommandBindings(reverseKeymaps, findAppCommandByValue(commands, "view.pane-toggle")!),
    ).toBe("tab");
  });

  test("models next-unreviewed and view-open commands without duplicated keybind metadata", () => {
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
    });
    expect(findAppCommandByValue(commands, "view.open-file-in-editor")).toMatchObject({
      disabledReason: "Select a file in the tree first.",
      enabled: false,
    });
    expect(findAppCommandByValue(commands, "view.open-selected-file")).toMatchObject({
      disabledReason: "Select a file in the tree first.",
      enabled: false,
    });
    expect(
      formatCommandBindings(
        reverseKeymaps,
        findAppCommandByValue(commands, "review.next-unreviewed")!,
      ),
    ).toBe("u / ctrl+x u");
    expect(
      formatCommandBindings(
        reverseKeymaps,
        findAppCommandByValue(commands, "view.open-file-in-editor")!,
      ),
    ).toBe("e / ctrl+x e");
  });

  test("moves refresh to shift+r and leaves mark-all-reviewed palette-only", () => {
    const commands = buildAppCommands(createRegistryOptions());

    expect(
      formatCommandBindings(reverseKeymaps, findAppCommandByValue(commands, "comparison.refresh")!),
    ).toBe("shift+r / ctrl+x shift+r");
    expect(
      formatCommandBindings(
        reverseKeymaps,
        findAppCommandByValue(commands, "review.mark-all-reviewed")!,
      ),
    ).toBeUndefined();
  });

  test("does not register the removed key legend toggle command", () => {
    const commands = buildAppCommands(createRegistryOptions());

    expect(findAppCommandByValue(commands, "system.key-legend")).toBeUndefined();
  });
});
