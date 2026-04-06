import { describe, expect, test } from "vite-plus/test";
import {
  LEADER_PREFIX,
  SPACE_PREFIX,
  createKeymapRuntime,
  getDefaultKeymaps,
  keyEventFromInput,
} from "../src/app/keymap/index.ts";
import * as A from "../src/app/keymap/actions.ts";
import type { KeyboardInput } from "../src/keyboard-input.ts";

function press(
  mode: "diff" | "thread" | "tree",
  key: KeyboardInput,
  runtime = createKeymapRuntime(getDefaultKeymaps()),
) {
  return runtime.get(mode, keyEventFromInput(key));
}

describe("default keymaps", () => {
  test("keeps diff-mode bare command shortcuts wired up", () => {
    expect(press("diff", { name: "r", sequence: "r" })).toMatchObject({
      actionId: A.REVIEW_TOGGLE_REVIEWED,
      kind: "matched",
    });
    expect(press("diff", { name: "c", sequence: "c" })).toMatchObject({
      actionId: A.REVIEW_TOGGLE_COLLAPSED,
      kind: "matched",
    });
    expect(press("diff", { meta: true, name: "r", sequence: "r" })).toMatchObject({
      actionId: A.REVIEW_CLEAR_REVIEWED,
      kind: "matched",
    });
    expect(press("diff", { name: "v", sequence: "v" })).toMatchObject({
      actionId: A.VIEW_DIFF_TOGGLE,
      kind: "matched",
    });
    expect(press("diff", { name: "d", sequence: "d" })).toMatchObject({
      actionId: A.SYSTEM_DIAGNOSTICS,
      kind: "matched",
    });
    expect(press("diff", { name: "t", sequence: "t" })).toMatchObject({
      actionId: A.GITHUB_COMMENTS,
      kind: "matched",
    });
    expect(press("diff", { name: "a", sequence: "a" })).toMatchObject({
      actionId: A.GITHUB_ADD_COMMENT,
      kind: "matched",
    });
    expect(press("diff", { name: "a", sequence: "A", shift: true })).toMatchObject({
      actionId: A.GITHUB_SUBMIT_REVIEW,
      kind: "matched",
    });
    expect(press("diff", { name: "m", sequence: "m" })).toMatchObject({
      actionId: A.GITHUB_MERGE,
      kind: "matched",
    });
    expect(press("diff", { name: "y", sequence: "y" })).toMatchObject({
      actionId: A.GITHUB_COPY_URL,
      kind: "matched",
    });
  });

  test("keeps tree-mode global shortcuts available when they do not conflict with tree nav", () => {
    expect(press("tree", { name: "d", sequence: "d" })).toMatchObject({
      actionId: A.SYSTEM_DIAGNOSTICS,
      kind: "matched",
    });
    expect(press("tree", { name: "v", sequence: "v" })).toMatchObject({
      actionId: A.VIEW_DIFF_TOGGLE,
      kind: "matched",
    });
    expect(press("tree", { name: "t", sequence: "t" })).toMatchObject({
      actionId: A.GITHUB_COMMENTS,
      kind: "matched",
    });
    expect(press("tree", { name: "a", sequence: "a" })).toMatchObject({
      actionId: A.GITHUB_ADD_COMMENT,
      kind: "matched",
    });
    expect(press("tree", { name: "a", sequence: "A", shift: true })).toMatchObject({
      actionId: A.GITHUB_SUBMIT_REVIEW,
      kind: "matched",
    });
    expect(press("tree", { name: "m", sequence: "m" })).toMatchObject({
      actionId: A.GITHUB_MERGE,
      kind: "matched",
    });
    expect(press("tree", { name: "y", sequence: "y" })).toMatchObject({
      actionId: A.GITHUB_COPY_URL,
      kind: "matched",
    });
  });

  test("preserves thread-specific bare shortcuts while keeping shared commands available", () => {
    expect(press("thread", { name: "r", sequence: "r" })).toMatchObject({
      actionId: A.GITHUB_REPLY_THREAD,
      kind: "matched",
    });
    expect(press("thread", { name: "c", sequence: "c" })).toMatchObject({
      actionId: A.GITHUB_TOGGLE_THREAD,
      kind: "matched",
    });
    expect(press("thread", { name: "y", sequence: "y" })).toMatchObject({
      actionId: A.GITHUB_COPY_COMMENT_URL,
      kind: "matched",
    });
    expect(press("thread", { name: "d", sequence: "d" })).toMatchObject({
      actionId: A.SYSTEM_DIAGNOSTICS,
      kind: "matched",
    });
    expect(press("thread", { name: "t", sequence: "t" })).toMatchObject({
      actionId: A.GITHUB_COMMENTS,
      kind: "matched",
    });
    expect(press("thread", { name: "a", sequence: "a" })).toMatchObject({
      actionId: A.GITHUB_ADD_COMMENT,
      kind: "matched",
    });
    expect(press("thread", { name: "a", sequence: "A", shift: true })).toMatchObject({
      actionId: A.GITHUB_SUBMIT_REVIEW,
      kind: "matched",
    });
    expect(press("thread", { name: "m", sequence: "m" })).toMatchObject({
      actionId: A.GITHUB_MERGE,
      kind: "matched",
    });
  });

  test("keeps shared leader and space continuations reachable", () => {
    const runtime = createKeymapRuntime(getDefaultKeymaps());

    expect(press("diff", { name: "space", sequence: " " }, runtime)).toMatchObject({
      kind: "pending",
      node: expect.objectContaining({ label: SPACE_PREFIX.nodeLabel }),
    });
    expect(press("diff", { name: "h", sequence: "h" }, runtime)).toMatchObject({
      actionId: A.SYSTEM_HELP,
      kind: "matched",
    });

    expect(press("diff", { name: "space", sequence: " " }, runtime)).toMatchObject({
      kind: "pending",
      node: expect.objectContaining({ label: SPACE_PREFIX.nodeLabel }),
    });
    expect(press("diff", { name: "d", sequence: "d" }, runtime)).toMatchObject({
      actionId: A.SYSTEM_DIAGNOSTICS,
      kind: "matched",
    });

    expect(press("diff", { ctrl: true, name: "x" }, runtime)).toMatchObject({
      kind: "pending",
      node: expect.objectContaining({ label: LEADER_PREFIX.nodeLabel }),
    });
    expect(press("diff", { name: "d", sequence: "d" }, runtime)).toMatchObject({
      actionId: A.SYSTEM_DIAGNOSTICS,
      kind: "matched",
    });
  });
});
