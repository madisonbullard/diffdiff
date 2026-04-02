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
    fileCount: preparedSession.files.length,
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
    return prepareDeferredReviewSession(sortedSession, themeName, theme, syntaxPalette);
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
    renderPreparedFile(file, pierreDiffs, highlighter, themeName, resolveSegmentColor),
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
          sideBySideRows: buildPlainSideBySideRows(file.diff),
          unifiedLines: buildPlainUnifiedLines(file.diff),
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
          sideBySideRows: buildSideBySideRows(
            file.diff,
            rendered.code.deletionLines as never[],
            rendered.code.additionLines as never[],
            themeVariables,
            resolveSegmentColor,
          ),
          unifiedLines: buildUnifiedLines(
            file.diff,
            rendered.code.deletionLines as never[],
            rendered.code.additionLines as never[],
            themeVariables,
            resolveSegmentColor,
          ),
        };
      } catch (error) {
        logDiffdiffWarn("render", "deferred_diff_render_fallback", {
          error,
          path: file.path,
          themeName,
        });
        return {
          ...file,
          sideBySideRows: buildPlainSideBySideRows(file.diff),
          unifiedLines: buildPlainUnifiedLines(file.diff),
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
    const unifiedLines = buildUnifiedLines(
      file.diff,
      rendered.code.deletionLines as never[],
      rendered.code.additionLines as never[],
      themeVariables,
      resolveSegmentColor,
    );
    const sideBySideRows = buildSideBySideRows(
      file.diff,
      rendered.code.deletionLines as never[],
      rendered.code.additionLines as never[],
      themeVariables,
      resolveSegmentColor,
    );

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
