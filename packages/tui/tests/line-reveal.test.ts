import { expect, test } from "vite-plus/test";
import { getLineRevealScrollTop, LINE_REVEAL_CONTEXT_ROWS } from "../src/app/layout/diff-scroll.ts";

const reveal = (lineTop: number, options: Partial<Parameters<typeof getLineRevealScrollTop>[0]>) =>
  getLineRevealScrollTop({
    height: 30,
    lineRows: 1,
    lineTop,
    placement: "nearest",
    scrollTop: 100,
    ...options,
  });

test("nearest keeps fully visible lines, including wrapped ones, in place", () => {
  expect(reveal(100, {})).toBe(100);
  expect(reveal(129, {})).toBe(100);
  expect(reveal(127, { lineRows: 3 })).toBe(100);
});

test("nearest reveals partly or just hidden lines at the closest edge with context", () => {
  expect(reveal(130, {})).toBe(101 + LINE_REVEAL_CONTEXT_ROWS);
  expect(reveal(128, { lineRows: 3 })).toBe(101 + LINE_REVEAL_CONTEXT_ROWS);
  expect(reveal(99, {})).toBe(99 - LINE_REVEAL_CONTEXT_ROWS);
  expect(reveal(98, { lineRows: 3 })).toBe(98 - LINE_REVEAL_CONTEXT_ROWS);
  expect(reveal(1, { scrollTop: 2 })).toBe(0);
});

test("nearest shrinks context in short viewports and top-aligns lines taller than the viewport", () => {
  expect(reveal(108, { height: 8 })).toBe(102);
  expect(reveal(104, { height: 8, lineRows: 10 })).toBe(104);
  expect(reveal(95, { height: 8, lineRows: 10 })).toBe(95);
});

test("moves that keep nothing of the old viewport fall back to the jump placement", () => {
  expect(reveal(160, {})).toBe(150);
  expect(reveal(40, {})).toBe(30);
  expect(reveal(105, { placement: "jump" })).toBe(95);
  expect(reveal(5, { placement: "jump" })).toBe(0);
});
