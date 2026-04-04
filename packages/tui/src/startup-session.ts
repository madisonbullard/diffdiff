import type { StartupOptions } from "@diffdiff/core";
import type { PrepareReviewSessionOptions } from "./diff/pierre-internals.ts";
import type { SyntaxPalette } from "./syntax-palette.ts";
import type { UiTheme } from "./theme.ts";
import type { PierreThemeName, PreparedReviewSession } from "./types.ts";

// Startup keeps patch parsing cheap, then hydrates syntax as files approach the viewport.
export const STARTUP_PREPARE_REVIEW_SESSION_OPTIONS = {
  deferSyntaxRendering: true,
  initialDiffView: "unified",
} satisfies PrepareReviewSessionOptions;

export async function loadStartupPreparedReviewSession(
  loadPreparedReviewSession: (
    options: StartupOptions,
    themeName: PierreThemeName,
    theme: UiTheme,
    syntaxPalette: SyntaxPalette,
    prepareOptions: PrepareReviewSessionOptions,
  ) => Promise<PreparedReviewSession>,
  options: StartupOptions,
  themeName: PierreThemeName,
  theme: UiTheme,
  syntaxPalette: SyntaxPalette,
): Promise<PreparedReviewSession> {
  return loadPreparedReviewSession(
    options,
    themeName,
    theme,
    syntaxPalette,
    STARTUP_PREPARE_REVIEW_SESSION_OPTIONS,
  );
}
