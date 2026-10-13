import { expect, test } from "vite-plus/test";
import { extendReviewRange, type SelectedReviewAnchor } from "../src/review-anchors.ts";

const patch =
  "@@ -10,4 +10,4 @@\n context\n-old one\n-old two\n+new one\n+new two\n tail\n@@ -30,1 +30,1 @@\n-end\n+end\n";
const anchor = (line: number, side: "LEFT" | "RIGHT"): SelectedReviewAnchor => ({
  path: "a.ts",
  line,
  side,
  key: `a.ts:${side}:${line}::`,
  snippet: "line",
});

test("range grows in both directions and normalizes GitHub endpoints", () => {
  const first = extendReviewRange(patch, anchor(11, "RIGHT"), 1);
  expect(first).toMatchObject({
    startLine: 11,
    line: 12,
    startSide: "RIGHT",
    side: "RIGHT",
    focusLine: 12,
  });
  const both = extendReviewRange(patch, first, -1);
  expect(both).toMatchObject({ startLine: 10, line: 12, focusLine: 10 });
  expect(both.snippet).toBe("context\nnew one\nnew two");
});

test("removed ranges include LEFT context but never added lines or another hunk", () => {
  const range = extendReviewRange(patch, anchor(11, "LEFT"), 20);
  expect(range).toMatchObject({ startLine: 11, line: 13, side: "LEFT" });
  expect(range.snippet).toBe("old one\nold two\ntail");
  expect(extendReviewRange(patch, range, 1)).toBe(range);
  expect(extendReviewRange(patch, range, -20)).toMatchObject({ startLine: 10, line: 13 });
});

test("boundary and invalid anchors remain single-line, without range fields", () => {
  const first = anchor(10, "RIGHT");
  expect(extendReviewRange(patch, first, -1)).toBe(first);
  const invalid = anchor(99, "RIGHT");
  expect(extendReviewRange(patch, invalid, 1)).toBe(invalid);
});

test("hunk content resembling file headers and no-newline markers stays selectable", () => {
  const symbols =
    "--- a/a.ts\n+++ b/a.ts\n@@ -1,2 +1,2 @@\n---old\n-old tail\n+++new\n+new tail\n\\ No newline at end of file\n";
  expect(extendReviewRange(symbols, anchor(1, "RIGHT"), 1)).toMatchObject({
    startLine: 1,
    line: 2,
    snippet: "++new\nnew tail",
  });
  expect(extendReviewRange(symbols, anchor(2, "LEFT"), -1)).toMatchObject({
    startLine: 1,
    line: 2,
    snippet: "--old\nold tail",
  });
});
