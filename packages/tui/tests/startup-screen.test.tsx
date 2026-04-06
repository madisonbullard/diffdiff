import type { ReactElement, ReactNode } from "react";
import type { ReactTestInstance, ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { StartupScreen } from "../src/startup-screen.tsx";

const STARTUP_FRAME_MS = 33;
const STARTUP_INITIAL_FRAME_COUNT = 1;
const STARTUP_WIPE_FRAME_COUNT = 15;
const STARTUP_FINAL_FRAME = STARTUP_INITIAL_FRAME_COUNT + STARTUP_WIPE_FRAME_COUNT;
const mountedTrees = new Set<ReactTestRenderer>();

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => {
    for (const tree of mountedTrees) {
      tree.unmount();
    }
  });
  mountedTrees.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("keeps the corrected leading padding on the top row", () => {
  const tree = render(
    <StartupScreen
      chromeBackground="#07131b"
      path="/tmp/diffdiff"
      text="#e6edf3"
      textMuted="#8ea4b5"
    />,
  );

  expect(getArtLineTexts(tree)[0]).toBe("   ███╗                ███╗");
});

test("centers the startup artwork in the viewport", () => {
  const tree = render(
    <StartupScreen
      chromeBackground="#07131b"
      path="/tmp/diffdiff"
      text="#e6edf3"
      textMuted="#8ea4b5"
    />,
  );
  const artLineTexts = getArtLineTexts(tree);
  const artWidth = Math.max(...artLineTexts.map((line) => Array.from(line).length));

  const rootBox = tree.root.findByProps({
    alignItems: "center",
    backgroundColor: "#07131b",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  });
  const artBox = tree.root.findByProps({
    flexDirection: "column",
    gap: 0,
    width: artWidth,
  });

  expect(rootBox.props.paddingX).toBe(1);
  expect(artBox.children).toHaveLength(artLineTexts.length);
});

test("animates a single gradient band across white text and returns to white", () => {
  vi.useFakeTimers();

  const tree = render(
    <StartupScreen
      chromeBackground="#07131b"
      path="/tmp/diffdiff"
      text="#e6edf3"
      textMuted="#8ea4b5"
    />,
  );

  expect(getFirstVisibleGlyphColor(tree)).toBe("#ffffff");

  act(() => {
    vi.advanceTimersByTime(STARTUP_FRAME_MS * STARTUP_INITIAL_FRAME_COUNT);
  });

  expect(getLastGlyphColor(tree, 0)).toBe("#ffffff");

  const midpointDuration =
    STARTUP_FRAME_MS * (STARTUP_INITIAL_FRAME_COUNT + Math.floor(STARTUP_WIPE_FRAME_COUNT / 2));

  act(() => {
    vi.advanceTimersByTime(midpointDuration - STARTUP_FRAME_MS * STARTUP_INITIAL_FRAME_COUNT);
  });

  expect(getVisibleGlyphColors(tree, 0).some((color) => color !== "#ffffff")).toBe(true);

  act(() => {
    vi.advanceTimersByTime(
      STARTUP_FRAME_MS * (STARTUP_FINAL_FRAME - Math.floor(STARTUP_WIPE_FRAME_COUNT / 2)),
    );
  });

  expect(getFirstVisibleGlyphColor(tree)).toBe("#ffffff");
});

test("band introduces non-white colors while passing through the art", () => {
  vi.useFakeTimers();

  const tree = render(
    <StartupScreen
      chromeBackground="#07131b"
      path="/tmp/diffdiff"
      text="#e6edf3"
      textMuted="#8ea4b5"
    />,
  );

  act(() => {
    vi.advanceTimersByTime(
      STARTUP_FRAME_MS * (STARTUP_INITIAL_FRAME_COUNT + Math.floor(STARTUP_WIPE_FRAME_COUNT / 2)),
    );
  });

  const colors = getVisibleGlyphColors(tree, 0);

  const nonWhiteColors = colors.filter((c) => c !== "#ffffff");
  expect(nonWhiteColors.length).toBeGreaterThan(0);
});

test("slants the band so upper rows are ahead of lower rows", () => {
  vi.useFakeTimers();

  const tree = render(
    <StartupScreen
      chromeBackground="#07131b"
      path="/tmp/diffdiff"
      text="#e6edf3"
      textMuted="#8ea4b5"
    />,
  );

  act(() => {
    vi.advanceTimersByTime(
      STARTUP_FRAME_MS * (STARTUP_INITIAL_FRAME_COUNT + Math.floor(STARTUP_WIPE_FRAME_COUNT / 2)),
    );
  });

  const artLineLengths = getArtGlyphSpans(tree).map((line) => line.length);
  const testCol = Math.floor(Math.max(...artLineLengths) / 2);
  const topColor = getGlyphColor(tree, 0, testCol);
  const bottomColor = getGlyphColor(tree, getArtGlyphSpans(tree).length - 1, testCol);

  expect(topColor).not.toBe(bottomColor);
});

function getArtLineTexts(tree: ReactTestRenderer): string[] {
  return getArtGlyphSpans(tree).map((line) => line.map(getSpanText).join(""));
}

function getArtGlyphSpans(tree: ReactTestRenderer) {
  return tree.root
    .findAll(
      (node) =>
        String(node.type) === "text" &&
        node.findAll((child) => String(child.type) === "span").length > 0,
    )
    .map((line) => line.findAll((node) => String(node.type) === "span"));
}

function getVisibleGlyphColors(tree: ReactTestRenderer, row: number): string[] {
  return (
    getArtGlyphSpans(tree)
      [row]?.filter((span) => getSpanText(span) !== " ")
      .map((span) => span.props.fg as string) ?? []
  );
}

function getGlyphColor(tree: ReactTestRenderer, row: number, column: number): string | undefined {
  return getArtGlyphSpans(tree)[row]?.[column]?.props.fg;
}

function getFirstVisibleGlyphColor(tree: ReactTestRenderer): string | undefined {
  return getVisibleGlyphColors(tree, 0)[0];
}

function getLastGlyphColor(tree: ReactTestRenderer, row: number): string | undefined {
  const colors = getVisibleGlyphColors(tree, row);
  return colors.at(-1);
}

function getSpanText(span: ReactTestInstance): string {
  return span.children.filter((child): child is string => typeof child === "string").join("");
}

function render(element: ReactNode): ReactTestRenderer {
  let tree!: ReactTestRenderer;

  act(() => {
    tree = create(element as ReactElement);
  });

  mountedTrees.add(tree);

  return tree;
}
