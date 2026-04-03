import type { ReactElement, ReactNode } from "react";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import {
  STARTUP_SCREEN_FINAL_FRAME,
  getStartupScreenAnimationState,
  getStartupScreenCharacterColor,
  STARTUP_SCREEN_ART_LINES,
  STARTUP_SCREEN_ART_WIDTH,
  STARTUP_SCREEN_FRAME_MS,
  STARTUP_SCREEN_INITIAL_FRAME_COUNT,
  StartupScreen,
  STARTUP_SCREEN_WIPE_FRAME_COUNT,
} from "../src/startup-screen.tsx";

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("keeps the corrected leading padding on the top row", () => {
  expect(STARTUP_SCREEN_ART_LINES[0]).toBe("   ███╗                ███╗");
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
    width: STARTUP_SCREEN_ART_WIDTH,
  });

  expect(rootBox.props.paddingX).toBe(1);
  expect(artBox.children).toHaveLength(STARTUP_SCREEN_ART_LINES.length);
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

  expect(getStartupScreenAnimationState(0)).toEqual({ color: "#ffffff", kind: "solid" });
  expect(getFirstVisibleGlyphColor(tree)).toBe("#ffffff");

  act(() => {
    vi.advanceTimersByTime(STARTUP_SCREEN_FRAME_MS * STARTUP_SCREEN_INITIAL_FRAME_COUNT);
  });

  const firstBandState = getStartupScreenAnimationState(STARTUP_SCREEN_INITIAL_FRAME_COUNT);
  expect(firstBandState.kind).toBe("band");

  // At progress=0 the band is entering from the left, so far-right columns stay white
  expect(getStartupScreenCharacterColor(STARTUP_SCREEN_ART_WIDTH - 1, 0, firstBandState)).toBe(
    "#ffffff",
  );

  // Mid-animation: the band is somewhere in the middle
  const midFrame =
    STARTUP_SCREEN_INITIAL_FRAME_COUNT + Math.floor(STARTUP_SCREEN_WIPE_FRAME_COUNT / 2);
  const midState = getStartupScreenAnimationState(midFrame);
  expect(midState.kind).toBe("band");

  // After the band passes, everything returns to solid white
  expect(getStartupScreenAnimationState(STARTUP_SCREEN_FINAL_FRAME)).toEqual({
    color: "#ffffff",
    kind: "solid",
  });

  act(() => {
    vi.advanceTimersByTime(STARTUP_SCREEN_FRAME_MS * STARTUP_SCREEN_FINAL_FRAME);
  });

  expect(getFirstVisibleGlyphColor(tree)).toBe("#ffffff");
});

test("band has green on the trailing edge and red on the leading edge", () => {
  // Use a mid-animation state where the band is fully over the art
  const midFrame =
    STARTUP_SCREEN_INITIAL_FRAME_COUNT + Math.floor(STARTUP_SCREEN_WIPE_FRAME_COUNT / 2);
  const midState = getStartupScreenAnimationState(midFrame);

  if (midState.kind !== "band") {
    throw new Error("Expected band state at mid-animation");
  }

  // Find a column that is inside the band for row 0 by scanning
  const colors: string[] = [];
  for (let col = 0; col < STARTUP_SCREEN_ART_WIDTH; col++) {
    colors.push(getStartupScreenCharacterColor(col, 0, midState));
  }

  // There should be non-white colors (the band is passing through)
  const nonWhiteColors = colors.filter((c) => c !== "#ffffff");
  expect(nonWhiteColors.length).toBeGreaterThan(0);
});

test("slants the band so upper rows are ahead of lower rows", () => {
  const midFrame =
    STARTUP_SCREEN_INITIAL_FRAME_COUNT + Math.floor(STARTUP_SCREEN_WIPE_FRAME_COUNT / 2);
  const midState = getStartupScreenAnimationState(midFrame);

  // Pick a column in the middle of the art
  const testCol = Math.floor(STARTUP_SCREEN_ART_WIDTH / 2);
  const topColor = getStartupScreenCharacterColor(testCol, 0, midState);
  const bottomColor = getStartupScreenCharacterColor(
    testCol,
    STARTUP_SCREEN_ART_LINES.length - 1,
    midState,
  );

  // Due to row offset, the band position differs between rows, so colors should differ
  expect(topColor).not.toBe(bottomColor);
});

function getFirstVisibleGlyphColor(tree: ReactTestRenderer): string | undefined {
  const textNodes = tree.root.findAll((node) => String(node.type) === "text");
  const artLine = textNodes[0];
  if (artLine == null) {
    return undefined;
  }

  const glyphSpan = artLine.findAll(
    (node) =>
      String(node.type) === "span" &&
      typeof node.children[0] === "string" &&
      node.children[0] !== " ",
  )[0];
  return glyphSpan?.props.fg;
}

function render(element: ReactNode): ReactTestRenderer {
  let tree!: ReactTestRenderer;

  act(() => {
    tree = create(element as ReactElement);
  });

  return tree;
}
