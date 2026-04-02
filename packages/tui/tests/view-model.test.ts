import type { BranchInfo } from "@diffdiff/core";
import { expect, test } from "vite-plus/test";
import {
  buildFileTreeNodes,
  buildBranchListItems,
  buildCommitListItems,
  DEFAULT_BRANCH_LIST_FILTERS,
  FILE_TREE_SIDEBAR_MAX_WIDTH,
  FILE_TREE_SIDEBAR_MIN_WIDTH,
  clampIndex,
  filterCommitListItems,
  formatCommitListEntry,
  formatAuthorList,
  formatChangeSummary,
  formatCommitDelta,
  getDiffPaneWidth,
  getDiffViewLabel,
  getFileTreeSidebarWidth,
  getTopIntersectingFileIndex,
  getVisibleFileTreeNodes,
  getVisibleRemoteBranches,
  MIN_SIDE_BY_SIDE_DIFF_WIDTH,
  resolveDiffView,
  sortFilesInTreeOrder,
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

test("buildBranchListItems groups working tree, locals, PRs, and remotes in order", () => {
  const items = buildBranchListItems({
    filters: {
      ...DEFAULT_BRANCH_LIST_FILTERS,
      remoteBranch: true,
    },
    localBranches: [
      {
        kind: "local",
        name: "feature/ui",
        ref: "refs/heads/feature/ui",
        sha: "abc",
        isCurrent: true,
        isDefault: false,
      },
    ],
    remoteBranches: [
      {
        kind: "remote",
        name: "origin/feature/ui",
        ref: "refs/remotes/origin/feature/ui",
        sha: "def",
        remoteName: "origin",
        isCurrent: false,
        isDefault: false,
        pullRequest: {
          number: 42,
          title: "UI polish",
          url: "https://github.com/diffdiff/diffdiff/pull/42",
          headRefName: "feature/ui",
          baseRefName: "main",
        },
      },
      {
        kind: "remote",
        name: "origin/main",
        ref: "refs/remotes/origin/main",
        sha: "ghi",
        remoteName: "origin",
        isCurrent: false,
        isDefault: true,
      },
    ],
    workingTreeSummary: {
      filesChanged: 3,
      additions: 12,
      deletions: 4,
    },
  });

  expect(items.map((item) => item.kind)).toEqual([
    "working-tree",
    "local-branch",
    "open-pr",
    "remote-branch",
  ]);
});

test("clampIndex stays inside range", () => {
  expect(clampIndex(-1, 3)).toBe(0);
  expect(clampIndex(9, 3)).toBe(2);
});

test("buildFileTreeNodes groups nested directories before files", () => {
  const nodes = buildFileTreeNodes([
    {
      path: "src/app.ts",
      status: "modified",
      additions: 4,
      deletions: 1,
      isBinary: false,
      patch: "",
    },
    {
      path: "src/lib/math.ts",
      status: "added",
      additions: 10,
      deletions: 0,
      isBinary: false,
      patch: "",
    },
    {
      path: "README.md",
      status: "modified",
      additions: 1,
      deletions: 1,
      isBinary: false,
      patch: "",
    },
  ]);

  expect(nodes.map((node) => `${node.kind}:${node.path}:${node.depth}`)).toEqual([
    "directory:src:0",
    "directory:src/lib:1",
    "file:src/lib/math.ts:2",
    "file:src/app.ts:1",
    "file:README.md:0",
  ]);
  expect(nodes[0]).toMatchObject({ kind: "directory", path: "src", fileCount: 2 });
  expect(nodes[2]).toMatchObject({ kind: "file", path: "src/lib/math.ts", fileIndex: 1 });
});

test("getVisibleFileTreeNodes hides descendants of collapsed directories", () => {
  const nodes = buildFileTreeNodes([
    {
      path: "src/app.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      isBinary: false,
      patch: "",
    },
    {
      path: "src/lib/math.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      isBinary: false,
      patch: "",
    },
  ]);

  expect(getVisibleFileTreeNodes(nodes, new Set(["src"])).map((node) => node.path)).toEqual([
    "src",
  ]);
  expect(getVisibleFileTreeNodes(nodes, new Set(["src/lib"])).map((node) => node.path)).toEqual([
    "src",
    "src/lib",
    "src/app.ts",
  ]);
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
  expect(getFileTreeSidebarWidth(80)).toBe(FILE_TREE_SIDEBAR_MIN_WIDTH);
  expect(getFileTreeSidebarWidth(120)).toBe(36);
  expect(getFileTreeSidebarWidth(300)).toBe(FILE_TREE_SIDEBAR_MAX_WIDTH);
  expect(getDiffPaneWidth(160, 32)).toBe(124);
});

test("format helpers keep list metadata concise", () => {
  expect(formatAuthorList(["Madison Bullard", "Pierre Bot", "Review Dog"])).toBe(
    "Madison Bullard, Pierre Bot +1",
  );
  expect(formatCommitDelta(3, "origin/main")).toBe("3 commits vs origin/main");
  expect(
    formatCommitListEntry({
      author: "Madison Bullard",
      decoration: "HEAD -> feature/tui, origin/feature/tui",
      sha: "1234567890abcdef",
      shortSha: "1234567",
      subject: "Revamp the list modal",
    }),
  ).toBe("1234567 (HEAD -> feature/tui, origin/feature/tui) Revamp the list modal");
  expect(formatChangeSummary({ filesChanged: 2, additions: 11, deletions: 5 })).toBe(
    "2 files  \u2502  +11/-5",
  );
});

test("top intersecting file stays pinned until the next file reaches the viewport top", () => {
  expect(getTopIntersectingFileIndex([1, 12, 20], 0)).toBe(0);
  expect(getTopIntersectingFileIndex([1, 12, 20], 11)).toBe(0);
  expect(getTopIntersectingFileIndex([1, 12, 20], 12)).toBe(1);
  expect(getTopIntersectingFileIndex([1, 12, 20], 19)).toBe(1);
  expect(getTopIntersectingFileIndex([1, 12, 20], 999)).toBe(2);
});

test("filterCommitListItems returns all items for an empty query", () => {
  const items = buildCommitListItems([
    { sha: "aaa", shortSha: "aaa", subject: "Add feature", author: "a" },
    { sha: "bbb", shortSha: "bbb", subject: "Fix bug", author: "b" },
  ]);

  expect(filterCommitListItems(items, "")).toHaveLength(2);
});

test("filterCommitListItems fuzzy matches commit subjects", () => {
  const items = buildCommitListItems([
    { sha: "aaa", shortSha: "aaa", subject: "Add feature flag", author: "a" },
    { sha: "bbb", shortSha: "bbb", subject: "Fix critical bug", author: "b" },
    { sha: "ccc", shortSha: "ccc", subject: "Refactor auth module", author: "c" },
  ]);

  const result = filterCommitListItems(items, "feat");
  expect(result.map((r) => r.commit.shortSha)).toEqual(["aaa"]);
});

test("filterCommitListItems is case-insensitive", () => {
  const items = buildCommitListItems([
    { sha: "aaa", shortSha: "aaa", subject: "Add Feature Flag", author: "a" },
  ]);

  expect(filterCommitListItems(items, "FEAT")).toHaveLength(1);
  expect(filterCommitListItems(items, "feat")).toHaveLength(1);
});

test("filterCommitListItems supports non-contiguous fuzzy matching", () => {
  const items = buildCommitListItems([
    { sha: "aaa", shortSha: "aaa", subject: "Add dark mode toggle", author: "a" },
    { sha: "bbb", shortSha: "bbb", subject: "Fix button style", author: "b" },
  ]);

  // "dmt" matches "d-ark m-ode t-oggle"
  const result = filterCommitListItems(items, "dmt");
  expect(result.map((r) => r.commit.shortSha)).toEqual(["aaa"]);
});

test("sortFilesInTreeOrder sorts files to match tree sidebar order", () => {
  const files = [
    { path: "README.md" },
    { path: "src/app.ts" },
    { path: "docs/guide.md" },
    { path: "src/lib/math.ts" },
    { path: "package.json" },
    { path: "docs/api.md" },
    { path: "src/index.ts" },
  ];

  const sorted = sortFilesInTreeOrder(files);

  // Directories first (alphabetical), then files (alphabetical) at each level.
  // docs/ comes before src/ alphabetically. Root files come after all directories.
  expect(sorted.map((f) => f.path)).toEqual([
    "docs/api.md",
    "docs/guide.md",
    "src/lib/math.ts",
    "src/app.ts",
    "src/index.ts",
    "package.json",
    "README.md",
  ]);
});

test("sortFilesInTreeOrder matches the order produced by buildFileTreeNodes", () => {
  const files = [
    {
      path: "src/app.ts",
      status: "modified" as const,
      additions: 4,
      deletions: 1,
      isBinary: false,
      patch: "",
    },
    {
      path: "src/lib/math.ts",
      status: "added" as const,
      additions: 10,
      deletions: 0,
      isBinary: false,
      patch: "",
    },
    {
      path: "README.md",
      status: "modified" as const,
      additions: 1,
      deletions: 1,
      isBinary: false,
      patch: "",
    },
  ];

  const sorted = sortFilesInTreeOrder(files);
  const treeNodes = buildFileTreeNodes(sorted);
  const treeFilePaths = treeNodes.filter((n) => n.kind === "file").map((n) => n.path);

  expect(sorted.map((f) => f.path)).toEqual(treeFilePaths);
});
