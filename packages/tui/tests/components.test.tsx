import type { BranchInfo } from "@diffdiff/core";
import type { ReactNode } from "react";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { BranchModal } from "../src/components/branch-modal.tsx";
import { CommandPaletteModal } from "../src/components/command-palette-modal.tsx";
import { FileCard, StickyFileHeader } from "../src/components/file-card.tsx";
import { FileTreeSidebar } from "../src/components/file-tree-sidebar.tsx";
import { HelpModal } from "../src/components/help-modal.tsx";
import { ListFilterModal } from "../src/components/list-filter-modal.tsx";
import { PullRequestListModal } from "../src/components/pull-request-list-modal.tsx";
import { getUiTheme } from "../src/theme.ts";
import type { CommandDefinition } from "../src/commands.ts";
import type { BranchListFilters, PreparedReviewFile } from "../src/types.ts";
import {
  buildBranchListItems,
  buildCommitListItems,
  buildFileTreeNodes,
} from "../src/view-model.ts";

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

test("renders a compact sticky file card header snapshot", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile()}
      diffView="unified"
      headerVariant="sticky-compact"
      isCollapsed={false}
      isReviewed={true}
      isSelected={false}
      syntaxStyle={syntaxStyle}
      terminalWidth={160}
      theme={theme}
    />,
  );

  expect(tree.toJSON()).toMatchSnapshot();
  expect(collectText(tree.toJSON())).toContain("CHANGED");
  expect(collectText(tree.toJSON())).toContain("REVIEWED");
  expect(collectText(tree.toJSON())).not.toContain("src/app.ts");
});

test("removes top padding for the first compact file card", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile()}
      diffView="unified"
      headerVariant="sticky-compact"
      isCollapsed={false}
      removeTopPadding={true}
      isReviewed={false}
      isSelected={true}
      syntaxStyle={syntaxStyle}
      terminalWidth={160}
      theme={theme}
    />,
  );

  expect(tree.toJSON()).toMatchObject({ props: { paddingTop: 0 } });
  expect(collectText(tree.toJSON())).toContain("CHANGED");
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
      commitSearchQuery=""
      commitSearchActive={false}
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

test("shows the review PR action when a PR entry is selected", () => {
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
      branchIndex={3}
      commitItems={buildCommitListItems(createComparisonCommits())}
      commitIndex={0}
      commitSearchQuery=""
      commitSearchActive={false}
      comparisonMode="range"
      filters={filters}
      head="feature/tui"
      localBranchCount={2}
      openPrCount={1}
      remoteBranchCount={1}
      theme={theme}
    />,
  );

  expect(collectText(tree.toJSON())).toContain("review PR");
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
      commitSearchQuery=""
      commitSearchActive={false}
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
  expect(collectText(tree.toJSON())).toContain("2 commits in the current comparison");
  expect(collectText(tree.toJSON())).toContain("abcdef0 (origin/main) Polish branch categories");
  expect(collectText(tree.toJSON())).toContain("enter / h");
});

test("shows commit history in working tree commit view", () => {
  const filters: BranchListFilters = {
    workingTree: true,
    localBranch: true,
    openPr: true,
    remoteBranch: false,
  };
  const tree = render(
    <BranchModal
      activeView="commit"
      base="HEAD"
      branchItems={buildBranchListItems({
        filters,
        localBranches: createLocalBranches(),
        remoteBranches: createRemoteBranches(),
        workingTreeSummary: { filesChanged: 4, additions: 18, deletions: 6 },
      })}
      branchIndex={0}
      commitItems={buildCommitListItems(createComparisonCommits())}
      commitIndex={0}
      commitSearchQuery=""
      commitSearchActive={false}
      comparisonMode="working-tree"
      filters={filters}
      head="working tree"
      localBranchCount={2}
      openPrCount={1}
      remoteBranchCount={1}
      theme={theme}
    />,
  );

  expect(collectText(tree.toJSON())).toContain("2 commits in the current comparison");
  expect(collectText(tree.toJSON())).toContain(
    "1234567 (HEAD -> feature/tui, origin/feature/tui) Revamp the list modal",
  );
  expect(collectText(tree.toJSON())).not.toContain("Working tree changes are not committed yet.");
});

test("renders a pull request list modal with truncated titles", () => {
  const tree = render(
    <PullRequestListModal
      isLoading={false}
      pullRequests={[
        {
          author: { login: "madison" },
          isAuthor: true,
          isDraft: false,
          isReviewRequested: false,
          number: 42,
          repository: {
            forge: "github",
            host: "github.com",
            owner: "diffdiff",
            repo: "diffdiff",
          },
          title:
            "Add a pull request dashboard modal with fuzzy search, cross-repo selection, and keyboard navigation",
          updatedAt: "2026-04-03T14:00:00Z",
          url: "https://github.com/diffdiff/diffdiff/pull/42",
        },
      ]}
      reviewRequestedCount={0}
      searchActive={false}
      searchQuery=""
      selectedIndex={0}
      theme={theme}
    />,
  );

  expect(collectText(tree.toJSON())).toContain("GitHub PRs");
  expect(collectText(tree.toJSON())).toContain("diffdiff/diffdiff");
  expect(collectText(tree.toJSON())).toContain("madison");
  expect(collectText(tree.toJSON())).toContain("...");
});

test("shows more pull requests at once in the pull request list modal", () => {
  const tree = render(
    <PullRequestListModal
      isLoading={false}
      pullRequests={Array.from({ length: 12 }, (_, index) => ({
        author: { login: "madison" },
        isAuthor: true,
        isDraft: false,
        isReviewRequested: false,
        number: index + 1,
        repository: {
          forge: "github",
          host: "github.com",
          owner: "diffdiff",
          repo: "diffdiff",
        },
        title: `Visible PR ${index + 1}`,
        updatedAt: `2026-04-03T${String(index).padStart(2, "0")}:00:00Z`,
        url: `https://github.com/diffdiff/diffdiff/pull/${index + 1}`,
      }))}
      reviewRequestedCount={0}
      searchActive={false}
      searchQuery=""
      selectedIndex={0}
      theme={theme}
    />,
  );

  const text = collectText(tree.toJSON());
  expect(text).toContain("Visible PR 10");
  expect(text).not.toContain("Visible PR 11");
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
  expect(collectText(tree.toJSON())).toContain("\u25BC");

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

  expect(collectText(tree.toJSON())).toContain("\u25B6");
  expect(collectText(tree.toJSON())).not.toContain("COLLAPSED");
});

test("renders a sticky file header for the active viewport file", () => {
  const tree = render(
    <StickyFileHeader
      file={createPreparedFile()}
      isCollapsed={false}
      isReviewed={true}
      isSelected={false}
      theme={theme}
    />,
  );

  expect(tree.toJSON()).toMatchSnapshot();
  expect(collectText(tree.toJSON())).toContain("src/app.ts");
  expect(collectText(tree.toJSON())).toContain("+3");
  expect(collectText(tree.toJSON())).toContain("-1");
});

test("renders a clickable file tree sidebar", () => {
  const nodes = buildFileTreeNodes([
    createPreparedFile({ path: "src/app.ts" }),
    createPreparedFile({ path: "src/lib/math.ts", status: "added" }),
  ]);
  const onNodeMouseUp = vi.fn();
  const tree = render(
    <FileTreeSidebar
      activePane="tree"
      collapsedDirectories={new Set(["src/lib"])}
      collapsedPaths={new Set(["src/app.ts"])}
      nodes={nodes.filter((node) => node.path !== "src/lib/math.ts")}
      onNodeMouseUp={onNodeMouseUp}
      reviewedPaths={new Set(["src/app.ts"])}
      selectedFilePath="src/app.ts"
      selectedPath="src/app.ts"
      theme={theme}
    />,
  );

  expect(collectText(tree.toJSON())).toContain("src");
  expect(collectText(tree.toJSON())).toContain("app.ts");
  expect(collectText(tree.toJSON())).toContain("+3");
  expect(collectText(tree.toJSON())).toContain("-1");

  const clickableRows = tree.root.findAll(
    (node) => String(node.type) === "box" && typeof node.props.onMouseUp === "function",
  );
  act(() => {
    clickableRows[0]?.props.onMouseUp?.();
  });

  expect(onNodeMouseUp).toHaveBeenCalledWith(expect.objectContaining({ path: "src" }));
});

test("uses only the checkmark to mark reviewed tree files", () => {
  const nodes = buildFileTreeNodes([createPreparedFile({ path: "src/app.ts" })]);
  const tree = render(
    <FileTreeSidebar
      activePane="diff"
      collapsedDirectories={new Set()}
      collapsedPaths={new Set()}
      nodes={nodes}
      onNodeMouseUp={vi.fn()}
      reviewedPaths={new Set(["src/app.ts"])}
      theme={theme}
    />,
  );
  const clickableRows = tree.root.findAll(
    (node) => String(node.type) === "box" && typeof node.props.onMouseUp === "function",
  );
  const reviewedFileRow = clickableRows[1];

  expect(reviewedFileRow?.props.backgroundColor).toBe(theme.surface);
  expect(reviewedFileRow?.props.borderColor).toBe(theme.border);
  expect(collectText(tree.toJSON())).toContain("\u2713");
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
      commitSearchQuery=""
      commitSearchActive={false}
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
  const helpCommands: CommandDefinition[] = [
    {
      category: "System",
      keybind: "ctrl+p",
      title: "Open command palette",
      value: "system.command-palette",
    },
    {
      category: "Comparison",
      keybind: "<leader>l,l",
      title: "Open comparison list",
      value: "comparison.list",
    },
    {
      category: "GitHub",
      keybind: "<leader>y,y",
      title: "Copy PR URL",
      value: "github.copy-url",
    },
  ];
  const helpModal = render(
    <HelpModal commands={helpCommands} leaderKeybind="ctrl+x" theme={theme} />,
  );

  expect(collectText(branchModal.toJSON())).toContain("Working tree");
  expect(collectText(branchModal.toJSON())).toContain("ACTIVE");
  expect(collectText(filterModal.toJSON())).toContain("Remote branches");
  expect(collectText(helpModal.toJSON())).toContain("ctrl+p");
  expect(collectText(helpModal.toJSON())).toContain("ctrl+x");
  expect(collectText(helpModal.toJSON())).toContain("open comparison list");
  expect(collectText(helpModal.toJSON())).toContain("switch between the tree and diff panes");
  expect(collectText(helpModal.toJSON())).toContain("copy PR URL");
});

test("groups suggested commands under a dedicated heading in the palette", () => {
  const commands: CommandDefinition[] = [
    {
      category: "System",
      keybind: "ctrl+p",
      suggested: true,
      title: "Open command palette",
      value: "system.command-palette",
    },
    {
      category: "Review",
      keybind: "u",
      suggested: true,
      title: "Jump to next unreviewed file",
      value: "review.next-unreviewed",
    },
    {
      category: "Comparison",
      keybind: "<leader>l,l",
      title: "Open comparison list",
      value: "comparison.list",
    },
  ];

  const palette = render(
    <CommandPaletteModal
      commands={commands}
      leaderKeybind="ctrl+x"
      query=""
      selectedIndex={0}
      theme={theme}
    />,
  );

  const text = collectText(palette.toJSON());
  expect(text).toContain("Suggested");
  expect(text).toContain("Comparison");
  expect(text.indexOf("Suggested")).toBeLessThan(text.indexOf("Comparison"));
});

test("renders palette command descriptions on an indented second line", () => {
  const description =
    "Browse the working tree, branches, pull requests, and commits from one list.";
  const palette = render(
    <CommandPaletteModal
      commands={[
        {
          category: "Suggested",
          description,
          keybind: "ctrl+p",
          suggested: true,
          title: "Open comparison list",
          value: "comparison.list",
        },
      ]}
      leaderKeybind="ctrl+x"
      query=""
      selectedIndex={0}
      theme={theme}
    />,
  );

  const descriptionNode = palette.root.find(
    (node) =>
      String(node.type) === "text" && collectText(node.props.children).trim() === description,
  );

  expect(descriptionNode.props.wrapMode).toBe("word");
  expect(descriptionNode.parent?.props.paddingLeft).toBe(2);
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
});

test("renders inline GitHub review threads under matching diff lines", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile()}
      diffView="unified"
      isCollapsed={false}
      isReviewed={false}
      isSelected={false}
      reviewThreads={[
        {
          comments: [
            {
              author: { login: "octocat", url: "https://github.com/octocat" },
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
      ]}
      syntaxStyle={syntaxStyle}
      terminalWidth={160}
      theme={theme}
    />,
  );

  const text = collectText(tree.toJSON());

  expect(text).toContain("Please rename this variable.");
  expect(text).toContain("src/app.ts:1");
  expect(text.match(/octocat/g)).toHaveLength(1);
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
      decoration: "HEAD -> feature/tui, origin/feature/tui",
      sha: "1234567890abcdef",
      shortSha: "1234567",
      subject: "Revamp the list modal",
    },
    {
      author: "Pierre Bot",
      decoration: "origin/main",
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
