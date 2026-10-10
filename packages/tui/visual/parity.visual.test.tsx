import { expect, test } from "bun:test";
import { StyledText, TextRenderable, type Renderable, ScrollBoxRenderable } from "@opentui/core";
import { launchApp, describePane, type AppHarness } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines, wrappingLines } from "./harness/fixture-repo.ts";
import { getFilePreview } from "../src/diff/preview-lines.ts";
import { copySelection } from "../src/selection-copy.ts";
import { githubReview, thread } from "./harness/review-fixture.ts";

export function descendants(node: Renderable): Renderable[] {
  return [node, ...node.getChildren().flatMap((child) => descendants(child as Renderable))];
}
function diffScroll(app: AppHarness): ScrollBoxRenderable {
  return descendants(app.renderer.root).filter(
    (node) => node instanceof ScrollBoxRenderable,
  )[1] as ScrollBoxRenderable;
}
function buffer(app: AppHarness, marker: string): TextRenderable {
  const node = descendants(app.renderer.root).find(
    (node) => node instanceof TextRenderable && node.plainText.includes(marker),
  );
  if (!(node instanceof TextRenderable)) throw new Error(`No text buffer contains ${marker}`);
  return node;
}
async function withLongFile(run: (app: AppHarness) => Promise<void>, deferred = false) {
  const repo = createFixtureRepo([
    { path: "src/a.ts", after: wrappingLines("long", 1200) },
    { path: "src/b.ts", after: numberedLines("target", 8) },
  ]);
  const app = await launchApp(repo, {
    width: 120,
    height: 40,
    prepare: (session) => ({
      ...session,
      files: session.files.map((file) =>
        deferred ? { ...file, unifiedLines: [], sideBySideRows: [] } : getFilePreview(file),
      ),
    }),
  });
  try {
    await run(app);
  } finally {
    app.destroy();
    repo.dispose();
  }
}

test("counted line jumps use wrapped visual rows and survive opening a collapsed file", async () => {
  await withLongFile(async (app) => {
    for (const collapsed of [false, true]) {
      if (collapsed) await app.press("z");
      const report = await app.press("1", "0", "0", "s", "s");
      const pane = app.diffPane();
      const row = pane.rows.findIndex((value) => value.includes("long_100 = 100"));
      expect(row, describePane(pane, 25)).toBe(Math.floor(diffScroll(app).viewport.height / 3));
      expect(report.extraFrames).toBe(0);
    }
  });
});

test("paging and half-page scrolling use native viewport size, not arrow-key focus", async () => {
  await withLongFile(async (app) => {
    const scroll = diffScroll(app);
    const top = scroll.scrollTop;
    const commits = app.commits();
    await app.press("\x1b[6~");
    expect(scroll.scrollTop).toBe(top + scroll.viewport.height);
    await app.press("\x1b[5~");
    expect(scroll.scrollTop).toBe(top);
    await app.press("\x04");
    expect(scroll.scrollTop).toBe(top + Math.round(scroll.viewport.height / 2));
    expect(app.commits() - commits).toBe(0);
  });
});

test("refresh preserves the viewport file even when selection is elsewhere", async () => {
  await withLongFile(async (app) => {
    // Mouse-wheel style native scrolling does not change the selected file.
    const scroll = diffScroll(app);
    const target = buffer(app, "target line 1");
    scroll.scrollTo(target.y - scroll.content.y + 2);
    await app.settle();
    const before = app.diffPane();
    await app.press("R");
    await app.waitFor(() => app.frame().includes("Refreshed"));
    expect(app.diffPane()).toEqual(before);
  });
});

test("reviewed-then-next and next-unreviewed use the same first-row reveal", async () => {
  await withLongFile(async (app) => {
    const report = await app.press("r");
    expect(app.diffPane().stickyPath).toBe("src/b.ts");
    expect(app.diffPane().rows[0]).toContain("target line 1");
    expect(report.extraFrames).toBe(0);
    await app.press("HOME", "u");
    expect(app.diffPane().rows[0]).toContain("target line 1");
  });
});

test("background syntax colors update buffers without changing geometry or snapping to selection", async () => {
  await withLongFile(async (app) => {
    const text = buffer(app, "long_1 = 1");
    await app.press("\x1b[6~");
    const before = app.diffPane();
    const count = app.renderableCount();
    await app.waitFor(() =>
      (buffer(app, "long_1 = 1").content as StyledText).chunks.some((chunk) => chunk.fg != null),
    );
    expect(text.plainText).toBe(buffer(app, "long_1 = 1").plainText);
    expect(app.diffPane()).toEqual(before);
    expect(app.renderableCount()).toBe(count);
    const content = buffer(app, "long_1 = 1").content as StyledText;
    expect(content.chunks.some((chunk) => chunk.fg != null)).toBe(true);
  }, true);
}, 15000);

test("unchanged refresh rehydrates replacement file objects", async () => {
  await withLongFile(async (app) => {
    const highlighted = () =>
      (buffer(app, "long_1 = 1").content as StyledText).chunks.some((chunk) => chunk.fg != null);
    await app.waitFor(highlighted);
    const previous = buffer(app, "long_1 = 1").content;
    await app.press("R");
    await app.waitFor(() => app.frame().includes("Refreshed"));
    await app.waitFor(() => buffer(app, "long_1 = 1").content !== previous && highlighted());
  }, true);
}, 15000);

test("cached initial selection uses measured first-row alignment on launch", async () => {
  const repo = createFixtureRepo([
    { path: "src/a.ts", after: wrappingLines("long", 1000) },
    { path: "src/b.ts", after: numberedLines("cached", 5) },
  ]);
  const app = await launchApp(repo, {
    props: {
      initialReviewCache: { collapsedPaths: [], reviewedFiles: [], selectedFilePath: "src/b.ts" },
    },
  });
  try {
    expect(app.diffPane().stickyPath).toBe("src/b.ts");
    expect(app.diffPane().rows[0]).toContain("cached line 1");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("repeating the current line jump reveals it again after native scrolling", async () => {
  await withLongFile(async (app) => {
    await app.press("1", "0", "0", "s", "s");
    const expected = app.diffPane();
    await app.press("\x1b[6~");
    expect(app.diffPane()).not.toEqual(expected);
    await app.press("1", "0", "0", "s", "s");
    expect(app.diffPane()).toEqual(expected);
  });
});

test("native selection copies logical text across soft wraps without gutters", async () => {
  await withLongFile(async (app) => {
    await app.press("7", "s", "s");
    const text = buffer(app, "long_1 = 1");
    const startRow = text.lineInfo.lineSources.indexOf(6);
    const nextRow = text.lineInfo.lineSources.indexOf(7);
    app.renderer.startSelection(text, text.x, text.y + startRow);
    app.renderer.updateSelection(
      text,
      text.x + text.lineInfo.lineWidthCols[nextRow - 1]!,
      text.y + nextRow - 1,
      { finishDragging: true },
    );
    const copied: string[] = [];
    expect(
      copySelection(app.renderer, {
        copyText: async (value) => {
          copied.push(value);
          return true;
        },
      }),
    ).toBe(true);
    expect(copied).toEqual([text.plainText.split("\n")[6]!]);
  });
});

test("mounted renderables depend on chunks, not on logical line count", async () => {
  const counts: number[] = [];
  for (const lines of [10, 10000]) {
    const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("scale", lines) }]);
    const app = await launchApp(repo, {
      prepare: (session) => ({ ...session, files: session.files.map(getFilePreview) }),
    });
    try {
      counts.push(app.renderableCount());
    } finally {
      app.destroy();
      repo.dispose();
    }
  }
  expect(counts[1]).toBe(counts[0]);
});

test("hunk navigation preserves headers and unchanged-line gaps in native chunks", async () => {
  const before = numberedLines("hunks", 100);
  const after = before
    .replace("hunks line 10", "changed_one")
    .replace("hunks line 90", "changed_two");
  const repo = createFixtureRepo([{ path: "src/hunks.ts", before, after }]);
  const app = await launchApp(repo);
  try {
    await app.press("g", "n");
    const report = await app.press("g", "n");
    expect(app.diffPane().rows.join("\n")).toContain("changed_two");
    expect(report.extraFrames).toBe(0);
    await app.press("g", "p");
    expect(app.diffPane().rows.join("\n")).toContain("changed_one");
    expect(app.diffPane().rows.join("\n")).toContain("unchanged lines");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("counted hunk jumps reveal exact first lines across files and in reverse", async () => {
  const before = numberedLines("exact", 100);
  const after = before
    .replace("exact line 10", "changed_10")
    .replace("exact line 50", "changed_50")
    .replace("exact line 90", "changed_90");
  const repo = createFixtureRepo([
    { path: "src/a.ts", before, after },
    { path: "src/b.ts", before, after },
  ]);
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, files: session.files.map(getFilePreview) }),
  });
  try {
    for (const [keys, path, line] of [
      [["g", "n"], "src/a.ts", 47],
      [["2", "g", "n"], "src/b.ts", 7],
      [["g", "p"], "src/a.ts", 87],
      [["2", "g", "p"], "src/a.ts", 7],
    ] as const) {
      await app.press(...keys);
      const pane = app.diffPane();
      expect(app.frame()).toContain(`Jumped to hunk at ${path}:${line}.`);
      const row = pane.rows.findIndex((value) => value.includes(`exact line ${line}`));
      if (path === "src/a.ts" && line === 7) {
        expect(row >= 0).toBe(true);
        expect(row).toBeLessThanOrEqual(Math.floor(diffScroll(app).viewport.height / 3));
      } else
        expect(row, describePane(pane, 20)).toBe(Math.floor(diffScroll(app).viewport.height / 3));
    }
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("inline ranged threads split native chunks and retain collapse/selection in both views", async () => {
  const repo = createFixtureRepo([{ path: "src/a.ts", after: numberedLines("inline", 12) }]);
  const app = await launchApp(repo, {
    width: 180,
    height: 45,
    prepare: (session) => ({
      ...session,
      github: githubReview(repo.path, [thread("src/a.ts", 3)]),
    }),
  });
  try {
    await app.press("j");
    for (const split of [false, true]) {
      if (split) await app.press("v");
      let rows = app.diffPane().rows.join("\n");
      expect(rows.indexOf("inline line 3")).toBeLessThan(rows.indexOf("INLINE_COMMENT_3"));
      expect(rows.indexOf("INLINE_COMMENT_3")).toBeLessThan(rows.indexOf("inline line 4"));
      expect(rows).toContain("inline line 12");
      await app.press("o", "c");
      rows = app.diffPane().rows.join("\n");
      expect(rows).not.toContain("INLINE_COMMENT_3");
      expect(rows).toContain("inline line 4");
      await app.press("c");
      expect(app.diffPane().rows.join("\n")).toContain("INLINE_COMMENT_3");
    }
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("word-change backgrounds and syntax colors survive native buffer rendering", async () => {
  const repo = createFixtureRepo([
    {
      path: "src/a.ts",
      before: "export const value = 123;\n",
      after: "export const value = 456;\n",
    },
  ]);
  const app = await launchApp(repo);
  try {
    await app.waitFor(() =>
      (buffer(app, "value = 456").content as StyledText).chunks.some((chunk) => chunk.fg != null),
    );
    const changed = buffer(app, "value = 456");
    const chunks = (changed.content as StyledText).chunks;
    expect(chunks.some((chunk) => chunk.bg != null)).toBe(true);
    expect(chunks.some((chunk) => chunk.fg != null)).toBe(true);
    expect(app.diffPane().rows.join("\n")).toContain("value = 456");
    expect(app.diffPane().rows.join("\n")).toContain("value = 123");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("empty lines, tabs and wide characters remain logical lines in both views", async () => {
  const content = "// first\n\n\tconst wide = '你好 🌈';\n// last\n";
  const repo = createFixtureRepo([{ path: "src/a.ts", after: content }]);
  const app = await launchApp(repo, { width: 200 });
  try {
    expect(buffer(app, "const wide").plainText).toBe(content.trimEnd());
    expect(app.diffPane().rows.join("\n")).toContain("// last");
    await app.press("v");
    expect(buffer(app, "const wide").plainText).toBe(content.trimEnd());
    expect(app.diffPane().rows.join("\n")).toContain("你好 🌈");
    expect(app.diffPane().rows.join("\n")).toContain("// last");
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("mixed navigation, collapse, view toggles and resize keep first-frame file alignment", async () => {
  const files = Array.from({ length: 12 }, (_, index) => ({
    path: `src/f${String(index).padStart(2, "0")}.ts`,
    after: wrappingLines(`f${index}`, index === 5 ? 700 : 10),
  }));
  const repo = createFixtureRepo(files);
  const app = await launchApp(repo, {
    prepare: (session) => ({ ...session, files: session.files.map(getFilePreview) }),
  });
  let selected = 0;
  let seed = 12345;
  const collapsed = new Set<number>();
  try {
    for (let step = 0; step < 70; step++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const action = seed % 7;
      if (action === 4) {
        await app.press("z");
        if (collapsed.has(selected)) collapsed.delete(selected);
        else collapsed.add(selected);
        continue;
      }
      if (action === 5) {
        await app.press("v");
        continue;
      }
      if (action === 6) {
        await app.resize(step % 2 === 0 ? 100 : 200, 35);
        continue;
      }
      const key = ["j", "k", "HOME", "END"][action]!;
      selected =
        action === 0
          ? Math.min(selected + 1, files.length - 1)
          : action === 1
            ? Math.max(selected - 1, 0)
            : action === 2
              ? 0
              : files.length - 1;
      const report = await app.press(key);
      expect(app.diffPane().stickyPath, `step ${step}: ${key}`).toBe(files[selected]!.path);
      if (!collapsed.has(selected))
        expect(app.diffPane().rows[0], `step ${step}: ${key}`).toContain(`f${selected}_1 = 1`);
      expect(report.extraFrames, `step ${step}: ${key}`).toBe(0);
    }
  } finally {
    app.destroy();
    repo.dispose();
  }
});

test("binary, empty, error, no-text and unparsed-native fallbacks paint correctly", async () => {
  const repo = createFixtureRepo([
    { path: "a_binary.bin", after: "\0binary" },
    { path: "b_empty.txt", after: "" },
    { path: "c_fallback.ts", after: "export const fallback = 1;\n" },
    { path: "d_error.ts", after: "export const error = 1;\n" },
    { path: "e_notext.ts", after: "export const noText = 1;\n" },
  ]);
  const app = await launchApp(repo, {
    width: 200,
    prepare: (session) => ({
      ...session,
      files: session.files.map((file) => {
        if (file.path === "c_fallback.ts")
          return { ...file, diff: undefined, unifiedLines: [], sideBySideRows: [] };
        if (file.path === "d_error.ts") return { ...file, renderError: "Fixture render error" };
        if (file.path === "e_notext.ts")
          return {
            ...file,
            patch: "",
            diff: undefined,
            status: "modified" as const,
            unifiedLines: [],
            sideBySideRows: [],
          };
        return file;
      }),
    }),
  });
  try {
    expect(app.diffPane().rows[0]).toContain("Binary file changed");
    await app.press("j");
    expect(app.diffPane().rows[0]).toContain("empty file");
    await app.press("j");
    expect(app.diffPane().rows.join("\n")).toContain("export const fallback = 1;");
    await app.press("v");
    expect(app.diffPane().rows.join("\n")).toContain("export const fallback = 1;");
    await app.press("j");
    expect(app.diffPane().rows[0]).toContain("Fixture render error");
    await app.press("j");
    expect(app.diffPane().rows[0]).toContain("No textual diff available");
  } finally {
    app.destroy();
    repo.dispose();
  }
});
