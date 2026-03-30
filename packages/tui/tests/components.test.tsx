import type { BranchInfo } from "@diffdiff/core";
import type { ReactNode } from "react";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { BranchModal, FileCard, HelpModal } from "../src/components.tsx";
import { getUiTheme } from "../src/theme.ts";
import type { PreparedReviewFile } from "../src/types.ts";

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
      isCollapsed={false}
      isReviewed={false}
      isSelected={true}
      syntaxStyle={syntaxStyle}
      theme={theme}
    />,
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

test("renders a branch modal snapshot", () => {
  const tree = render(
    <BranchModal
      activeColumn="remote"
      base="origin/main"
      head="feature/tui"
      localBranches={createLocalBranches()}
      localIndex={0}
      remoteBranches={createRemoteBranches()}
      remoteIndex={0}
      remoteTotalCount={4}
      showAllRemoteBranches={false}
      theme={theme}
    />,
  );

  expect(tree.toJSON()).toMatchSnapshot();
  expect(collectText(tree.toJSON())).toContain("OPEN PR #42");
});

test("shows binary, reviewed, and collapsed states clearly", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile({
        isBinary: true,
        patch: "diff --git a/logo.png b/logo.png\nBinary files a/logo.png and b/logo.png differ",
        unifiedLines: [],
      })}
      isCollapsed={false}
      isReviewed={true}
      isSelected={false}
      syntaxStyle={syntaxStyle}
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
          isCollapsed={true}
          isReviewed={true}
          isSelected={false}
          syntaxStyle={syntaxStyle}
          theme={theme}
        />
      ) as never,
    );
  });

  expect(collectText(tree.toJSON())).toContain("COLLAPSED");
});

test("renders empty branch columns and help copy", () => {
  const branchModal = render(
    <BranchModal
      activeColumn="local"
      base="(empty tree)"
      head="working tree"
      localBranches={[]}
      localIndex={0}
      remoteBranches={[]}
      remoteIndex={0}
      remoteTotalCount={0}
      showAllRemoteBranches={true}
      theme={theme}
    />,
  );
  const helpModal = render(<HelpModal theme={theme} />);

  expect(collectText(branchModal.toJSON())).toContain("Nothing to show.");
  expect(collectText(helpModal.toJSON())).toContain("branch list");
});

test("passes opencode-style diff syntax settings through to the diff renderer", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile({ path: "src/app.tsx" })}
      isCollapsed={false}
      isReviewed={false}
      isSelected={false}
      syntaxStyle={syntaxStyle}
      theme={theme}
    />,
  );

  const diff = tree.root.find((node) => String(node.type) === "diff");

  expect(diff.props.filetype).toBe("typescriptreact");
  expect(diff.props.syntaxStyle).toBe(syntaxStyle);
});

test("falls back to pre-highlighted Pierre segments for unsupported filetypes", () => {
  const tree = render(
    <FileCard
      file={createPreparedFile({ path: "package.json" })}
      isCollapsed={false}
      isReviewed={false}
      isSelected={false}
      syntaxStyle={syntaxStyle}
      theme={theme}
    />,
  );

  expect(tree.root.findAll((node) => String(node.type) === "diff")).toHaveLength(0);
  expect(collectText(tree.toJSON())).toContain("const count = 1");
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
      sha: "1234567",
    },
    {
      isCurrent: false,
      isDefault: false,
      kind: "local",
      name: "main",
      ref: "refs/heads/main",
      sha: "7654321",
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
      sha: "abcdef0",
    },
    {
      isCurrent: false,
      isDefault: true,
      kind: "remote",
      name: "origin/main",
      ref: "refs/remotes/origin/main",
      remoteName: "origin",
      sha: "fedcba0",
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
