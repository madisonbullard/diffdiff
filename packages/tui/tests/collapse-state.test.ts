import type { GitHubPullRequestReviewThread } from "@madisonbullard/diffdiff-core";
import { expect, test } from "vite-plus/test";
import {
  getCommentCollapsed,
  getReviewThreadCollapseKey,
  getReviewThreadDefaultCollapsed,
  toggleCommentCollapseState,
} from "../src/review/collapse-state.ts";

function thread(isResolved: boolean, isOutdated = false): GitHubPullRequestReviewThread {
  return { id: "101", comments: [], path: "a.ts", side: "RIGHT", isOutdated, isResolved };
}

test("resolved and outdated threads default to collapsed, active threads stay expanded", () => {
  expect(getReviewThreadDefaultCollapsed(thread(true))).toBe(true);
  expect(getReviewThreadDefaultCollapsed(thread(false, true))).toBe(true);
  expect(getReviewThreadDefaultCollapsed(thread(true, true))).toBe(true);
  expect(getReviewThreadDefaultCollapsed(thread(false))).toBe(false);
});

test("resolving a thread resets an earlier manual expansion without preventing expansion", () => {
  const activeKey = getReviewThreadCollapseKey(thread(false));
  const resolvedKey = getReviewThreadCollapseKey(thread(true));
  expect(resolvedKey).not.toBe(activeKey);
  const states = { [activeKey]: false };
  expect(getCommentCollapsed(states, resolvedKey, true)).toBe(true);
  const expanded = toggleCommentCollapseState(states, resolvedKey, true);
  expect(getCommentCollapsed(expanded, resolvedKey, true)).toBe(false);
  expect(toggleCommentCollapseState(expanded, resolvedKey, true)).toEqual(states);
});
