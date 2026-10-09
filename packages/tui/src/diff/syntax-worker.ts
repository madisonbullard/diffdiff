import { parentPort } from "node:worker_threads";
import { hydratePreparedReviewFiles } from "./prepare-review-session.ts";
import type { PreparedReviewFile, PierreThemeName } from "../types.ts";
import type { UiTheme } from "../theme.ts";

export interface SyntaxJob {
  file: PreparedReviewFile;
  themeName: PierreThemeName;
  theme: UiTheme;
}
export type SyntaxResult = { file: PreparedReviewFile } | { error: string };

parentPort?.on("message", async (job: SyntaxJob) => {
  try {
    const [file] = await hydratePreparedReviewFiles(
      [job.file],
      job.themeName,
      job.theme,
      undefined,
      { initialDiffView: "both" },
    );
    parentPort?.postMessage({ file } satisfies SyntaxResult);
  } catch (error) {
    parentPort?.postMessage({
      error: error instanceof Error ? error.message : String(error),
    } satisfies SyntaxResult);
  }
});
