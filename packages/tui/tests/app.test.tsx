import type { StartupOptions } from "@diffdiff/core";
import type { ReactNode } from "react";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { DiffdiffApp } from "../src/app.tsx";
import { FileCard } from "../src/components.tsx";
import { getUiTheme } from "../src/theme.ts";
import type { PreparedReviewFile, PreparedReviewSession } from "../src/types.ts";

interface KeyboardInput {
  name: string;
  sequence?: string;
  shift?: boolean;
}

const registeredKeyboardHandlers = new Set<(key: KeyboardInput) => void>();

vi.mock("@opentui/react", () => {
  return {
    useKeyboard(handler: (key: KeyboardInput) => void) {
      registeredKeyboardHandlers.add(handler);
    },
    useTerminalDimensions() {
      return { width: 160, height: 40 };
    },
  };
});

const theme = getUiTheme("pierre-dark");
const syntaxStyle = { kind: "syntax-style" } as unknown as import("@opentui/core").SyntaxStyle;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  registeredKeyboardHandlers.clear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  registeredKeyboardHandlers.clear();
  vi.restoreAllMocks();
});

test("removes main scroll focus while a modal is open", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  expect(getScrollbox(tree).props.focused).toBe(true);

  emitKey({ name: "l" });
  expect(getScrollbox(tree).props.focused).toBe(false);

  emitKey({ name: "escape" });
  expect(getScrollbox(tree).props.focused).toBe(true);
});

test("keeps background file selection stable when modal handlers rerender", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  expect(getSelectedFileLabel(tree)).toContain("selected src/app.ts");
  expect(registeredKeyboardHandlers.size).toBe(1);

  emitKey({ name: "l" });
  expect(registeredKeyboardHandlers.size).toBe(1);

  emitKey({ name: "j" });

  expect(getSelectedFileLabel(tree)).toContain("selected src/app.ts");
});

test("starts deleted file diffs collapsed", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          files: [
            createPreparedFile({ path: "src/removed.ts", status: "deleted" }),
            createPreparedFile({ path: "src/app.ts" }),
          ],
        }),
      })}
    />,
  );

  const [deletedCard] = tree.root.findAllByType(FileCard);

  expect(deletedCard?.props.file.path).toBe("src/removed.ts");
  expect(deletedCard?.props.isCollapsed).toBe(true);
});

function createAppProps(overrides: Partial<ReturnType<typeof createAppPropsBase>> = {}) {
  return {
    ...createAppPropsBase(),
    ...overrides,
  };
}

function createAppPropsBase() {
  const initialOptions = {
    base: "origin/main",
    head: "feature/tui",
  } satisfies StartupOptions;

  const initialSession = createPreparedSession();

  return {
    initialOptions,
    initialSession,
    loadSession: vi.fn(async () => initialSession),
    onExit: vi.fn(),
    syntaxStyle,
    theme,
  };
}

function createPreparedSession(
  overrides: Partial<PreparedReviewSession> = {},
): PreparedReviewSession {
  return {
    repository: {
      kind: "git",
      rootPath: "/tmp/diffdiff",
      name: "diffdiff",
      remotes: [{ name: "origin", fetchUrl: "git@github.com:diffdiff/diffdiff.git" }],
      currentBranch: "feature/tui",
      defaultBranch: "main",
    },
    comparison: {
      base: "origin/main",
      head: "feature/tui",
      range: "origin/main...feature/tui",
      mode: "range",
      usesMergeBase: true,
    },
    files: [createPreparedFile(), createPreparedFile({ path: "src/utils.ts" })],
    branches: {
      local: [
        {
          kind: "local",
          name: "feature/tui",
          ref: "refs/heads/feature/tui",
          sha: "1234567",
          isCurrent: true,
          isDefault: false,
        },
        {
          kind: "local",
          name: "main",
          ref: "refs/heads/main",
          sha: "7654321",
          isCurrent: false,
          isDefault: true,
        },
      ],
      remote: [
        {
          kind: "remote",
          name: "origin/feature/tui",
          ref: "refs/remotes/origin/feature/tui",
          sha: "abcdef0",
          remoteName: "origin",
          isCurrent: false,
          isDefault: false,
          pullRequest: {
            number: 42,
            title: "Build TUI reviewer",
            url: "https://github.com/diffdiff/diffdiff/pull/42",
            headRefName: "feature/tui",
            baseRefName: "main",
          },
        },
        {
          kind: "remote",
          name: "origin/main",
          ref: "refs/remotes/origin/main",
          sha: "fedcba0",
          remoteName: "origin",
          isCurrent: false,
          isDefault: true,
        },
      ],
    },
    commits: [
      {
        sha: "1234567890abcdef",
        shortSha: "1234567",
        subject: "Revamp the list modal",
        author: "Madison Bullard",
      },
    ],
    workingTreeSummary: {
      filesChanged: 3,
      additions: 12,
      deletions: 4,
    },
    warnings: [],
    themeName: "pierre-dark",
    ...overrides,
  };
}

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
    ],
    ...overrides,
  };
}

function emitKey(key: KeyboardInput): void {
  act(() => {
    for (const handler of Array.from(registeredKeyboardHandlers)) {
      handler(key);
    }
  });
}

function getScrollbox(tree: ReactTestRenderer) {
  return tree.root.find((node) => String(node.type) === "scrollbox");
}

function getSelectedFileLabel(tree: ReactTestRenderer): string {
  return collectText(tree.toJSON());
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
