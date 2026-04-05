import { describe, expect, test } from "vite-plus/test";
import {
  getKeymapModeBadge,
  keymapModeSuspendsGlobalKeybinds,
  resolveActiveKeymapMode,
} from "../src/app/shell/keymap-mode.ts";
import { DARK_THEME } from "../src/theme.ts";

describe("keymap mode", () => {
  test("prioritizes leader mode over every other keymap", () => {
    expect(
      resolveActiveKeymapMode({
        activeDialog: "merge",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: true,
        leaderActive: true,
        modalPickerActive: false,
        mergeConfirmOpen: true,
        mergeModalField: "body",
        pullRequestSearchActive: false,
      }),
    ).toBe("leader");
  });

  test("returns thread mode when an inline review thread is focused", () => {
    const mode = resolveActiveKeymapMode({
      activeDialog: null,
      activeListView: "branch",
      activePane: "diff",
      commitSearchActive: false,
      hasSelectedReviewThread: true,
      leaderActive: false,
      modalPickerActive: false,
      mergeConfirmOpen: false,
      mergeModalField: "method",
      pullRequestSearchActive: false,
    });

    expect(mode).toBe("thread");
    expect(getKeymapModeBadge(mode, DARK_THEME)).toMatchObject({
      bg: DARK_THEME.commentBg,
      fg: DARK_THEME.commentAnnotation,
      label: "THREAD",
    });
  });

  test("distinguishes browse and search states in modal lists", () => {
    expect(
      resolveActiveKeymapMode({
        activeDialog: "pull-request-list",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        modalPickerActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
      }),
    ).toBe("pull-request-list");

    expect(
      resolveActiveKeymapMode({
        activeDialog: "pull-request-list",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        modalPickerActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: true,
      }),
    ).toBe("pull-request-search");
  });

  test("distinguishes comparison branches, commits, and commit search", () => {
    expect(
      resolveActiveKeymapMode({
        activeDialog: "branch",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        modalPickerActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
      }),
    ).toBe("compare-branches");

    expect(
      resolveActiveKeymapMode({
        activeDialog: "branch",
        activeListView: "commit",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        modalPickerActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
      }),
    ).toBe("compare-commits");

    expect(
      resolveActiveKeymapMode({
        activeDialog: "branch",
        activeListView: "commit",
        activePane: "diff",
        commitSearchActive: true,
        hasSelectedReviewThread: false,
        leaderActive: false,
        modalPickerActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
      }),
    ).toBe("commit-search");
  });

  test("distinguishes merge editing states from confirmation", () => {
    expect(
      resolveActiveKeymapMode({
        activeDialog: "merge",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        modalPickerActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "title",
        pullRequestSearchActive: false,
      }),
    ).toBe("merge-title");

    expect(
      resolveActiveKeymapMode({
        activeDialog: "merge",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        modalPickerActive: false,
        mergeConfirmOpen: true,
        mergeModalField: "title",
        pullRequestSearchActive: false,
      }),
    ).toBe("confirm-merge");
  });

  test("marks text-input and confirmation modes as global-keybind suspending", () => {
    expect(keymapModeSuspendsGlobalKeybinds("commands")).toBe(true);
    expect(keymapModeSuspendsGlobalKeybinds("commit-search")).toBe(true);
    expect(keymapModeSuspendsGlobalKeybinds("merge-body")).toBe(true);
    expect(keymapModeSuspendsGlobalKeybinds("confirm-merge")).toBe(true);
    expect(keymapModeSuspendsGlobalKeybinds("diff")).toBe(false);
    expect(keymapModeSuspendsGlobalKeybinds("tree")).toBe(false);
  });

  test("returns modal-picker mode when the space picker is active", () => {
    expect(
      resolveActiveKeymapMode({
        activeDialog: null,
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        modalPickerActive: true,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
      }),
    ).toBe("modal-picker");

    expect(getKeymapModeBadge("modal-picker", DARK_THEME)).toMatchObject({
      label: "SPACE",
    });
  });
});
