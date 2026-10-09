import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createFixtureRepo,
  numberedLines,
  wrappingLines,
  type FixtureRepo,
} from "./harness/fixture-repo.ts";
import {
  describePane,
  firstContentRowIndex,
  launchApp,
  type ActionReport,
  type AppHarness,
  type DiffPaneFrame,
} from "./harness/app-harness.tsx";

/**
 * Visual navigation contract.
 *
 * Every "go to file" action must leave the target file's first diff row as the
 * first content row of the diff viewport, with the sticky header naming that
 * file. That must already be true on the first painted frame and must not move
 * afterwards.
 */

const FILES = {
  first: { path: "src/a_first.ts", firstLine: "a_first line 1" },
  long: { path: "src/b_long.ts", firstLine: "b_long_1 = 1" },
  target: { path: "src/c_target.ts", firstLine: "c_target line 1" },
  middle: { path: "src/d_middle.ts", firstLine: "d_middle line 1" },
  last: { path: "src/e_last.ts", firstLine: "e_last line 1" },
} as const;

type FixtureKey = keyof typeof FILES;
const ORDER: FixtureKey[] = ["first", "long", "target", "middle", "last"];

let repo: FixtureRepo;

beforeAll(() => {
  repo = createFixtureRepo([
    { path: FILES.first.path, after: numberedLines("a_first", 4) },
    { path: FILES.long.path, after: wrappingLines("b_long", 1500) },
    { path: FILES.target.path, after: numberedLines("c_target", 6) },
    { path: FILES.middle.path, after: numberedLines("d_middle", 90) },
    { path: FILES.last.path, after: numberedLines("e_last", 3) },
  ]);
});

afterAll(() => {
  repo.dispose();
});

async function withApp(
  run: (app: AppHarness) => Promise<void>,
  size?: { width: number; height: number },
) {
  const app = await launchApp(repo, size);
  try {
    await run(app);
  } finally {
    app.destroy();
  }
}

function expectFileAtTop(pane: DiffPaneFrame, key: FixtureKey, context: string) {
  const file = FILES[key];
  const firstRow = firstContentRowIndex(pane);
  const detail = `${context}\n${describePane(pane)}`;
  expect(pane.stickyPath, detail).toBe(file.path);
  expect(pane.rows[firstRow] ?? "", detail).toContain(file.firstLine);
  expect(firstRow, detail).toBeLessThanOrEqual(1);
}

function expectNoMovementAfterFirstFrame(report: ActionReport, context: string) {
  const describeFrames = report.frames
    .map((frame, index) => `--- frame ${index}\n${describePane(frame, 6)}`)
    .join("\n");
  expect(report.extraFrames, `${context}\n${describeFrames}`).toBe(0);
}

describe("first paint", () => {
  test("the sticky header names the file at the top of the viewport", async () => {
    await withApp(async (app) => {
      expectFileAtTop(app.diffPane(), "first", "initial frame");
    });
  });
});

describe("tree selection", () => {
  test("lands on each file's first row, including files after a long wrapped file", async () => {
    await withApp(async (app) => {
      await app.press("TAB");
      for (const key of ORDER.slice(1)) {
        const report = await app.press("j");
        expectFileAtTop(app.diffPane(), key, `tree j -> ${FILES[key].path}`);
        expectNoMovementAfterFirstFrame(report, `tree j -> ${FILES[key].path}`);
      }
    });
  });

  test("lands on each file's first row when moving back up past a long file", async () => {
    await withApp(async (app) => {
      await app.press("TAB", "j", "j", "j", "j");
      for (const key of [...ORDER].reverse().slice(1)) {
        const report = await app.press("k");
        expectFileAtTop(app.diffPane(), key, `tree k -> ${FILES[key].path}`);
        expectNoMovementAfterFirstFrame(report, `tree k -> ${FILES[key].path}`);
      }
    });
  });
});

describe("diff pane file navigation", () => {
  test("next file lands on each file's first row", async () => {
    await withApp(async (app) => {
      for (const key of ORDER.slice(1)) {
        const report = await app.press("j");
        expectFileAtTop(app.diffPane(), key, `diff j -> ${FILES[key].path}`);
        expectNoMovementAfterFirstFrame(report, `diff j -> ${FILES[key].path}`);
      }
    });
  });

  test("jumping to the last file and back to the first lands on their first rows", async () => {
    await withApp(async (app) => {
      await app.press("END");
      expectFileAtTop(app.diffPane(), "last", "end -> last file");
      await app.press("HOME");
      expectFileAtTop(app.diffPane(), "first", "home -> first file");
    });
  });
});

describe("layout changes keep the viewport anchored", () => {
  test("collapsing the selected long file keeps it at the top and pulls the next file up", async () => {
    await withApp(async (app) => {
      await app.press("j");
      expectFileAtTop(app.diffPane(), "long", "select long file");
      await app.press("z");
      const pane = app.diffPane();
      const detail = describePane(pane);
      expect(pane.stickyPath, detail).toBe(FILES.long.path);
      expect(pane.rows.slice(0, 6).join("\n"), detail).toContain(FILES.target.path);
    });
  });

  test("resizing keeps the selected file's first row at the top", async () => {
    await withApp(async (app) => {
      await app.press("j", "j");
      expectFileAtTop(app.diffPane(), "target", "select target");
      await app.resize(96, 40);
      expectFileAtTop(app.diffPane(), "target", "after narrowing");
      await app.resize(140, 30);
      expectFileAtTop(app.diffPane(), "target", "after widening");
    });
  });
});

describe("split view", () => {
  test("tree selection past a long file lands on the target's first row", async () => {
    await withApp(
      async (app) => {
        await app.press("v");
        await app.press("TAB", "j", "j");
        expectFileAtTop(app.diffPane(), "target", "split tree j j -> target");
      },
      { width: 220, height: 40 },
    );
  });
});
