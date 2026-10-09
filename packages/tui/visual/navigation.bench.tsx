/**
 * Navigation performance benchmark for the diff viewport.
 *
 * Usage: bun --preload ./visual/preload.ts ./visual/navigation.bench.tsx [--json]
 *
 * Builds a large synthetic review (hundreds of files, several huge wrapping
 * files), drives real keyboard and mouse navigation through the headless
 * OpenTUI renderer, and reports per-action latency, settle frames, and the
 * size of the mounted renderable tree.
 */
import { createFixtureRepo, numberedLines, wrappingLines } from "./harness/fixture-repo.ts";
import { launchApp, type ActionReport } from "./harness/app-harness.tsx";

const FILE_COUNT = Number(process.env.FILE_COUNT ?? 240);
const HUGE_FILE_EVERY = Math.max(30, Math.floor(FILE_COUNT / 8));
const json = process.argv.includes("--json");

const files = Array.from({ length: FILE_COUNT }, (_, index) => {
  const name = `f${String(index).padStart(3, "0")}`;
  const isHuge = index % HUGE_FILE_EVERY === 3;
  return {
    path: `src/${name}.ts`,
    after: isHuge ? wrappingLines(name, 3000) : numberedLines(name, 20 + ((index * 37) % 160)),
  };
});
const repo = createFixtureRepo(files);

interface Sample {
  name: string;
  reports: ActionReport[];
}

const startedAt = performance.now();
const app = await launchApp(repo, { height: 50, width: 160 });
const launchMs = performance.now() - startedAt;
const renderablesAtLaunch = app.renderableCount();
const samples: Sample[] = [];
let maxRenderables = renderablesAtLaunch;

async function sample(name: string, count: number, action: () => Promise<ActionReport>) {
  const reports: ActionReport[] = [];
  for (let index = 0; index < count; index += 1) {
    reports.push(await action());
    maxRenderables = Math.max(maxRenderables, app.renderableCount());
  }
  samples.push({ name, reports });
}

await sample("no-op frame (harness overhead)", 10, () => app.settle());
await sample("diff next file (j)", 40, () => app.press("j"));
await sample("diff previous file (k)", 40, () => app.press("k"));
await sample("diff last/first file (end/home)", 6, async () => {
  await app.press("END");
  return app.press("HOME");
});
await app.press("TAB");
await sample("tree next file (j)", 40, () => app.press("j"));
await sample("tree previous file (k)", 40, () => app.press("k"));
await app.press("TAB");
await sample("diff page down", 30, () => app.press("\x1b[6~"));

app.destroy();
repo.dispose();

const rows = samples.map(({ name, reports }) => ({
  action: name,
  samples: reports.length,
  firstFrameP50: percentile(
    reports.map((report) => report.firstFrameMs),
    0.5,
  ),
  firstFrameP95: percentile(
    reports.map((report) => report.firstFrameMs),
    0.95,
  ),
  settledP95: percentile(
    reports.map((report) => report.settledMs),
    0.95,
  ),
  extraFramesMax: Math.max(...reports.map((report) => report.extraFrames)),
  extraFramesTotal: reports.reduce((sum, report) => sum + report.extraFrames, 0),
}));
const summary = {
  fileCount: FILE_COUNT,
  launchMs: round(launchMs),
  maxRenderables,
  renderablesAtLaunch,
  rows,
};

if (json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(
    `files=${FILE_COUNT} launch=${round(launchMs)}ms renderables(launch)=${renderablesAtLaunch} renderables(max)=${maxRenderables}`,
  );
  console.table(rows);
}
process.exit(0);

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
