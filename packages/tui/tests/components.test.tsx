import type { BranchInfo } from "@diffdiff/core";
import type { ReactNode } from "react";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import {
  BranchModal,
  FileCard,
  HelpModal,
  ListFilterModal,
  StickyFileHeader,
} from "../src/components.tsx";
import { getUiTheme } from "../src/theme.ts";
import type { BranchListFilters, PreparedReviewFile } from "../src/types.ts";
import { buildBranchListItems, buildCommitListItems } from "../src/view-model.ts";

const theme = getUiTheme("pierre-dark");
const syntaxStyle = { kind: "syntax-style" } as unknown as import("@opentui/core").SyntaxStyle;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders an expanded file card snapshot", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile()}
      diffView="unified"
      isCollapsed={false}
      isReviewed={false}
      isSelected={true}
      syntaxStyle={syntaxStyle}
      terminalWidth={160}
      theme={theme}
    />,
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

test("renders a branch modal snapshot", () => {
  const filters: BranchListFilters = {
    workingTree: true,
    localBranch: true,
    openPr: true,
    remoteBranch: false,
  };
  const tree = render(
    <BranchModal
      activeView="branch"
      base="origin/main"
      branchItems={buildBranchListItems({
        filters,
        localBranches: createLocalBranches(),
        remoteBranches: createRemoteBranches(),
        workingTreeSummary: { filesChanged: 4, additions: 18, deletions: 6 },
      })}
      branchIndex={1}
      commitItems={buildCommitListItems(createComparisonCommits())}
      commitIndex={0}
      comparisonMode="range"
      filters={filters}
      head="feature/tui"
      localBranchCount={2}
      openPrCount={1}
      remoteBranchCount={1}
      theme={theme}
    />,
  );

  expect(tree.toJSON()).toMatchSnapshot();
  expect(collectText(tree.toJSON())).toContain("Build TUI reviewer");
  expect(collectText(tree.toJSON())).toContain("(#42)");
  expect(collectText(tree.toJSON())).toContain("Working tree");
  expect(collectText(tree.toJSON())).toContain("feature/tui");
});

test("renders a commit view snapshot", () => {
  const filters: BranchListFilters = {
    workingTree: true,
    localBranch: true,
    openPr: true,
    remoteBranch: false,
  };
  const tree = render(
    <BranchModal
      activeView="commit"
      base="origin/main"
      branchItems={buildBranchListItems({
        filters,
        localBranches: createLocalBranches(),
        remoteBranches: createRemoteBranches(),
        workingTreeSummary: { filesChanged: 4, additions: 18, deletions: 6 },
      })}
      branchIndex={1}
      commitItems={buildCommitListItems(createComparisonCommits())}
      commitIndex={1}
      comparisonMode="range"
      filters={filters}
      head="feature/tui"
      localBranchCount={2}
      openPrCount={1}
      remoteBranchCount={1}
      theme={theme}
    />,
  );

  expect(collectText(tree.toJSON())).toContain("2 commits in the current comparison");
  expect(collectText(tree.toJSON())).toContain("Polish branch categories");
  expect(collectText(tree.toJSON())).toContain("enter / h");
});

test("shows binary, reviewed, and collapsed states clearly", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile({
        isBinary: true,
        patch: "diff --git a/logo.png b/logo.png\nBinary files a/logo.png and b/logo.png differ",
        unifiedLines: [],
      })}
      diffView="unified"
      isCollapsed={false}
      isReviewed={true}
      isSelected={false}
      syntaxStyle={syntaxStyle}
      terminalWidth={160}
      theme={theme}
    />,
  );

  expect(collectText(tree.toJSON())).toContain(
    "Binary file changed. Content preview is not available yet.",
  );
  expect(collectText(tree.toJSON())).toContain("REVIEWED");

  act(() => {
    tree.update(
      (
        <FileCard
          file={createPreparedFile({ isBinary: true, unifiedLines: [] })}
          diffView="unified"
          isCollapsed={true}
          isReviewed={true}
          isSelected={false}
          syntaxStyle={syntaxStyle}
          terminalWidth={160}
          theme={theme}
        />
      ) as never,
    );
  });

  expect(collectText(tree.toJSON())).toContain("COLLAPSED");
});

test("renders a sticky file header for the active viewport file", () => {
  const tree = render(
    <StickyFileHeader
      file={createPreparedFile()}
      isReviewed={true}
      isSelected={false}
      theme={theme}
    />,
  );

  expect(collectText(tree.toJSON())).toContain("src/app.ts");
  expect(collectText(tree.toJSON())).toContain("+3");
  expect(collectText(tree.toJSON())).toContain("-1");
});

test("renders empty branch columns and help copy", () => {
  const filters: BranchListFilters = {
    workingTree: true,
    localBranch: false,
    openPr: false,
    remoteBranch: false,
  };
  const branchModal = render(
    <BranchModal
      activeView="branch"
      base="(empty tree)"
      branchItems={buildBranchListItems({
        filters,
        localBranches: [],
        remoteBranches: [],
        workingTreeSummary: { filesChanged: 0, additions: 0, deletions: 0 },
      })}
      branchIndex={0}
      commitItems={[]}
      commitIndex={0}
      comparisonMode="working-tree"
      filters={filters}
      head="working tree"
      localBranchCount={0}
      openPrCount={0}
      remoteBranchCount={0}
      theme={theme}
    />,
  );
  const filterModal = render(<ListFilterModal filters={filters} selectedIndex={0} theme={theme} />);
  const helpModal = render(<HelpModal theme={theme} />);

  expect(collectText(branchModal.toJSON())).toContain("Working tree");
  expect(collectText(branchModal.toJSON())).toContain("ACTIVE");
  expect(collectText(filterModal.toJSON())).toContain("Remote branches");
  expect(collectText(helpModal.toJSON())).toContain("list modal");
  expect(collectText(helpModal.toJSON())).toContain("working tree");
});

test("uses the native diff renderer when Pierre segments are unavailable", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile({ path: "src/app.tsx", unifiedLines: [] })}
      diffView="unified"
      isCollapsed={false}
      isReviewed={false}
      isSelected={false}
      syntaxStyle={syntaxStyle}
      terminalWidth={160}
      theme={theme}
    />,
  );

  const diff = tree.root.find((node) => String(node.type) === "diff");

  expect(diff.props.filetype).toBe("typescriptreact");
  expect(diff.props.syntaxStyle).toBe(syntaxStyle);
});

test("renders Pierre-highlighted segments when they are available", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile({ path: "package.json" })}
      diffView="unified"
      isCollapsed={false}
      isReviewed={false}
      isSelected={false}
      syntaxStyle={syntaxStyle}
      terminalWidth={160}
      theme={theme}
    />,
  );

  expect(tree.root.findAll((node) => String(node.type) === "diff")).toHaveLength(0);
  expect(collectText(tree.toJSON())).toContain("const count = 1");
  expect(tree.root.findAll((node) => node.props?.fg === "#3fb950")).not.toHaveLength(0);
});

test("renders syntax-highlighted side-by-side rows", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile({ path: "src/app.tsx" })}
      diffView="split"
      isCollapsed={false}
      isReviewed={false}
      isSelected={false}
      syntaxStyle={syntaxStyle}
      terminalWidth={160}
      theme={theme}
    />,
  );

  expect(tree.root.findAll((node) => String(node.type) === "diff")).toHaveLength(0);
  expect(tree.root.findAll((node) => node.props?.fg === "#3fb950")).not.toHaveLength(0);
  expect(collectText(tree.toJSON())).toContain("side-by-side diff");
});

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
      {
        kind: "line",
        left: {
          kind: "context",
          lineNumber: 2,
          segments: [{ text: "console.log(count)" }],
        },
        right: {
          kind: "context",
          lineNumber: 2,
          segments: [{ text: "console.log(count)" }],
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
      {
        kind: "context",
        oldLineNumber: 2,
        newLineNumber: 2,
        segments: [{ text: "console.log(count)" }],
      },
    ],
    ...overrides,
  };
}

function createLocalBranches(): BranchInfo[] {
  return [
    {
      isCurrent: true,
      isDefault: false,
      kind: "local",
      name: "feature/tui",
      ref: "refs/heads/feature/tui",
      summary: {
        additions: 18,
        authors: ["Madison Bullard", "Pierre Bot"],
        commitCount: 3,
        comparedTo: "origin/main",
        deletions: 6,
        filesChanged: 4,
      },
      sha: "1234567",
      tipAuthor: "Madison Bullard",
    },
    {
      isCurrent: false,
      isDefault: true,
      kind: "local",
      name: "main",
      ref: "refs/heads/main",
      summary: {
        additions: 0,
        authors: ["Madison Bullard"],
        commitCount: 0,
        comparedTo: "origin/main",
        deletions: 0,
        filesChanged: 0,
      },
      sha: "7654321",
      tipAuthor: "Madison Bullard",
    },
  ];
}

function createRemoteBranches(): BranchInfo[] {
  return [
    {
      isCurrent: false,
      isDefault: false,
      kind: "remote",
      name: "origin/feature/tui",
      pullRequest: {
        baseRefName: "main",
        headRefName: "feature/tui",
        number: 42,
        title: "Build TUI reviewer",
        url: "https://github.com/diffdiff/diffdiff/pull/42",
      },
      ref: "refs/remotes/origin/feature/tui",
      remoteName: "origin",
      summary: {
        additions: 18,
        authors: ["Madison Bullard", "Pierre Bot"],
        commitCount: 3,
        comparedTo: "origin/main",
        deletions: 6,
        filesChanged: 4,
      },
      sha: "abcdef0",
      tipAuthor: "Madison Bullard",
    },
    {
      isCurrent: false,
      isDefault: true,
      kind: "remote",
      name: "origin/main",
      ref: "refs/remotes/origin/main",
      remoteName: "origin",
      summary: {
        additions: 0,
        authors: ["Madison Bullard"],
        commitCount: 0,
        comparedTo: "origin/main",
        deletions: 0,
        filesChanged: 0,
      },
      sha: "fedcba0",
      tipAuthor: "Madison Bullard",
    },
  ];
}

function createComparisonCommits() {
  return [
    {
      author: "Madison Bullard",
      sha: "1234567890abcdef",
      shortSha: "1234567",
      subject: "Revamp the list modal",
    },
    {
      author: "Pierre Bot",
      sha: "abcdef0123456789",
      shortSha: "abcdef0",
      subject: "Polish branch categories",
    },
  ];
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
