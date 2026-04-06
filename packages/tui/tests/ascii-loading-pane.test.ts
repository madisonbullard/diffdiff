import { describe, expect, test } from "vite-plus/test";
import {
  ASCII_LOADING_FRAMES,
  getAsciiLoadingFrame,
} from "../src/components/ascii-loading-pane.tsx";

describe("ascii loading pane", () => {
  test("uses a single-cell frame for each animation step", () => {
    for (const glyph of ASCII_LOADING_FRAMES) {
      expect(Array.from(glyph)).toHaveLength(1);
    }
  });

  test("cycles through the grow and pop loop in order", () => {
    expect(ASCII_LOADING_FRAMES).toEqual([
      "\u00b7",
      "\u2022",
      "\u274b",
      "\u25cf",
      "\u229b",
      "\u235f",
      "\u2022",
    ]);

    for (const [frame, glyph] of ASCII_LOADING_FRAMES.entries()) {
      expect(getAsciiLoadingFrame(frame)).toBe(glyph);
    }

    expect(getAsciiLoadingFrame(ASCII_LOADING_FRAMES.length)).toBe(ASCII_LOADING_FRAMES[0]);
  });

  test("wraps negative frames cleanly", () => {
    expect(getAsciiLoadingFrame(-1)).toBe("\u2022");
    expect(getAsciiLoadingFrame(-2)).toBe("\u235f");
  });
});
