import type { FileDiffMetadata } from "@pierre/diffs";
import type { ReviewSession, StartupOptions } from "@diffdiff/core";
import {
  loadReviewSession,
  logDiffdiffError,
  logDiffdiffInfo,
  logDiffdiffWarn,
} from "@diffdiff/core";
import { createPierreSegmentColorResolver } from "../pierre-colors.ts";
import { getSyntaxPalette, type SyntaxPalette } from "../syntax-palette.ts";
import { getUiTheme, type UiTheme } from "../theme.ts";
import type { PierreThemeName, PreparedReviewFile, PreparedReviewSession } from "../types.ts";
import { sortFilesInTreeOrder } from "../view-model.ts";
import {
  buildPlainSideBySideRows,
  buildPlainUnifiedLines,
  createDeferredPreparedFile,
  getLineNumberWidth,
  parseReviewFile,
  requiresPlainDeferredPreview,
} from "./plain-preview.ts";
import { loadPierreDiffs, type PrepareReviewSessionOptions } from "./pierre-internals.ts";
import { buildSideBySideRows, buildUnifiedLines, parseThemeVariables } from "./rich-preview.ts";

export async function loadPreparedReviewSession(
  options: StartupOptions,
  themeName: PierreThemeName,
  theme: UiTheme = getUiTheme(themeName),
  syntaxPalette: SyntaxPalette = getSyntaxPalette(themeName),
  prepareOptions: PrepareReviewSessionOptions = {},
): Promise<PreparedReviewSession> {
  const startedAt = Date.now();
  logDiffdiffInfo("render", "prepared_review_session_load_started", {
    options,
    prepareOptions,
    themeName,
  });
  const session = await loadReviewSession(options);
  const preparedSession = await prepareReviewSession(
    session,
    themeName,
    theme,
    syntaxPalette,
    prepareOptions,
  );
  logDiffdiffInfo("render", "prepared_review_session_load_completed", {
    deferredSyntaxRendering: prepareOptions.deferSyntaxRendering === true,
    durationMs: Date.now() - startedAt,
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

  const pierreDiffs = await loadPierreDiffs();
  const parsedFiles = sortedSession.files.map((file) => parseReviewFile(file, pierreDiffs));
  const languages = collectLanguages(parsedFiles, pierreDiffs);
  const highlighter = await pierreDiffs.getSharedHighlighter({
    themes: [themeName],
    langs: [...languages],
  });
  const resolveSegmentColor = createPierreSegmentColorResolver(themeName, theme, syntaxPalette);

  const files = parsedFiles.map((file) =>
    renderPreparedFile(
      file,
      pierreDiffs,
      highlighter,
      themeName,
      resolveSegmentColor,
      prepareOptions.initialDiffView ?? "both",
    ),
  );

  return {
    ...sortedSession,
    files,
    themeName,
  };
}

async function prepareDeferredReviewSession(
  session: ReviewSession,
  themeName: PierreThemeName,
  theme: UiTheme,
  syntaxPalette: SyntaxPalette,
  initialDiffView: PrepareReviewSessionOptions["initialDiffView"] = "both",
): Promise<PreparedReviewSession> {
  const pierreDiffs = await loadPierreDiffs();
  const files = session.files.map((file) => createDeferredPreparedFile(file, pierreDiffs));
  const deferredPreviewFiles = files.filter(
    (file): file is PreparedReviewFile & { diff: FileDiffMetadata } =>
      file.diff != null && requiresPlainDeferredPreview(file.patch),
  );

  if (deferredPreviewFiles.length === 0) {
    return { ...session, files, themeName };
  }

  const languages = collectLanguages(deferredPreviewFiles, pierreDiffs);

  let highlighter: unknown;

  try {
    highlighter = await pierreDiffs.getSharedHighlighter({
      themes: [themeName],
      langs: [...languages],
    });
  } catch (error) {
    logDiffdiffWarn("render", "shared_highlighter_unavailable", {
      deferredSyntaxRendering: true,
      error,
      languages: [...languages],
      themeName,
    });
    return {
      ...session,
      files: files.map((file) => {
        if (file.diff == null || !requiresPlainDeferredPreview(file.patch)) {
          return file;
        }

        return {
          ...file,
          sideBySideRows:
            initialDiffView === "split" || initialDiffView === "both"
              ? buildPlainSideBySideRows(file.diff)
              : [],
          unifiedLines:
            initialDiffView === "unified" || initialDiffView === "both"
              ? buildPlainUnifiedLines(file.diff)
              : [],
        };
      }),
      themeName,
    };
  }

  const resolveSegmentColor = createPierreSegmentColorResolver(themeName, theme, syntaxPalette);

  return {
    ...session,
    files: files.map((file) => {
      if (file.diff == null || !requiresPlainDeferredPreview(file.patch)) {
        return file;
      }

      try {
        const rendered = pierreDiffs.renderDiffWithHighlighter(file.diff, highlighter, {
          theme: themeName,
          tokenizeMaxLineLength: 500,
          lineDiffType: "word",
        });
        const themeVariables = parseThemeVariables(rendered.themeStyles);

        return {
          ...file,
          sideBySideRows:
            initialDiffView === "split" || initialDiffView === "both"
              ? buildSideBySideRows(
                  file.diff,
                  rendered.code.deletionLines as never[],
                  rendered.code.additionLines as never[],
                  themeVariables,
                  resolveSegmentColor,
                )
              : [],
          unifiedLines:
            initialDiffView === "unified" || initialDiffView === "both"
              ? buildUnifiedLines(
                  file.diff,
                  rendered.code.deletionLines as never[],
                  rendered.code.additionLines as never[],
                  themeVariables,
                  resolveSegmentColor,
                )
              : [],
        };
      } catch (error) {
        logDiffdiffWarn("render", "deferred_diff_render_fallback", {
          error,
          path: file.path,
          themeName,
        });
        return {
          ...file,
          sideBySideRows:
            initialDiffView === "split" || initialDiffView === "both"
              ? buildPlainSideBySideRows(file.diff)
              : [],
          unifiedLines:
            initialDiffView === "unified" || initialDiffView === "both"
              ? buildPlainUnifiedLines(file.diff)
              : [],
        };
      }
    }),
    themeName,
  };
}

function collectLanguages(
  files: readonly (PreparedReviewFile & { diff?: FileDiffMetadata })[],
  pierreDiffs: Awaited<ReturnType<typeof loadPierreDiffs>>,
): Set<string> {
  const languages = new Set<string>();

  for (const file of files) {
    if (file.diff?.lang != null) {
      languages.add(file.diff.lang);
      continue;
    }

    const inferredLanguage = pierreDiffs.getFiletypeFromFileName(file.path);
    if (inferredLanguage != null) {
      languages.add(inferredLanguage);
    }
  }

  if (languages.size === 0) {
    languages.add("text");
  }

  return languages;
}

function renderPreparedFile(
  file: PreparedReviewFile,
  pierreDiffs: Awaited<ReturnType<typeof loadPierreDiffs>>,
  highlighter: unknown,
  themeName: PierreThemeName,
  resolveSegmentColor: ReturnType<typeof createPierreSegmentColorResolver>,
  initialDiffView: PrepareReviewSessionOptions["initialDiffView"],
): PreparedReviewFile {
  if (file.diff == null || file.isBinary) {
    return file;
  }

  try {
    const rendered = pierreDiffs.renderDiffWithHighlighter(file.diff, highlighter, {
      theme: themeName,
      tokenizeMaxLineLength: 500,
      lineDiffType: "word",
    });

    const themeVariables = parseThemeVariables(rendered.themeStyles);
    // Startup spends most of its time building diff rows. When the app opens in unified mode,
    // skipping split-row materialization cuts a large chunk of that work without losing the raw
    // patch data needed to render the alternate view later.
    const unifiedLines =
      initialDiffView === "unified" || initialDiffView === "both"
        ? buildUnifiedLines(
            file.diff,
            rendered.code.deletionLines as never[],
            rendered.code.additionLines as never[],
            themeVariables,
            resolveSegmentColor,
          )
        : [];
    const sideBySideRows =
      initialDiffView === "split" || initialDiffView === "both"
        ? buildSideBySideRows(
            file.diff,
            rendered.code.deletionLines as never[],
            rendered.code.additionLines as never[],
            themeVariables,
            resolveSegmentColor,
          )
        : [];

    return {
      ...file,
      sideBySideRows,
      unifiedLines,
      lineNumberWidth: getLineNumberWidth(file.diff),
    };
  } catch (error) {
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
