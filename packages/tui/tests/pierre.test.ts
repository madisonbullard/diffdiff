import { buildReviewSessionFingerprint, type ReviewSession } from "@diffdiff/core";
import type { TerminalColors } from "@opentui/core";
import type { PierreDiffsModule } from "../src/diff/pierre-internals.ts";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { createPierreSegmentColorResolver } from "../src/pierre-colors.ts";
import {
  hydratePreparedReviewFiles,
  prepareReviewSession,
} from "../src/diff/prepare-review-session.ts";
import { createTerminalSyntaxPalette, getSyntaxPalette } from "../src/syntax-palette.ts";
import { loadStartupPreparedReviewSession } from "../src/startup-session.ts";
import { createTerminalUiTheme, getUiTheme } from "../src/theme.ts";

const pierreInternalsState = vi.hoisted(() => ({
  loadPierreDiffsOverride: undefined as undefined | (() => Promise<PierreDiffsModule>),
}));

vi.mock("../src/diff/pierre-internals.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/diff/pierre-internals.ts")>();

  return {
    ...actual,
    loadPierreDiffs: () => {
      const override = pierreInternalsState.loadPierreDiffsOverride;
      return override == null ? actual.loadPierreDiffs() : override();
    },
  };
});

afterEach(() => {
  pierreInternalsState.loadPierreDiffsOverride = undefined;
});

test("remaps Pierre dark syntax colors to the terminal palette", async () => {
  const colors = createDarkPalette();
  const theme = createTerminalUiTheme(colors, "dark");
  const syntaxPalette = createTerminalSyntaxPalette(theme, colors);
  const resolveColor = createPierreSegmentColorResolver("pierre-dark", theme, syntaxPalette);

  expect(["#D568EA", "#FF678D", "#FFCA00", "#08C0EF", "#68CDF2"].map(resolveColor)).toEqual([
    "#48bcca",
    "#ca6ae7",
    "#e6edf3",
    "#48bcca",
    "#edc272",
  ]);
});

test("remaps Pierre light syntax colors to the terminal palette", async () => {
  const colors = createLightPalette();
  const theme = createTerminalUiTheme(colors, "light");
  const syntaxPalette = createTerminalSyntaxPalette(theme, colors);
  const resolveColor = createPierreSegmentColorResolver("pierre-light", theme, syntaxPalette);

  expect(["#C635E4", "#FC2B73", "#D5A910", "#08C0EF", "#1CA1C7"].map(resolveColor)).toEqual([
    "#24838d",
    "#925592",
    "#2f2a24",
    "#24838d",
    "#b17d13",
  ]);
});

test("can defer eager syntax rendering during startup", async () => {
  const prepared = await prepareReviewSession(
    createReviewSession(),
    "pierre-dark",
    undefined,
    undefined,
    {
      deferSyntaxRendering: true,
    },
  );

  expect(prepared.files).toHaveLength(1);
  expect(prepared.files[0]).toMatchObject({
    diff: expect.any(Object),
    path: "src/app.ts",
    lineNumberWidth: 3,
    renderError: undefined,
  });
  expect(prepared.files[0].unifiedLines).toEqual([]);
  expect(prepared.files[0].sideBySideRows).toEqual([]);
});

test("deferred rendering keeps blank-line diffs parsed without pre-rendering previews", async () => {
  const prepared = await prepareReviewSession(
    createReviewSession({
      files: [
        {
          path: "src/app.ts",
          status: "modified",
          additions: 3,
          deletions: 2,
          isBinary: false,
          patch: [
            "diff --git a/src/app.ts b/src/app.ts",
            "index 1111111..2222222 100644",
            "--- a/src/app.ts",
            "+++ b/src/app.ts",
            "@@ -1,4 +1,5 @@",
            " export function run() {",
            "-  return oldValue();",
            "+  const value = nextValue();",
            "+",
            "+  return value;",
            " }",
          ].join("\n"),
        },
      ],
    }),
    "pierre-dark",
    undefined,
    undefined,
    {
      deferSyntaxRendering: true,
    },
  );

  expect(prepared.files[0]?.renderError).toBeUndefined();
  expect(prepared.files[0]?.diff).toBeDefined();
  expect(prepared.files[0]?.unifiedLines).toEqual([]);
  expect(prepared.files[0]?.sideBySideRows).toEqual([]);
});

test("deferred rendering preserves blank-context diffs for on-demand rendering", async () => {
  const prepared = await prepareReviewSession(
    createReviewSession({
      files: [
        {
          path: "src/app.ts",
          status: "modified",
          additions: 1,
          deletions: 1,
          isBinary: false,
          patch: [
            "diff --git a/src/app.ts b/src/app.ts",
            "index 1111111..2222222 100644",
            "--- a/src/app.ts",
            "+++ b/src/app.ts",
            "@@ -1,4 +1,4 @@",
            " export function run() {",
            " ",
            "-  const count = oldValue();",
            "+  const count = 1;",
            " }",
          ].join("\n"),
        },
      ],
    }),
    "pierre-dark",
    undefined,
    undefined,
    {
      deferSyntaxRendering: true,
    },
  );

  expect(prepared.files[0]?.renderError).toBeUndefined();
  expect(prepared.files[0]?.diff).toBeDefined();
  expect(prepared.files[0]?.unifiedLines).toEqual([]);
});

test("deferred startup rendering skips eager highlighting work", async () => {
  const actualPierreInternals = await vi.importActual<
    typeof import("../src/diff/pierre-internals.ts")
  >("../src/diff/pierre-internals.ts");
  const actualPierreDiffs = await actualPierreInternals.loadPierreDiffs();
  const getSharedHighlighter = vi.fn(async () => ({ mocked: true }));
  const renderDiffWithHighlighter = vi.fn(
    (diff: Parameters<PierreDiffsModule["renderDiffWithHighlighter"]>[0]) => ({
      themeStyles: "--mock-token: #48bcca;",
      code: {
        deletionLines: diff.deletionLines.map((line) => ({ type: "text", value: line })),
        additionLines: diff.additionLines.map((line) => ({ type: "text", value: line })),
      },
    }),
  );

  pierreInternalsState.loadPierreDiffsOverride = async () => ({
    ...actualPierreDiffs,
    getSharedHighlighter,
    renderDiffWithHighlighter,
  });

  const prepared = await prepareReviewSession(
    createReviewSession({
      files: [
        {
          path: "src/app.ts",
          status: "modified",
          additions: 1,
          deletions: 1,
          isBinary: false,
          patch: [
            "diff --git a/src/app.ts b/src/app.ts",
            "index 1111111..2222222 100644",
            "--- a/src/app.ts",
            "+++ b/src/app.ts",
            "@@ -1,4 +1,4 @@",
            " export function run() {",
            " ",
            "-  const count = oldValue();",
            "+  const count = 1;",
            " }",
          ].join("\n"),
        },
      ],
    }),
    "pierre-dark",
    undefined,
    undefined,
    {
      deferSyntaxRendering: true,
      initialDiffView: "unified",
    },
  );

  expect(prepared.files[0]?.renderError).toBeUndefined();
  expect(getSharedHighlighter).not.toHaveBeenCalled();
  expect(renderDiffWithHighlighter).not.toHaveBeenCalled();
});

test("hydrates deferred files into syntax-highlighted previews", async () => {
  const actualPierreInternals = await vi.importActual<
    typeof import("../src/diff/pierre-internals.ts")
  >("../src/diff/pierre-internals.ts");
  const actualPierreDiffs = await actualPierreInternals.loadPierreDiffs();
  const getSharedHighlighter = vi.fn(async () => ({ mocked: true }));
  const renderDiffWithHighlighter = vi.fn(() => ({
    themeStyles: "--keyword: #c678dd; --number: #e5c07b;",
    code: {
      deletionLines: [
        {
          type: "element",
          tagName: "span",
          children: [
            {
              type: "element",
              tagName: "span",
              properties: { style: "color: var(--keyword)" },
              children: [{ type: "text", value: "export" }],
            },
            { type: "text", value: " const app = " },
            {
              type: "element",
              tagName: "span",
              properties: { style: "color: var(--number)" },
              children: [{ type: "text", value: "true" }],
            },
            { type: "text", value: ";" },
          ],
        },
      ],
      additionLines: [
        {
          type: "element",
          tagName: "span",
          children: [
            {
              type: "element",
              tagName: "span",
              properties: { style: "color: var(--keyword)" },
              children: [{ type: "text", value: "export" }],
            },
            { type: "text", value: " const app = " },
            {
              type: "element",
              tagName: "span",
              properties: { style: "color: var(--number)" },
              children: [{ type: "text", value: "false" }],
            },
            { type: "text", value: ";" },
          ],
        },
      ],
    },
  }));

  pierreInternalsState.loadPierreDiffsOverride = async () => ({
    ...actualPierreDiffs,
    getSharedHighlighter,
    renderDiffWithHighlighter,
  });

  const deferredPrepared = await prepareReviewSession(
    createReviewSession(),
    "pierre-dark",
    undefined,
    undefined,
    {
      deferSyntaxRendering: true,
      initialDiffView: "unified",
    },
  );

  const hydratedFiles = await hydratePreparedReviewFiles(
    deferredPrepared.files,
    "pierre-dark",
    getUiTheme("pierre-dark"),
    getSyntaxPalette("pierre-dark"),
    {
      initialDiffView: "both",
    },
  );

  expect(getSharedHighlighter).toHaveBeenCalledTimes(1);
  expect(renderDiffWithHighlighter).toHaveBeenCalledTimes(1);
  expect(hydratedFiles[0]?.unifiedLines).toEqual([
    {
      kind: "hunk",
      segments: [{ text: "@@ -1 +1 @@\n" }],
    },
    {
      kind: "deletion",
      oldLineNumber: 1,
      segments: [
        { text: "export", fg: "#c678dd" },
        { text: " const app = " },
        { text: "true", fg: "#e5c07b" },
        { text: ";" },
      ],
    },
    {
      kind: "addition",
      newLineNumber: 1,
      segments: [
        { text: "export", fg: "#c678dd" },
        { text: " const app = " },
        { text: "false", fg: "#e5c07b" },
        { text: ";" },
      ],
    },
  ]);
  expect(hydratedFiles[0]?.sideBySideRows).not.toEqual([]);
});

test("startup session loading defers syntax rendering until viewport hydration", async () => {
  const expectedSession = { marker: "prepared-session" } as unknown as Awaited<
    ReturnType<typeof loadStartupPreparedReviewSession>
  >;
  const loadPreparedReviewSession = vi.fn(async () => expectedSession);

  const prepared = await loadStartupPreparedReviewSession(
    loadPreparedReviewSession,
    {
      base: "HEAD",
      head: "working tree",
    },
    "pierre-dark",
    getUiTheme("pierre-dark"),
    getSyntaxPalette("pierre-dark"),
  );

  expect(prepared).toBe(expectedSession);
  expect(loadPreparedReviewSession).toHaveBeenCalledWith(
    {
      base: "HEAD",
      head: "working tree",
    },
    "pierre-dark",
    getUiTheme("pierre-dark"),
    getSyntaxPalette("pierre-dark"),
    {
      deferSyntaxRendering: true,
      initialDiffView: "unified",
    },
  );
});

function createDarkPalette(): TerminalColors {
  return {
    cursorColor: null,
    defaultBackground: "#101214",
    defaultForeground: "#e6edf3",
    highlightBackground: null,
    highlightForeground: null,
    mouseBackground: null,
    mouseForeground: null,
    palette: [
      "#101214",
      "#e06c75",
      "#98c379",
      "#e5c07b",
      "#61afef",
      "#c678dd",
      "#56b6c2",
      "#e6edf3",
      "#6b7280",
      "#ff7b72",
      "#b4e88d",
      "#f0d48a",
      "#79c0ff",
      "#d2a8ff",
      "#76e3ea",
      "#ffffff",
    ],
    tekBackground: null,
    tekForeground: null,
  };
}

function createLightPalette(): TerminalColors {
  return {
    cursorColor: null,
    defaultBackground: "#f7f4eb",
    defaultForeground: "#2f2a24",
    highlightBackground: null,
    highlightForeground: null,
    mouseBackground: null,
    mouseForeground: null,
    palette: [
      "#f7f4eb",
      "#b14d3d",
      "#5f7d48",
      "#a97b1d",
      "#4b78a6",
      "#8f5c8f",
      "#2d7f88",
      "#2f2a24",
      "#a8a196",
      "#d25e4b",
      "#709356",
      "#c29124",
      "#5e8fbe",
      "#a06aa0",
      "#3394a0",
      "#1f1a15",
    ],
    tekBackground: null,
    tekForeground: null,
  };
}

function createReviewSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  const session: ReviewSession = {
    repository: {
      kind: "git",
      rootPath: "/tmp/diffdiff",
      name: "diffdiff",
      remotes: [],
      currentBranch: "main",
      defaultBranch: "main",
    },
    comparison: {
      base: "HEAD",
      head: "working tree",
      range: "HEAD...working tree",
      mode: "working-tree",
      usesMergeBase: false,
    },
    files: [
      {
        path: "src/app.ts",
        status: "modified",
        additions: 1,
        deletions: 1,
        isBinary: false,
        patch: [
          "diff --git a/src/app.ts b/src/app.ts",
          "index 1111111..2222222 100644",
          "--- a/src/app.ts",
          "+++ b/src/app.ts",
          "@@ -1 +1 @@",
          "-export const app = true;",
          "+export const app = false;",
        ].join("\n"),
      },
    ],
    commits: [],
    branches: {
      local: [],
      remote: [],
    },
    workingTreeSummary: {
      filesChanged: 1,
      additions: 1,
      deletions: 1,
    },
    renderFingerprint: {
      baseRef: "HEAD",
      headRef: "working tree",
      comparisonMode: "working-tree",
      baseSha: "1111111",
      headSha: "1111111",
      fileCount: 1,
      patchDigest: "placeholder",
    },
    warnings: [],
    ...overrides,
  };

  return {
    ...session,
    renderFingerprint: overrides.renderFingerprint ?? buildReviewSessionFingerprint(session),
  };
}
