import { describe, expect, test } from "vite-plus/test";
import {
  getPrefixModeBadge,
  getKeymapModeBadge,
  resolveActiveKeymapMode,
} from "../src/app/shell/keymap-mode.ts";
import { DARK_THEME } from "../src/theme.ts";

describe("keymap mode", () => {
  test("returns thread mode when an inline review thread is focused", () => {
    const mode = resolveActiveKeymapMode({
      activeDialog: null,
      activeListView: "branch",
      activePane: "diff",
      commitSearchActive: false,
      hasSelectedReviewThread: true,
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
        mergeConfirmOpen: true,
        mergeModalField: "title",
        pullRequestSearchActive: false,
      }),
    ).toBe("confirm-merge");
  });

  test("renders prefix badges from the prefix menu registry", () => {
    expect(
      getPrefixModeBadge(
        {
          badgeLabel: "LEADER",
          cancelStatus: "Canceled leader key.",
          getActivateStatus: () => "Leader key active.",
          getUnboundStatus: (keyName) => `No command is bound to leader ${keyName}.`,
          preserveFocusByDefault: false,
          prefix: "leader",
          statusLabel: "leader",
          triggerKeybind: "ctrl+x",
        },
        DARK_THEME,
      ),
    ).toMatchObject({
      label: "LEADER",
    });

    expect(
      getPrefixModeBadge(
        {
          badgeLabel: "SPACE",
          cancelStatus: "Canceled modal picker.",
          getActivateStatus: () => "modal picker active. Awaiting a space command.",
          getUnboundStatus: (keyName) => `No modal is bound to space ${keyName}.`,
          preserveFocusByDefault: true,
          prefix: "space",
          statusLabel: "space",
          triggerKeybind: "space",
        },
        DARK_THEME,
      ),
    ).toMatchObject({
      label: "SPACE",
    });
  });
});
