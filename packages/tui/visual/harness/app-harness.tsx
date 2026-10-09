import type { CliRenderer, Renderable } from "@opentui/core";
import type { KeyInput } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";
import { act, Profiler } from "react";
import { DiffdiffApp } from "../../src/app/DiffdiffApp.tsx";
import { loadPreparedReviewSession } from "../../src/diff/prepare-review-session.ts";
import { loadStartupPreparedReviewSession } from "../../src/startup-session.ts";
import { getSyntaxPalette } from "../../src/syntax-palette.ts";
import { getSyntaxStyle } from "../../src/syntax-style.ts";
import { getUiTheme } from "../../src/theme.ts";
import type { LaunchOptions } from "../../src/types.ts";
import { getFileTreeSidebarWidth } from "../../src/view-model.ts";
import type { FixtureRepo } from "./fixture-repo.ts";
import type { DiffdiffAppProps } from "../../src/app/state/app-props.ts";

const THEME_NAME = "pierre-dark" as const;
const TITLE_PATTERN = /^\s*┃?\s*[▼▶]\s+(\S+)/u;
const MAX_SETTLE_FRAMES = 40;

suppressAsyncActWarnings();

export interface DiffPaneFrame {
  /** Path shown in the sticky header band above the diff viewport. */
  stickyPath: string | undefined;
  /** Diff viewport rows below the sticky band, with the card border stripped. */
  rows: string[];
}

export interface ActionReport {
  /** Wall time from input to the first painted frame. */
  firstFrameMs: number;
  /** Wall time from input until the frame stops changing. */
  settledMs: number;
  /** Distinct frames painted after the first one before settling. */
  extraFrames: number;
  /** Diff pane snapshot of every painted frame, first to last. */
  frames: DiffPaneFrame[];
}

export interface AppHarness {
  renderer: CliRenderer;
  commits: () => number;
  width: number;
  height: number;
  /** Press keys one at a time and wait for the app to settle after each. */
  press: (...keys: KeyInput[]) => Promise<ActionReport>;
  /** Paint frames until the output stops changing. */
  settle: () => Promise<ActionReport>;
  resize: (width: number, height: number) => Promise<ActionReport>;
  frame: () => string;
  diffPane: () => DiffPaneFrame;
  renderableCount: () => number;
  waitFor: (condition: () => boolean) => Promise<void>;
  destroy: () => void;
}

export async function launchApp(
  repo: FixtureRepo,
  {
    height = 40,
    width = 120,
    props,
    prepare,
  }: {
    height?: number;
    width?: number;
    props?: Partial<DiffdiffAppProps>;
    prepare?: (
      session: Awaited<ReturnType<typeof loadPreparedReviewSession>>,
    ) => Awaited<ReturnType<typeof loadPreparedReviewSession>>;
  } = {},
): Promise<AppHarness> {
  const theme = getUiTheme(THEME_NAME);
  const syntaxPalette = getSyntaxPalette(THEME_NAME);
  const options: LaunchOptions = { base: repo.base, head: repo.head, repoPath: repo.path };
  const loadSession = (nextOptions: LaunchOptions) =>
    loadStartupPreparedReviewSession(
      loadPreparedReviewSession,
      nextOptions,
      THEME_NAME,
      theme,
      syntaxPalette,
    );
  const loadedSession = await loadSession(options);
  const initialSession = prepare?.(loadedSession) ?? loadedSession;
  let commits = 0;
  const setup = await testRender(
    <Profiler
      id="app"
      onRender={() => {
        commits += 1;
      }}
    >
      <DiffdiffApp
        initialOptions={options}
        initialSession={initialSession}
        loadSession={loadSession}
        onExit={() => undefined}
        openExternalEditor={async (_root, value) => value}
        openFileInEditor={async () => undefined}
        syntaxStyle={getSyntaxStyle(THEME_NAME)}
        theme={theme}
        {...props}
      />
    </Profiler>,
    { height, width },
  );
  let currentWidth = width;
  let currentHeight = height;

  const diffPane = () => parseDiffPane(setup.captureCharFrame(), currentWidth);

  async function paint(): Promise<string> {
    await act(async () => {
      await setup.renderOnce();
      await new Promise((resolve) => setTimeout(resolve, 2));
    });
    return setup.captureCharFrame();
  }

  async function measure(trigger: () => void): Promise<ActionReport> {
    const startedAt = performance.now();
    await act(async () => {
      trigger();
    });
    const frames: string[] = [await paint()];
    const firstFrameMs = performance.now() - startedAt;
    let settledAt = performance.now();
    let stableCount = 0;
    for (let index = 0; index < MAX_SETTLE_FRAMES && stableCount < 3; index += 1) {
      const next = await paint();
      if (next === frames[frames.length - 1]) {
        stableCount += 1;
      } else {
        stableCount = 0;
        frames.push(next);
        settledAt = performance.now();
      }
    }

    return {
      extraFrames: frames.length - 1,
      firstFrameMs,
      frames: frames.map((frame) => parseDiffPane(frame, currentWidth)),
      settledMs: settledAt - startedAt,
    };
  }

  const harness: AppHarness = {
    renderer: setup.renderer,
    commits: () => commits,
    get width() {
      return currentWidth;
    },
    get height() {
      return currentHeight;
    },
    destroy: () => setup.renderer.destroy(),
    diffPane,
    frame: () => setup.captureCharFrame(),
    async press(...keys) {
      let report: ActionReport | undefined;
      for (const key of keys) {
        report = await measure(() => setup.mockInput.pressKey(key));
      }
      return report!;
    },
    renderableCount: () => countRenderables(setup.renderer.root),
    async waitFor(condition) {
      const deadline = performance.now() + 10000;
      while (!condition()) {
        if (performance.now() > deadline)
          throw new Error("Timed out waiting for the native renderer.");
        await paint();
      }
      await harness.settle();
    },
    resize(nextWidth, nextHeight) {
      currentWidth = nextWidth;
      currentHeight = nextHeight;
      return measure(() => setup.resize(nextWidth, nextHeight));
    },
    settle: () => measure(() => undefined),
  };

  await harness.settle();
  return harness;
}

export function parseDiffPane(frame: string, width: number): DiffPaneFrame {
  const lines = frame.trimEnd().split("\n");
  const paneStart = getFileTreeSidebarWidth(width);
  const paneLines = lines.map((line) => line.slice(paneStart));
  const stickyRow = paneLines.findIndex((line, index) => index < 8 && TITLE_PATTERN.test(line));
  if (stickyRow < 0) {
    return { rows: paneLines.slice(3, -1).map(stripCardBorder), stickyPath: undefined };
  }

  return {
    rows: paneLines.slice(stickyRow + 2, -1).map(stripCardBorder),
    stickyPath: TITLE_PATTERN.exec(paneLines[stickyRow]!)?.[1],
  };
}

/** Index of the first viewport row that is not blank card padding. */
export function firstContentRowIndex(pane: DiffPaneFrame): number {
  return pane.rows.findIndex((row) => row.trim() !== "");
}

export function describePane(pane: DiffPaneFrame, rowCount = 12): string {
  return [
    `sticky: ${pane.stickyPath ?? "<none>"}`,
    ...pane.rows.slice(0, rowCount).map((row, index) => `${String(index).padStart(2)}| ${row}`),
  ].join("\n");
}

function stripCardBorder(line: string): string {
  return line
    .replace(/^\s?┃/u, "")
    .replace(/[▀▄█]\s*$/u, "")
    .trimEnd();
}

function countRenderables(node: Renderable): number {
  let count = 1;
  for (const child of node.getChildren()) {
    count += countRenderables(child as Renderable);
  }
  return count;
}

function suppressAsyncActWarnings(): void {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) {
      return;
    }
    originalError(...args);
  };
}
