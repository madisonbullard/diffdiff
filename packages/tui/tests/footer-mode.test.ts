import { describe, expect, test } from "vite-plus/test";
import { DARK_THEME } from "../src/theme.ts";
import { resolveFooterModeBadge } from "../src/app/footer-mode.ts";

describe("resolveFooterModeBadge", () => {
  test("prioritizes leader mode over every other keymap", () => {
    expect(
      resolveFooterModeBadge({
        activeDialog: "merge",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: true,
        leaderActive: true,
        mergeConfirmOpen: true,
        mergeModalField: "body",
        pullRequestSearchActive: false,
        theme: DARK_THEME,
      }),
    ).toMatchObject({
      label: "LEADER",
    });
  });

  test("returns thread mode when an inline review thread is focused", () => {
    expect(
      resolveFooterModeBadge({
        activeDialog: null,
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: true,
        leaderActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
        theme: DARK_THEME,
      }),
    ).toMatchObject({
      bg: DARK_THEME.commentBg,
      fg: DARK_THEME.commentAnnotation,
      label: "THREAD",
    });
  });

  test("distinguishes browse and search states in modal lists", () => {
    expect(
      resolveFooterModeBadge({
        activeDialog: "pull-request-list",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
        theme: DARK_THEME,
      }).label,
    ).toBe("PR LIST");

    expect(
      resolveFooterModeBadge({
        activeDialog: "pull-request-list",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: true,
        theme: DARK_THEME,
      }).label,
    ).toBe("PR SEARCH");
  });

  test("distinguishes comparison branches, commits, and commit search", () => {
    expect(
      resolveFooterModeBadge({
        activeDialog: "branch",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
        theme: DARK_THEME,
      }).label,
    ).toBe("BRANCHES");

    expect(
      resolveFooterModeBadge({
        activeDialog: "branch",
        activeListView: "commit",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
        theme: DARK_THEME,
      }).label,
    ).toBe("COMMITS");

    expect(
      resolveFooterModeBadge({
        activeDialog: "branch",
        activeListView: "commit",
        activePane: "diff",
        commitSearchActive: true,
        hasSelectedReviewThread: false,
        leaderActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "method",
        pullRequestSearchActive: false,
        theme: DARK_THEME,
      }).label,
    ).toBe("COMMIT SEARCH");
  });

  test("distinguishes merge editing states from confirmation", () => {
    expect(
      resolveFooterModeBadge({
        activeDialog: "merge",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        mergeConfirmOpen: false,
        mergeModalField: "title",
        pullRequestSearchActive: false,
        theme: DARK_THEME,
      }).label,
    ).toBe("MERGE TITLE");

    expect(
      resolveFooterModeBadge({
        activeDialog: "merge",
        activeListView: "branch",
        activePane: "diff",
        commitSearchActive: false,
        hasSelectedReviewThread: false,
        leaderActive: false,
        mergeConfirmOpen: true,
        mergeModalField: "title",
        pullRequestSearchActive: false,
        theme: DARK_THEME,
      }).label,
    ).toBe("CONFIRM");
  });
});
