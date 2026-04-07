import { describe, expect, test } from "vite-plus/test";
import {
  buildReviewComposerAutocompleteState,
  insertReviewComposerAutocomplete,
} from "../src/review/composer-autocomplete.ts";
import {
  findLatestDismissedReviewComposerDraft,
  getReviewComposerHistoryEntriesForBrowsing,
} from "../src/review/composer-history.ts";
import { formatMergeMessageBuffer, parseMergeMessageBuffer } from "../src/review/merge-message.ts";

describe("composer ux helpers", () => {
  test("preserves typed line ranges when inserting file references", () => {
    const autocomplete = buildReviewComposerAutocompleteState({
      body: "Please check @app#12-18",
      dismissedTokenKey: null,
      paths: ["src/app.ts", "src/utils.ts"],
      selectedPath: "src/app.ts",
    });

    expect(autocomplete.options[0]).toEqual({
      insertText: "src/app.ts#12-18",
      path: "src/app.ts",
    });
    expect(
      insertReviewComposerAutocomplete("Please check @app#12-18", autocomplete.options[0]!),
    ).toBe("Please check `src/app.ts#12-18` ");
  });

  test("formats and parses merge message buffers like a commit message", () => {
    const buffer = formatMergeMessageBuffer("Build TUI reviewer", "Adds PR review mode.");

    expect(buffer).toBe("Build TUI reviewer\n\nAdds PR review mode.");
    expect(parseMergeMessageBuffer(buffer)).toEqual({
      body: "Adds PR review mode.",
      title: "Build TUI reviewer",
    });
  });

  test("finds the latest dismissed draft for the same composer target", () => {
    const entries = [
      {
        body: "older",
        createdAt: "2026-04-01T00:00:00.000Z",
        outcome: "dismissed" as const,
        repositoryRootPath: "/tmp/diffdiff",
        target: { key: "review-thread:src/app.ts:1-1:LEFT", kind: "review-thread" as const },
      },
      {
        body: "latest",
        createdAt: "2026-04-01T00:01:00.000Z",
        outcome: "dismissed" as const,
        repositoryRootPath: "/tmp/diffdiff",
        target: { key: "review-thread:src/app.ts:1-1:LEFT", kind: "review-thread" as const },
      },
    ];

    const scope = {
      repositoryRootPath: "/tmp/diffdiff",
      targetKey: "review-thread:src/app.ts:1-1:LEFT",
      targetKind: "review-thread" as const,
    };

    expect(findLatestDismissedReviewComposerDraft(entries, scope)?.body).toBe("latest");
  });

  test("prioritizes exact-target drafts when browsing history", () => {
    const entries = [
      {
        body: "same file",
        createdAt: "2026-04-01T00:00:00.000Z",
        outcome: "submitted" as const,
        repositoryRootPath: "/tmp/diffdiff",
        target: {
          key: "review-thread:src/app.ts:1-1:LEFT",
          kind: "review-thread" as const,
          path: "src/app.ts",
          pullRequestNumber: 42,
        },
      },
      {
        body: "exact target",
        createdAt: "2026-04-01T00:01:00.000Z",
        outcome: "dismissed" as const,
        repositoryRootPath: "/tmp/diffdiff",
        target: {
          key: "review-thread-reply:thread-1",
          kind: "review-thread-reply" as const,
          path: "src/app.ts",
          pullRequestNumber: 42,
        },
      },
      {
        body: "other repo",
        createdAt: "2026-04-01T00:02:00.000Z",
        outcome: "dismissed" as const,
        repositoryRootPath: "/tmp/other",
        target: {
          key: "review-thread-reply:thread-1",
          kind: "review-thread-reply" as const,
          path: "src/app.ts",
          pullRequestNumber: 42,
        },
      },
    ];

    const scope = {
      path: "src/app.ts",
      pullRequestNumber: 42,
      repositoryRootPath: "/tmp/diffdiff",
      targetKey: "review-thread-reply:thread-1",
      targetKind: "review-thread-reply" as const,
    };

    expect(
      getReviewComposerHistoryEntriesForBrowsing(entries, scope).map((entry) => entry.body),
    ).toEqual(["exact target", "same file"]);
  });
});
