import { expect, test } from "vite-plus/test";
import {
  closeDialog,
  getActiveDialog,
  getDialogExitAction,
  openDialog,
} from "../src/app/dialogs/stack.ts";

test("tracks which modal opened the active child modal", () => {
  const stack = openDialog(openDialog([], "branch", { clear: true }), "list-filter");

  expect(stack).toEqual([
    { dialog: "branch", triggeredBy: null },
    { dialog: "list-filter", triggeredBy: "branch" },
  ]);
  expect(getActiveDialog(stack)).toBe("list-filter");
});

test("restores the parent modal when child exit conditions allow it", () => {
  const stack = openDialog(openDialog([], "comments"), "comment-composer");

  expect(getDialogExitAction("list-filter", "dismiss")).toBe("restore-parent");
  expect(getDialogExitAction("comment-composer", "dismiss")).toBe("restore-parent");
  expect(getDialogExitAction("comment-composer", "complete")).toBe("restore-parent");
  expect(closeDialog(stack, "comment-composer", "dismiss")).toEqual([
    { dialog: "comments", triggeredBy: null },
  ]);
  expect(closeDialog(stack, "comment-composer", "complete")).toEqual([
    { dialog: "comments", triggeredBy: null },
  ]);
});

test("closes terminal modal flows instead of restoring stale parents", () => {
  const mergeStack = openDialog(openDialog([], "comments"), "merge");
  const cleanupStack = openDialog(mergeStack, "cleanup", {
    replace: true,
    triggeredBy: "merge",
  });

  expect(getDialogExitAction("branch", "dismiss")).toBe("close-all");
  expect(getDialogExitAction("submit-review", "complete")).toBe("close-all");
  expect(getDialogExitAction("merge", "complete")).toBe("close-all");
  expect(getDialogExitAction("cleanup", "dismiss")).toBe("close-all");
  expect(cleanupStack).toEqual([
    { dialog: "comments", triggeredBy: null },
    { dialog: "cleanup", triggeredBy: "merge" },
  ]);
  expect(closeDialog(mergeStack, "merge", "complete")).toEqual([]);
  expect(closeDialog(cleanupStack, "cleanup", "dismiss")).toEqual([]);
});
