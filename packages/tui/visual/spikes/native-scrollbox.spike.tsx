/**
 * Throwaway spike: does the idiomatic OpenTUI path (every file mounted in one
 * <scrollbox>, one <line-number><text> buffer per hunk, native word wrap,
 * viewport culling) meet diffdiff's navigation and performance needs?
 *
 * Usage: bun --preload ./visual/preload.ts ./visual/spikes/native-scrollbox.spike.tsx
 */
import {
  StyledText,
  type BoxRenderable,
  type LineColorConfig,
  type LineSign,
  type Renderable,
  type ScrollBoxRenderable,
  type TextChunk,
} from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import { act, memo, useRef, useState } from "react";
import { loadPreparedReviewSession } from "../../src/diff/prepare-review-session.ts";
import { loadStartupPreparedReviewSession } from "../../src/startup-session.ts";
import { getSyntaxPalette } from "../../src/syntax-palette.ts";
import { getUiTheme } from "../../src/theme.ts";
import type { PreparedReviewFile } from "../../src/types.ts";
import { createFixtureRepo, numberedLines, wrappingLines } from "../harness/fixture-repo.ts";

const theme = getUiTheme("pierre-dark");
const files = Array.from({ length: 240 }, (_, index) => {
  const name = `f${String(index).padStart(3, "0")}`;
  return {
    path: `src/${name}.ts`,
    after:
      index % 30 === 3 ? wrappingLines(name, 3000) : numberedLines(name, 20 + ((index * 37) % 160)),
  };
});
const repo = createFixtureRepo(files);
const options = { base: repo.base, head: repo.head, repoPath: repo.path };
const session = await loadStartupPreparedReviewSession(
  loadPreparedReviewSession,
  options,
  "pierre-dark",
  theme,
  getSyntaxPalette("pierre-dark"),
);

interface Chunk {
  content: StyledText;
  lineColors: Map<number, LineColorConfig>;
  lineNumbers: Map<number, number>;
  lineSigns: Map<number, LineSign>;
}

function buildChunks(file: PreparedReviewFile): Chunk[] {
  const diff = file.diff;
  if (diff == null) return [];
  return diff.hunks.map((hunk) => {
    const chunks: TextChunk[] = [];
    const lineColors = new Map<number, LineColorConfig>();
    const lineNumbers = new Map<number, number>();
    const lineSigns = new Map<number, LineSign>();
    let row = 0;
    let deletionIndex = hunk.deletionLineIndex;
    let additionIndex = hunk.additionLineIndex;
    let oldLine = hunk.deletionStart;
    let newLine = hunk.additionStart;
    const push = (text: string, kind: "context" | "addition" | "deletion", lineNumber: number) => {
      chunks.push({ __isChunk: true, text: `${text.replace(/\n$/u, "")}\n` } as TextChunk);
      lineNumbers.set(row, lineNumber);
      if (kind === "addition") {
        lineColors.set(row, { content: theme.additionBg, gutter: theme.additionLineNumberBg });
        lineSigns.set(row, { after: " +", afterColor: theme.success });
      } else if (kind === "deletion") {
        lineColors.set(row, { content: theme.deletionBg, gutter: theme.deletionLineNumberBg });
        lineSigns.set(row, { after: " -", afterColor: theme.danger });
      }
      row += 1;
    };
    for (const content of hunk.hunkContent) {
      if (content.type === "context") {
        for (let index = 0; index < content.lines; index += 1) {
          push(diff.additionLines[additionIndex++] ?? "", "context", newLine++);
          deletionIndex += 1;
          oldLine += 1;
        }
        continue;
      }
      for (let index = 0; index < content.deletions; index += 1) {
        push(diff.deletionLines[deletionIndex++] ?? "", "deletion", oldLine++);
      }
      for (let index = 0; index < content.additions; index += 1) {
        push(diff.additionLines[additionIndex++] ?? "", "addition", newLine++);
      }
    }
    const last = chunks[chunks.length - 1];
    if (last != null) last.text = last.text.replace(/\n$/u, "");
    return {
      content: process.env.PLAIN
        ? (chunks.map((c) => c.text).join("") as never)
        : new StyledText(chunks),
      lineColors,
      lineNumbers,
      lineSigns,
    };
  });
}

const prepared = session.files.map((file) => ({ file, chunks: buildChunks(file) }));

const FileCard = memo(function FileCard({
  entry,
  registerNode,
  selected,
}: {
  entry: (typeof prepared)[number];
  registerNode: (node: BoxRenderable | null) => void;
  selected: boolean;
}) {
  return (
    <box
      ref={registerNode}
      border={["left"]}
      borderColor={selected ? theme.borderActive : theme.border}
      flexDirection="column"
      paddingLeft={2}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      <text wrapMode="none">{`▼ ${entry.file.path}`}</text>
      {entry.chunks.map((chunk, index) => (
        <line-number
          key={index}
          fg={theme.textMuted}
          lineColors={chunk.lineColors}
          lineNumbers={chunk.lineNumbers}
          lineSigns={chunk.lineSigns}
          width="100%"
        >
          <text content={chunk.content} wrapMode="word" flexGrow={1} />
        </line-number>
      ))}
    </box>
  );
});

const HEADER_ROWS = 3;
let scrollBox: ScrollBoxRenderable | null = null;
const nodes: (BoxRenderable | null)[] = [];
const registerNodes = prepared.map((_, index) => (node: BoxRenderable | null) => {
  nodes[index] = node;
});

function App() {
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0);
  useKeyboard((key) => {
    const delta = key.name === "j" ? 1 : key.name === "k" ? -1 : 0;
    if (key.name === "pagedown") {
      scrollBox?.scrollBy(scrollBox.viewport.height);
      return;
    }
    if (delta === 0 || scrollBox == null) return;
    const next = Math.max(0, Math.min(prepared.length - 1, selectedRef.current + delta));
    selectedRef.current = next;
    const node = nodes[next];
    // Layout does not depend on scroll or selection, so last frame's geometry is current.
    if (node != null) scrollBox.scrollTo(node.y - scrollBox.content.y + HEADER_ROWS);
    setSelected(next);
  });
  return (
    <scrollbox ref={(node) => void (scrollBox = node)} flexGrow={1} focused={false}>
      {prepared.map((entry, index) => (
        <FileCard
          key={entry.file.path}
          entry={entry}
          registerNode={registerNodes[index]!}
          selected={index === selected}
        />
      ))}
      <box height={50} />
    </scrollbox>
  );
}

const mountStartedAt = performance.now();
const app = await testRender(<App />, { height: 50, width: 124 });
const paint = async () => {
  await act(async () => {
    await app.renderOnce();
  });
};
const reactMountMs = performance.now() - mountStartedAt;
const firstPaintStartedAt = performance.now();
await paint();
const firstPaintMs = performance.now() - firstPaintStartedAt;
await paint();
const mountMs = performance.now() - mountStartedAt;
console.log({ firstPaintMs: Math.round(firstPaintMs), reactMountMs: Math.round(reactMountMs) });
for (let index = 0; index < 3; index += 1) {
  await act(async () => {
    app.mockInput.pressKey("j");
  });
  await paint();
}
console.log(app.captureCharFrame().split("\n").slice(0, 14).join("\n"));
await act(async () => {
  app.mockInput.pressKey("k");
  app.mockInput.pressKey("k");
  app.mockInput.pressKey("k");
});
await paint();
const count = (node: Renderable): number =>
  1 + node.getChildren().reduce((sum, child) => sum + count(child as Renderable), 0);

async function timeKey(key: string): Promise<number> {
  const startedAt = performance.now();
  await act(async () => {
    app.mockInput.pressKey(key);
  });
  await paint();
  return performance.now() - startedAt;
}

const failures: string[] = [];
const jumpTimes: number[] = [];
for (let index = 1; index < 60; index += 1) {
  jumpTimes.push(await timeKey("j"));
  const frame = app.captureCharFrame().split("\n");
  const name = `f${String(index).padStart(3, "0")}`;
  const firstLine = frame[0] ?? "";
  if (!firstLine.includes(`${name} line 1`) && !firstLine.includes(`${name}_1 `)) {
    failures.push(`${name}: ${firstLine.trim()}`);
  }
}
const pageTimes: number[] = [];
for (let index = 0; index < 40; index += 1) pageTimes.push(await timeKey("PAGEDOWN"));

const percentile = (values: number[], fraction: number) =>
  Math.round(([...values].sort((a, b) => a - b)[Math.floor(values.length * fraction)] ?? 0) * 10) /
  10;
console.log({
  jumpFailures: failures.slice(0, 5),
  jumpFailureCount: failures.length,
  jumpP50: percentile(jumpTimes, 0.5),
  jumpP95: percentile(jumpTimes, 0.95),
  mountMs: Math.round(mountMs),
  pageP50: percentile(pageTimes, 0.5),
  pageP95: percentile(pageTimes, 0.95),
  renderables: count(app.renderer.root),
  totalLines: prepared.reduce((sum, entry) => sum + entry.file.additions + entry.file.deletions, 0),
});
app.renderer.destroy();
repo.dispose();
process.exit(0);
