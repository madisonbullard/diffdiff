import type { ReviewSession, StartupOptions } from "@madisonbullard/diffdiff-core";
import type { PrepareReviewSessionOptions } from "./diff/pierre-internals.ts";
import type { SyntaxPalette } from "./syntax-palette.ts";
import type { UiTheme } from "./theme.ts";
import type { PierreThemeName, PreparedReviewSession } from "./types.ts";

// Startup keeps patch parsing cheap, then hydrates syntax as files approach the viewport.
const STARTUP_PREPARE_REVIEW_SESSION_OPTIONS = {
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
    sessionPromise?: Promise<ReviewSession>,
  ) => Promise<PreparedReviewSession>,
  options: StartupOptions,
  themeName: PierreThemeName,
  theme: UiTheme,
  syntaxPalette: SyntaxPalette,
  sessionPromise?: Promise<ReviewSession>,
): Promise<PreparedReviewSession> {
  return loadPreparedReviewSession(
    { ...options, loadComparisonDetails: false },
    themeName,
    theme,
    syntaxPalette,
    STARTUP_PREPARE_REVIEW_SESSION_OPTIONS,
    ...(sessionPromise == null ? [] : [sessionPromise]),
  );
}
