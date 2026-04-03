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

test("animates once through white, red, green, and back to white", () => {
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

  const firstWipeState = getStartupScreenAnimationState(STARTUP_SCREEN_INITIAL_FRAME_COUNT);
  expect(firstWipeState.kind).toBe("wipe");
  expect(getStartupScreenCharacterColor(0, 0, firstWipeState)).not.toBe("#ffffff");
  expect(getStartupScreenCharacterColor(STARTUP_SCREEN_ART_WIDTH - 1, 0, firstWipeState)).toBe(
    "#ffffff",
  );
  expect(getFirstVisibleGlyphColor(tree)).not.toBe("#ffffff");

  expect(getStartupScreenAnimationState(STARTUP_SCREEN_WIPE_FRAME_COUNT)).toEqual({
    fromColor: "#ffffff",
    kind: "wipe",
    progress: 1,
    toColor: "#ff4d4f",
  });

  expect(
    getStartupScreenAnimationState(
      STARTUP_SCREEN_INITIAL_FRAME_COUNT + STARTUP_SCREEN_WIPE_FRAME_COUNT,
    ),
  ).toEqual({
    fromColor: "#ff4d4f",
    kind: "wipe",
    progress: 1 / STARTUP_SCREEN_WIPE_FRAME_COUNT,
    toColor: "#22c55e",
  });
  expect(
    getStartupScreenAnimationState(
      STARTUP_SCREEN_INITIAL_FRAME_COUNT + STARTUP_SCREEN_WIPE_FRAME_COUNT * 2,
    ),
  ).toEqual({
    fromColor: "#22c55e",
    kind: "wipe",
    progress: 1 / STARTUP_SCREEN_WIPE_FRAME_COUNT,
    toColor: "#ffffff",
  });
  expect(getStartupScreenAnimationState(STARTUP_SCREEN_FINAL_FRAME)).toEqual({
    color: "#ffffff",
    kind: "solid",
  });

  act(() => {
    vi.advanceTimersByTime(STARTUP_SCREEN_FRAME_MS * STARTUP_SCREEN_FINAL_FRAME);
  });

  expect(getFirstVisibleGlyphColor(tree)).toBe("#ffffff");
});

test("wipes upper rows ahead of lower rows", () => {
  const firstWipeState = getStartupScreenAnimationState(STARTUP_SCREEN_INITIAL_FRAME_COUNT);

  expect(getStartupScreenCharacterColor(5, 0, firstWipeState)).not.toBe(
    getStartupScreenCharacterColor(5, STARTUP_SCREEN_ART_LINES.length - 1, firstWipeState),
  );
  expect(getStartupScreenCharacterColor(5, 0, firstWipeState)).not.toBe("#ffffff");
  expect(
    getStartupScreenCharacterColor(5, STARTUP_SCREEN_ART_LINES.length - 1, firstWipeState),
  ).toBe("#ffffff");
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
