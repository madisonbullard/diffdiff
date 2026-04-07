import type { FileDiffMetadata } from "@pierre/diffs";
import type { ReviewSession, StartupOptions } from "@diffdiff/core";
import {
  loadReviewSession,
  logDiffdiffError,
  logDiffdiffInfo,
  logDiffdiffWarn,
} from "@diffdiff/core";
import { createPierreSegmentColorResolver } from "../pierre-colors.ts";
import { resolvePierreLanguage } from "../language.ts";
import { getSyntaxPalette, type SyntaxPalette } from "../syntax-palette.ts";
import { getUiTheme, type UiTheme } from "../theme.ts";
import type { PierreThemeName, PreparedReviewFile, PreparedReviewSession } from "../types.ts";
import { sortFilesInTreeOrder } from "../view-model.ts";
import {
  createDeferredPreparedFile,
  getLineNumberWidth,
  parseReviewFile,
} from "./plain-preview.ts";
import {
  loadPierreDiffs,
  type HastTextNode,
  type PierreDiffsModule,
  type PierreHighlighter,
  type PrepareReviewSessionOptions,
} from "./pierre-internals.ts";
import { buildSideBySideRows, buildUnifiedLines, parseThemeVariables } from "./rich-preview.ts";

const MISSING_LANGUAGE_ERROR_PATTERN =
  /Language `([^`]+)` not found, you may need to load it first/u;

function getMonotonicNow(): number {
  const now = globalThis.performance?.now?.();
  return typeof now === "number" ? now : Date.now();
}

export async function loadPreparedReviewSession(
  options: StartupOptions,
  themeName: PierreThemeName,
  theme: UiTheme = getUiTheme(themeName),
  syntaxPalette: SyntaxPalette = getSyntaxPalette(themeName),
  prepareOptions: PrepareReviewSessionOptions = {},
): Promise<PreparedReviewSession> {
  const startedAt = getMonotonicNow();
  logDiffdiffInfo("render", "prepared_review_session_load_started", {
    options,
    prepareOptions,
    themeName,
  });
  const reviewSessionLoadStartedAt = getMonotonicNow();
  const session = await loadReviewSession(options);
  const reviewSessionLoadedAt = getMonotonicNow();
  const prepareReviewSessionStartedAt = getMonotonicNow();
  const preparedSession = await prepareReviewSession(
    session,
    themeName,
    theme,
    syntaxPalette,
    prepareOptions,
  );
  const preparedAt = getMonotonicNow();
  logDiffdiffInfo("render", "prepared_review_session_load_completed", {
    deferredSyntaxRendering: prepareOptions.deferSyntaxRendering === true,
    durationMs: Math.round((preparedAt - startedAt) * 10) / 10,
    durationBreakdownMs: {
      loadReviewSession: Math.round((reviewSessionLoadedAt - reviewSessionLoadStartedAt) * 10) / 10,
      prepareReviewSession: Math.round((preparedAt - prepareReviewSessionStartedAt) * 10) / 10,
    },
    fileCount: preparedSession.files.length,
    metrics: summarizePreparedFiles(preparedSession.files),
    themeName,
  });
  return preparedSession;
}

export async function prepareReviewSession(
  session: ReviewSession,
  themeName: PierreThemeName,
  theme: UiTheme = getUiTheme(themeName),
  syntaxPalette: SyntaxPalette = getSyntaxPalette(themeName),
  prepareOptions: PrepareReviewSessionOptions = {},
): Promise<PreparedReviewSession> {
  const startedAt = getMonotonicNow();
  const sortedSession = { ...session, files: sortFilesInTreeOrder(session.files) };

  if (prepareOptions.deferSyntaxRendering) {
    return prepareDeferredReviewSession(
      sortedSession,
      themeName,
      theme,
      syntaxPalette,
      prepareOptions.initialDiffView ?? "both",
    );
  }

  const pierreDiffsLoadStartedAt = getMonotonicNow();
  const pierreDiffs = await loadPierreDiffs();
  const pierreDiffsLoadedAt = getMonotonicNow();
  const parseFilesStartedAt = getMonotonicNow();
  const parsedFiles = sortedSession.files.map((file) => parseReviewFile(file, pierreDiffs));
  const parsedFilesCompletedAt = getMonotonicNow();
  const collectLanguagesStartedAt = getMonotonicNow();
  const languages = collectLanguages(parsedFiles);
  const languagesCollectedAt = getMonotonicNow();
  const highlighterStartedAt = getMonotonicNow();
  const highlighter = await pierreDiffs.getSharedHighlighter({
    themes: [themeName],
    langs: [...languages],
  });
  const highlighterReadyAt = getMonotonicNow();
  const resolveSegmentColor = createPierreSegmentColorResolver(themeName, theme, syntaxPalette);

  const renderFilesStartedAt = getMonotonicNow();
  const files = await Promise.all(
    parsedFiles.map((file) =>
      renderPreparedFile(
        file,
        pierreDiffs,
        highlighter,
        themeName,
        resolveSegmentColor,
        prepareOptions.initialDiffView ?? "both",
      ),
    ),
  );
  const renderedFilesAt = getMonotonicNow();

  logDiffdiffInfo("perf", "prepare_review_session_completed", {
    deferredSyntaxRendering: false,
    durationMs: Math.round((renderedFilesAt - startedAt) * 10) / 10,
    durationBreakdownMs: {
      collectLanguages: Math.round((languagesCollectedAt - collectLanguagesStartedAt) * 10) / 10,
      loadPierreDiffs: Math.round((pierreDiffsLoadedAt - pierreDiffsLoadStartedAt) * 10) / 10,
      parseFiles: Math.round((parsedFilesCompletedAt - parseFilesStartedAt) * 10) / 10,
      renderPreparedFiles: Math.round((renderedFilesAt - renderFilesStartedAt) * 10) / 10,
      sharedHighlighter: Math.round((highlighterReadyAt - highlighterStartedAt) * 10) / 10,
    },
    fileCount: files.length,
    themeName,
  });

  return {
    ...sortedSession,
    files,
    themeName,
  };
}

export async function hydratePreparedReviewFiles(
  files: readonly PreparedReviewFile[],
  themeName: PierreThemeName,
  theme: UiTheme = getUiTheme(themeName),
  syntaxPalette: SyntaxPalette = getSyntaxPalette(themeName),
  prepareOptions: PrepareReviewSessionOptions = {},
): Promise<PreparedReviewFile[]> {
  const candidates = files.filter(shouldHydratePreparedFile);
  if (candidates.length === 0) {
    return [...files];
  }

  const pierreDiffs = await loadPierreDiffs();
  const languages = collectLanguages(candidates);
  const highlighter = await pierreDiffs.getSharedHighlighter({
    themes: [themeName],
    langs: [...languages],
  });
  const resolveSegmentColor = createPierreSegmentColorResolver(themeName, theme, syntaxPalette);

  return Promise.all(
    files.map((file) =>
      shouldHydratePreparedFile(file)
        ? renderPreparedFile(
            file,
            pierreDiffs,
            highlighter,
            themeName,
            resolveSegmentColor,
            prepareOptions.initialDiffView ?? "both",
          )
        : file,
    ),
  );
}

async function prepareDeferredReviewSession(
  session: ReviewSession,
  themeName: PierreThemeName,
  _theme: UiTheme,
  _syntaxPalette: SyntaxPalette,
  _initialDiffView: PrepareReviewSessionOptions["initialDiffView"] = "both",
): Promise<PreparedReviewSession> {
  const startedAt = getMonotonicNow();
  const pierreDiffsLoadStartedAt = getMonotonicNow();
  const pierreDiffs = await loadPierreDiffs();
  const pierreDiffsLoadedAt = getMonotonicNow();
  const createDeferredFilesStartedAt = getMonotonicNow();
  const files = session.files.map((file) => createDeferredPreparedFile(file, pierreDiffs));
  const deferredFilesCreatedAt = getMonotonicNow();
  const previewableFileCount = files.filter((file) => file.diff != null).length;
  const deferredFilesReadyAt = getMonotonicNow();

  logDiffdiffInfo("perf", "prepare_review_session_completed", {
    deferredSyntaxRendering: true,
    durationMs: Math.round((deferredFilesReadyAt - startedAt) * 10) / 10,
    durationBreakdownMs: {
      createDeferredFiles:
        Math.round((deferredFilesCreatedAt - createDeferredFilesStartedAt) * 10) / 10,
      finalizeDeferredFiles: Math.round((deferredFilesReadyAt - deferredFilesCreatedAt) * 10) / 10,
      loadPierreDiffs: Math.round((pierreDiffsLoadedAt - pierreDiffsLoadStartedAt) * 10) / 10,
    },
    deferredPreviewStrategy: "near-viewport-hydration",
    fileCount: files.length,
    previewableFileCount,
    themeName,
  });

  return {
    ...session,
    files,
    themeName,
  };
}

function shouldHydratePreparedFile(file: PreparedReviewFile): boolean {
  return (
    !file.isBinary &&
    file.diff != null &&
    file.renderError == null &&
    file.patch.trim() !== "" &&
    (file.unifiedLines.length === 0 || file.sideBySideRows.length === 0)
  );
}

function collectLanguages(
  files: readonly (PreparedReviewFile & { diff?: FileDiffMetadata })[],
): Set<string> {
  const languages = new Set<string>();

  for (const file of files) {
    const language = resolvePierreLanguage({
      hintedLanguage: file.diff?.lang,
      path: file.path,
      patch: file.patch,
    });
    if (language != null) {
      languages.add(language);
    }
  }

  if (languages.size === 0) {
    languages.add("text");
  }

  return languages;
}

async function renderPreparedFile(
  file: PreparedReviewFile,
  pierreDiffs: PierreDiffsModule,
  highlighter: PierreHighlighter,
  themeName: PierreThemeName,
  resolveSegmentColor: ReturnType<typeof createPierreSegmentColorResolver>,
  initialDiffView: PrepareReviewSessionOptions["initialDiffView"],
): Promise<PreparedReviewFile> {
  if (file.diff == null || file.isBinary) {
    return file;
  }

  try {
    return buildPreparedFileFromRenderedDiff(
      file,
      pierreDiffs.renderDiffWithHighlighter(file.diff, highlighter, {
        theme: themeName,
        tokenizeMaxLineLength: 500,
        lineDiffType: "word",
      }),
      resolveSegmentColor,
      initialDiffView,
    );
  } catch (error) {
    const missingLanguage = getMissingLanguage(error);
    if (missingLanguage != null) {
      const recovered = await tryRenderPreparedFileWithLoadedLanguage(
        file,
        pierreDiffs,
        highlighter,
        themeName,
        resolveSegmentColor,
        initialDiffView,
        missingLanguage,
      );
      if (recovered != null) {
        return recovered;
      }

      logDiffdiffWarn("render", "diff_render_plain_text_fallback", {
        missingLanguage,
        path: file.path,
        themeName,
      });
      return buildPlainTextPreparedFile(file, resolveSegmentColor, initialDiffView);
    }

    logDiffdiffError("render", "diff_render_failed", error, {
      path: file.path,
      themeName,
    });
    return {
      ...file,
      renderError: error instanceof Error ? error.message : "Unable to render diff.",
    };
  }
}

function buildPreparedFileFromRenderedDiff(
  file: PreparedReviewFile,
  rendered: ReturnType<PierreDiffsModule["renderDiffWithHighlighter"]>,
  resolveSegmentColor: ReturnType<typeof createPierreSegmentColorResolver>,
  initialDiffView: PrepareReviewSessionOptions["initialDiffView"],
): PreparedReviewFile {
  const diff = file.diff;
  if (diff == null) {
    return file;
  }

  const themeVariables = parseThemeVariables(rendered.themeStyles);
  // Startup spends most of its time building diff rows. When the app opens in unified mode,
  // skipping split-row materialization cuts a large chunk of that work without losing the raw
  // patch data needed to render the alternate view later.
  const unifiedLines =
    initialDiffView === "unified" || initialDiffView === "both"
      ? buildUnifiedLines(
          diff,
          rendered.code.deletionLines as never[],
          rendered.code.additionLines as never[],
          themeVariables,
          resolveSegmentColor,
        )
      : [];
  const sideBySideRows =
    initialDiffView === "split" || initialDiffView === "both"
      ? buildSideBySideRows(
          diff,
          rendered.code.deletionLines as never[],
          rendered.code.additionLines as never[],
          themeVariables,
          resolveSegmentColor,
        )
      : [];

  return {
    ...file,
    renderError: undefined,
    sideBySideRows,
    unifiedLines,
    lineNumberWidth: getLineNumberWidth(diff),
  };
}

async function tryRenderPreparedFileWithLoadedLanguage(
  file: PreparedReviewFile,
  pierreDiffs: PierreDiffsModule,
  highlighter: PierreHighlighter,
  themeName: PierreThemeName,
  resolveSegmentColor: ReturnType<typeof createPierreSegmentColorResolver>,
  initialDiffView: PrepareReviewSessionOptions["initialDiffView"],
  missingLanguage: string,
): Promise<PreparedReviewFile | undefined> {
  try {
    if (!highlighter.getLoadedLanguages().includes(missingLanguage)) {
      await highlighter.loadLanguage(missingLanguage);
      logDiffdiffWarn("render", "diff_render_language_loaded_on_demand", {
        missingLanguage,
        path: file.path,
        themeName,
      });
    }

    return buildPreparedFileFromRenderedDiff(
      file,
      pierreDiffs.renderDiffWithHighlighter(file.diff!, highlighter, {
        theme: themeName,
        tokenizeMaxLineLength: 500,
        lineDiffType: "word",
      }),
      resolveSegmentColor,
      initialDiffView,
    );
  } catch (retryError) {
    logDiffdiffWarn("render", "diff_render_retry_failed_after_language_load", {
      error: retryError,
      missingLanguage,
      path: file.path,
      themeName,
    });
    return undefined;
  }
}

function buildPlainTextPreparedFile(
  file: PreparedReviewFile,
  resolveSegmentColor: ReturnType<typeof createPierreSegmentColorResolver>,
  initialDiffView: PrepareReviewSessionOptions["initialDiffView"],
): PreparedReviewFile {
  const diff = file.diff;
  if (diff == null) {
    return file;
  }

  const deletionLines = createPlainTextNodes(diff.deletionLines);
  const additionLines = createPlainTextNodes(diff.additionLines);
  const themeVariables = new Map<string, string>();

  return {
    ...file,
    renderError: undefined,
    sideBySideRows:
      initialDiffView === "split" || initialDiffView === "both"
        ? buildSideBySideRows(
            diff,
            deletionLines,
            additionLines,
            themeVariables,
            resolveSegmentColor,
          )
        : [],
    unifiedLines:
      initialDiffView === "unified" || initialDiffView === "both"
        ? buildUnifiedLines(diff, deletionLines, additionLines, themeVariables, resolveSegmentColor)
        : [],
    lineNumberWidth: getLineNumberWidth(diff),
  };
}

function createPlainTextNodes(lines: readonly string[]): HastTextNode[] {
  return lines.map((line) => ({ type: "text", value: line }));
}

function getMissingLanguage(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : undefined;
  if (message == null) {
    return undefined;
  }

  return MISSING_LANGUAGE_ERROR_PATTERN.exec(message)?.[1];
}

function summarizePreparedFiles(files: readonly PreparedReviewFile[]): {
  binaryFileCount: number;
  largestFile?: { path: string; patchBytes: number };
  patchBytes: number;
  splitRowCount: number;
  unifiedLineCount: number;
} {
  let patchBytes = 0;
  let unifiedLineCount = 0;
  let splitRowCount = 0;
  let binaryFileCount = 0;
  let largestFile: { path: string; patchBytes: number } | undefined;

  for (const file of files) {
    const filePatchBytes = Buffer.byteLength(file.patch, "utf8");
    patchBytes += filePatchBytes;
    unifiedLineCount += file.unifiedLines.length;
    splitRowCount += file.sideBySideRows.length;
    binaryFileCount += file.isBinary ? 1 : 0;

    if (largestFile == null || filePatchBytes > largestFile.patchBytes) {
      largestFile = {
        path: file.path,
        patchBytes: filePatchBytes,
      };
    }
  }

  return {
    binaryFileCount,
    largestFile,
    patchBytes,
    splitRowCount,
    unifiedLineCount,
  };
}
