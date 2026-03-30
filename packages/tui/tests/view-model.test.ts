import type { BranchInfo } from "@diffdiff/core";
import { expect, test } from "vite-plus/test";
import {
  clampIndex,
  getDiffViewLabel,
  getTopIntersectingFileIndex,
  getVisibleRemoteBranches,
  MIN_SIDE_BY_SIDE_DIFF_WIDTH,
  resolveDiffView,
  truncateSegments,
} from "../src/view-model.ts";

test("getVisibleRemoteBranches keeps open PRs and active refs when collapsed", () => {
  const branches: BranchInfo[] = [
    {
      kind: "remote",
      name: "origin/main",
      ref: "refs/remotes/origin/main",
      sha: "abc",
      remoteName: "origin",
      isCurrent: false,
      isDefault: true,
    },
    {
      kind: "remote",
      name: "origin/feature",
      ref: "refs/remotes/origin/feature",
      sha: "def",
      remoteName: "origin",
      isCurrent: false,
      isDefault: false,
      pullRequest: {
        number: 42,
        title: "Feature",
        url: "https://github.com/diffdiff/diffdiff/pull/42",
        headRefName: "feature",
        baseRefName: "main",
      },
    },
  ];

  const visibleBranches = getVisibleRemoteBranches(
    branches,
    {
      base: "origin/main",
      head: "feature",
      mergeBase: undefined,
      mode: "range",
      range: "origin/main...feature",
      usesMergeBase: true,
    },
    false,
  );

  expect(visibleBranches).toHaveLength(2);
});

test("clampIndex stays inside range", () => {
  expect(clampIndex(-1, 3)).toBe(0);
  expect(clampIndex(9, 3)).toBe(2);
});

test("truncateSegments preserves order while trimming", () => {
  const result = truncateSegments(
    [
      { text: "hello", fg: "#fff" },
      { text: " world", fg: "#000" },
    ],
    7,
  );

  expect(result).toEqual([
    { text: "hello", fg: "#fff" },
    { text: " w", fg: "#000" },
  ]);
});

test("resolveDiffView matches the split threshold used by side-by-side mode", () => {
  expect(resolveDiffView("unified", 200)).toBe("unified");
  expect(resolveDiffView("side-by-side", MIN_SIDE_BY_SIDE_DIFF_WIDTH - 1)).toBe("unified");
  expect(resolveDiffView("side-by-side", MIN_SIDE_BY_SIDE_DIFF_WIDTH)).toBe("split");
  expect(getDiffViewLabel("unified")).toBe("unified");
  expect(getDiffViewLabel("split")).toBe("side-by-side");
});

test("top intersecting file stays pinned until the next file reaches the viewport top", () => {
  expect(getTopIntersectingFileIndex([1, 12, 20], 0)).toBe(0);
  expect(getTopIntersectingFileIndex([1, 12, 20], 11)).toBe(0);
  expect(getTopIntersectingFileIndex([1, 12, 20], 12)).toBe(1);
  expect(getTopIntersectingFileIndex([1, 12, 20], 19)).toBe(1);
  expect(getTopIntersectingFileIndex([1, 12, 20], 999)).toBe(2);
});
