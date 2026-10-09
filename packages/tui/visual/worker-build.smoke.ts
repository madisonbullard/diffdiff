import { Worker } from "node:worker_threads";
import { createFixtureRepo } from "./harness/fixture-repo.ts";
import { loadPreparedReviewSession } from "../src/diff/prepare-review-session.ts";
import { getUiTheme } from "../src/theme.ts";
import type { SyntaxResult } from "../src/diff/syntax-worker.ts";

// Verify the published worker entry, not just the TS source exercised by the
// visual suite. This also catches missing bundled grammars/theme assets.
const repo = createFixtureRepo([{ path: "a.ts", after: "export const value = 456;\n" }]);
const worker = new Worker(new URL("../dist/syntax-worker.mjs", import.meta.url));
try {
  const themeName = "pierre-dark";
  const theme = getUiTheme(themeName);
  const session = await loadPreparedReviewSession(
    { repoPath: repo.path, base: repo.base, head: repo.head },
    themeName,
    theme,
    undefined,
    { deferSyntaxRendering: true },
  );
  const result = await new Promise<SyntaxResult>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Bundled syntax worker timed out.")), 10000);
    worker.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    worker.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Worker exited before returning (${code}).`));
    });
    worker.once("message", (message: SyntaxResult) => {
      clearTimeout(timeout);
      resolve(message);
    });
    worker.postMessage({ file: session.files[0], theme, themeName });
  });
  if ("error" in result) throw new Error(result.error);
  if (
    !result.file.unifiedLines.some((line) => line.segments.some((segment) => segment.fg != null))
  ) {
    throw new Error("Bundled worker did not highlight the fixture.");
  }
  console.log("Bundled syntax worker: passed.");
} finally {
  await worker.terminate();
  repo.dispose();
}
