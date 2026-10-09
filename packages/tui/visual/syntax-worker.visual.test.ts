import { expect, test } from "bun:test";
import { createSyntaxHydrator } from "../src/diff/syntax-hydrator.ts";
import type { SyntaxJob } from "../src/diff/syntax-worker.ts";
import { getUiTheme } from "../src/theme.ts";

const job: SyntaxJob = {
  themeName: "pierre-dark",
  theme: getUiTheme("pierre-dark"),
  file: {
    path: "a.bin",
    status: "added",
    additions: 0,
    deletions: 0,
    patch: "",
    isBinary: true,
    lineNumberWidth: 3,
    unifiedLines: [],
    sideBySideRows: [],
  },
};

test("syntax worker handles serial jobs and rejects overlapping requests", async () => {
  const hydrator = createSyntaxHydrator();
  try {
    const first = hydrator.hydrate(job);
    let error: unknown;
    try {
      await hydrator.hydrate(job);
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof Error).toBe(true);
    expect(await first).toEqual({ file: job.file });
    expect(await hydrator.hydrate(job)).toEqual({ file: job.file });
  } finally {
    hydrator.dispose();
  }
});

test("disposing syntax hydration rejects in-flight and future work without leaving a live worker", async () => {
  const hydrator = createSyntaxHydrator();
  const request = hydrator.hydrate(job).catch((error: Error) => error.message);
  hydrator.dispose();
  expect(await request).toBe("Syntax hydrator is disposed.");
  expect(await hydrator.hydrate(job).catch((error: Error) => error.message)).toBe(
    "Syntax hydrator is disposed.",
  );
});
