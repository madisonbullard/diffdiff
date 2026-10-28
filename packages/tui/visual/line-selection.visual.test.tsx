import { expect, test } from "bun:test";
import {
  LineNumberRenderable,
  ScrollBoxRenderable,
  TextRenderable,
  type Renderable,
} from "@opentui/core";
import { describePane, launchApp, type AppHarness } from "./harness/app-harness.tsx";
import { LINE_REVEAL_CONTEXT_ROWS } from "../src/app/layout/diff-scroll.ts";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview, thread } from "./harness/review-fixture.ts";

function gutters(node: Renderable): LineNumberRenderable[] {
  return [
    ...(node instanceof LineNumberRenderable ? [node] : []),
    ...node.getChildren().flatMap((child) => gutters(child as Renderable)),
  ];
}

for (const width of [120, 220]) {
  test(`line selection paints a moving cursor and tint without remounting at width ${width}`, async () => {
    const before = numberedLines("selection", 8);
    const repo = createFixtureRepo([
      { path: "src/a.ts", before, after: before.replace("selection line 4", "replacement") },
      { path: "src/b.ts", after: numberedLines("next", 4) },
    ]);
    const app = await launchApp(repo, { width });
    try {
      if (width === 220) await app.press("v");
      const nodes = gutters(app.renderer.root);
      const initialColors = nodes.map((node) => new Map(node.getLineColors().gutter));
      const initialContentColors = nodes.map((node) => new Map(node.getLineColors().content));
      const count = app.renderableCount();
      const cursors = () => app.diffPane().rows.filter((row) => /▶\s*\d/u.test(row));
      expect(cursors().length).toBe(0);
      await app.press("]");
      expect(cursors().length).toBe(1);
      expect(cursors()[0]).toContain("selection line");
      const selected = nodes.findIndex((node) =>
        [...node.getLineSigns().values()].some((sign) => sign.before?.includes("▶")),
      );
      expect(selected >= 0).toBe(true);
      const line = [...nodes[selected]!.getLineSigns()].find(([, sign]) =>
        sign.before?.includes("▶"),
      )![0];
      expect(nodes[selected]!.getLineColors().gutter.get(line)).not.toEqual(
        initialColors[selected]!.get(line),
      );
      expect(nodes[selected]!.getLineColors().content.get(line)).not.toEqual(
        initialContentColors[selected]!.get(line),
      );
      const first = cursors()[0];
      await app.press("]");
      expect(cursors().length).toBe(1);
      expect(cursors()[0]).not.toBe(first);
      await app.press("[");
      expect(cursors()).toEqual([first!]);
      expect(gutters(app.renderer.root)).toEqual(nodes);
      expect(app.renderableCount()).toBe(count);
      await app.press("j");
      expect(cursors().length).toBe(0);
      expect(nodes.map((node) => node.getLineColors().gutter)).toEqual(initialColors);
      expect(nodes.map((node) => node.getLineColors().content)).toEqual(initialContentColors);
      expect(
        nodes.every((node) =>
          [...node.getLineSigns().values()].every((sign) => !sign.before?.includes("▶")),
        ),
      ).toBe(true);
      await app.press("]");
      expect(cursors().length).toBe(1);
      expect(cursors()[0]).toContain("next line");
    } finally {
      app.destroy();
      repo.dispose();
    }
  });
}

test("line cursor keeps visible lines in place and reveals off-screen lines at the nearest edge", async () => {
  const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("step", 300) }]);
  const app = await launchApp(repo);
  try {
    const scroll = descendantScrollboxes(app)[1]!;
    const height = scroll.viewport.height;
    const cursorRow = () => app.diffPane().rows.findIndex((row) => /▶\s*\d/u.test(row));
    const press = async (...keys: string[]) => {
      const report = await app.press(...keys);
      expect(report.extraFrames).toBe(0);
    };

    await press("]");
    const top = scroll.scrollTop;
    while (cursorRow() < height - 1) {
      await press("]");
      expect(scroll.scrollTop, describePane(app.diffPane(), height)).toBe(top);
    }
    await press("]");
    expect(cursorRow(), describePane(app.diffPane(), height)).toBe(
      height - 1 - LINE_REVEAL_CONTEXT_ROWS,
    );
    expect(scroll.scrollTop).toBe(top + LINE_REVEAL_CONTEXT_ROWS + 1);

    const scrolled = scroll.scrollTop;
    while (cursorRow() > 0) {
      await press("[");
      expect(scroll.scrollTop).toBe(scrolled);
    }
    await press("[");
    expect(cursorRow(), describePane(app.diffPane(), height)).toBe(LINE_REVEAL_CONTEXT_ROWS);
    expect(scroll.scrollTop).toBe(scrolled - LINE_REVEAL_CONTEXT_ROWS - 1);

    // Leaving the viewport entirely keeps the canonical jump placement.
    await press("1", "5", "0", "]");
    expect(cursorRow(), describePane(app.diffPane(), height)).toBe(Math.floor(height / 3));
  } finally {
    app.destroy();
    repo.dispose();
  }
});

function descendantScrollboxes(app: AppHarness): ScrollBoxRenderable[] {
  const walk = (node: Renderable): Renderable[] => [
    node,
    ...node.getChildren().flatMap((child) => walk(child as Renderable)),
  ];
  return walk(app.renderer.root).filter((node) => node instanceof ScrollBoxRenderable);
}

test("selected deletion and addition retain diff signs, and comment markers survive selection", async () => {
  const repo = createFixtureRepo([
    { path: "src/a.ts", before: "old line\n", after: "new line\n\nlast line\n" },
  ]);
  const app = await launchApp(repo, {
    prepare: (session) => ({
      ...session,
      github: githubReview(repo.path, [thread("src/a.ts", 1)]),
    }),
  });
  try {
    await app.press("j", "[");
    expect(app.diffPane().rows.some((row) => /▶\s*1 -.*old line/u.test(row))).toBe(true);
    await app.press("]");
    expect(app.diffPane().rows.some((row) => /▶┃\s*1 \+.*new line/u.test(row))).toBe(true);
    await app.press("]");
    expect(app.diffPane().rows.some((row) => /┃\s*1 \+.*new line/u.test(row))).toBe(true);
    expect(app.diffPane().rows.filter((row) => /▶\s*2 \+/u.test(row)).length).toBe(1);
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("moving selection on wrapped lines leaves native text geometry unchanged", async () => {
  const repo = createFixtureRepo([
    { path: "src/a.ts", after: `${"// wrapped words ".repeat(24)}\n\n// final\n` },
  ]);
  const app = await launchApp(repo);
  try {
    const node = gutters(app.renderer.root)[0]!;
    const text = node
      .getChildren()
      .find((child) => child instanceof TextRenderable) as TextRenderable;
    const sources = [...text.lineInfo.lineSources];
    const geometry = [text.x, text.width, text.height];
    expect(sources.filter((line) => line === 0).length > 1).toBe(true);
    await app.press("[");
    expect(app.diffPane().rows.some((row) => /▶\s*1 \+.*wrapped words/u.test(row))).toBe(true);
    await app.press("]");
    expect([...text.lineInfo.lineSources]).toEqual(sources);
    expect([text.x, text.width, text.height]).toEqual(geometry);
    expect(app.diffPane().rows.filter((row) => /▶\s*2 \+/u.test(row)).length).toBe(1);
  } finally {
    app.destroy();
    repo.dispose();
  }
});
