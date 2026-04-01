import type { FileDiffMetadata } from "@pierre/diffs";
import type { ChangedFile, ReviewSession, StartupOptions } from "@diffdiff/core";
import {
  loadReviewSession,
  logDiffdiffError,
  logDiffdiffInfo,
  logDiffdiffWarn,
} from "@diffdiff/core";
import { sortFilesInTreeOrder } from "./view-model.ts";
import type {
  PierreThemeName,
  PreparedReviewFile,
  PreparedReviewSession,
  SideBySideDiffCell,
  SideBySideDiffRow,
  TextSegment,
  UnifiedDiffLine,
} from "./types.ts";
import { createPierreSegmentColorResolver, type SegmentColorResolver } from "./pierre-colors.ts";
import { getSyntaxPalette, type SyntaxPalette } from "./syntax-palette.ts";
import { getUiTheme, type UiTheme } from "./theme.ts";

interface HastTextNode {
  type: "text";
  value: string;
}

interface HastElementNode {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

type HastNode = HastTextNode | HastElementNode;

interface SegmentStyle {
  fg?: string;
  bg?: string;
}

export interface PrepareReviewSessionOptions {
  // Use raw patches during launch so startup can skip expensive syntax preparation work.
  deferSyntaxRendering?: boolean;
}

interface PierreDiffsModule {
  getFiletypeFromFileName(path: string): string | undefined;
  getSharedHighlighter(options: { themes: string[]; langs: string[] }): Promise<unknown>;
  parsePatchFiles(patch: string): Array<{ files?: FileDiffMetadata[] }>;
  renderDiffWithHighlighter(
    diff: FileDiffMetadata,
    highlighter: unknown,
    options: {
      theme: string;
      tokenizeMaxLineLength: number;
      lineDiffType: "word";
    },
  ): {
    themeStyles: string;
    code: {
      deletionLines: unknown[];
      additionLines: unknown[];
    };
  };
}

let pierreDiffsPromise: Promise<PierreDiffsModule> | undefined;

async function loadPierreDiffs(): Promise<PierreDiffsModule> {
  // Load Pierre lazily so the fast startup path can avoid pulling in Shiki language bundles before
  // the first screen is visible.
  pierreDiffsPromise ??= import("@pierre/diffs") as Promise<PierreDiffsModule>;
  return pierreDiffsPromise;
}

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
  // Sort files so the diff pane order matches the file tree sidebar (directories first,
  // alphabetical at each level).
  const sortedSession = { ...session, files: sortFilesInTreeOrder(session.files) };

  // Startup is noticeably faster when we skip eager syntax tokenization, but we still parse the
  // patch structure so the first screen can render stable diff rows without relying on the fallback
  // widget's parser.
  if (prepareOptions.deferSyntaxRendering) {
    const pierreDiffs = await loadPierreDiffs();
    const files = sortedSession.files.map((file) => createDeferredPreparedFile(file, pierreDiffs));
    const deferredPreviewFiles = files.filter(
      (file): file is PreparedReviewFile & { diff: FileDiffMetadata } =>
        file.diff != null && requiresPlainDeferredPreview(file.patch),
    );

    if (deferredPreviewFiles.length === 0) {
      return {
        ...sortedSession,
        files,
        themeName,
      };
    }

    const languages = new Set<string>();

    for (const file of deferredPreviewFiles) {
      if (file.diff.lang != null) {
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
        ...sortedSession,
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
      ...sortedSession,
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
              rendered.code.deletionLines as HastNode[],
              rendered.code.additionLines as HastNode[],
              themeVariables,
              resolveSegmentColor,
            ),
            unifiedLines: buildUnifiedLines(
              file.diff,
              rendered.code.deletionLines as HastNode[],
              rendered.code.additionLines as HastNode[],
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

  const pierreDiffs = await loadPierreDiffs();
  const parsedFiles = sortedSession.files.map((file) => parseReviewFile(file, pierreDiffs));

  const languages = new Set<string>();

  for (const parsedFile of parsedFiles) {
    if (parsedFile.diff?.lang != null) {
      languages.add(parsedFile.diff.lang);
      continue;
    }

    const inferredLanguage = pierreDiffs.getFiletypeFromFileName(parsedFile.path);
    if (inferredLanguage != null) {
      languages.add(inferredLanguage);
    }
  }

  if (languages.size === 0) {
    languages.add("text");
  }

  const highlighter = await pierreDiffs.getSharedHighlighter({
    themes: [themeName],
    langs: [...languages],
  });
  const resolveSegmentColor = createPierreSegmentColorResolver(themeName, theme, syntaxPalette);

  const files = parsedFiles.map((file) => {
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
        rendered.code.deletionLines as HastNode[],
        rendered.code.additionLines as HastNode[],
        themeVariables,
        resolveSegmentColor,
      );
      const sideBySideRows = buildSideBySideRows(
        file.diff,
        rendered.code.deletionLines as HastNode[],
        rendered.code.additionLines as HastNode[],
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
  });

  return {
    ...sortedSession,
    files,
    themeName,
  };
}

function createDeferredPreparedFile(
  file: ChangedFile,
  pierreDiffs: PierreDiffsModule,
): PreparedReviewFile {
  if (file.isBinary) {
    return {
      ...file,
      diff: undefined,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: 3,
    };
  }

  try {
    const diff = pierreDiffs.parsePatchFiles(file.patch)[0]?.files?.[0];

    return {
      ...file,
      diff,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: diff == null ? 3 : getLineNumberWidth(diff),
      renderError: undefined,
    };
  } catch (error) {
    logDiffdiffWarn("render", "deferred_diff_parse_failed", {
      error,
      path: file.path,
    });
    return {
      ...file,
      diff: undefined,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: 3,
      renderError: undefined,
    };
  }
}

function parseReviewFile(file: ChangedFile, pierreDiffs: PierreDiffsModule): PreparedReviewFile {
  if (file.isBinary) {
    return {
      ...file,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: 3,
    };
  }

  try {
    const diff = pierreDiffs.parsePatchFiles(file.patch)[0]?.files?.[0];

    if (diff == null) {
      logDiffdiffWarn("render", "diff_parse_returned_null", {
        path: file.path,
      });
    }

    return {
      ...file,
      diff,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: diff == null ? 3 : getLineNumberWidth(diff),
      renderError: diff == null ? "Unable to parse the git patch for this file." : undefined,
    };
  } catch (error) {
    logDiffdiffError("render", "diff_parse_failed", error, {
      path: file.path,
    });
    return {
      ...file,
      sideBySideRows: [],
      unifiedLines: [],
      lineNumberWidth: 3,
      renderError: error instanceof Error ? error.message : "Unable to parse this diff.",
    };
  }
}

function getLineNumberWidth(diff: FileDiffMetadata): number {
  const highestLineNumber = Math.max(
    ...diff.hunks.flatMap((hunk) => [
      hunk.additionStart + hunk.additionCount,
      hunk.deletionStart + hunk.deletionCount,
    ]),
    0,
  );

  return Math.max(String(highestLineNumber).length, 3);
}

function buildPlainUnifiedLines(diff: FileDiffMetadata): UnifiedDiffLine[] {
  const lines: UnifiedDiffLine[] = [];
  let deletionIndex = 0;
  let additionIndex = 0;

  for (let hunkIndex = 0; hunkIndex < diff.hunks.length; hunkIndex += 1) {
    const hunk = diff.hunks[hunkIndex];

    if (hunk.collapsedBefore > 0 && hunkIndex > 0) {
      lines.push({
        kind: "gap",
        segments: [{ text: `... ${hunk.collapsedBefore} unchanged lines ...` }],
      });
    }

    const hunkHeader = sanitizePlainText(
      [hunk.hunkSpecs, hunk.hunkContext].filter(Boolean).join(" "),
    );
    lines.push({
      kind: "hunk",
      segments: [{ text: hunkHeader || "@@" }],
    });

    let oldLineNumber = hunk.deletionStart;
    let newLineNumber = hunk.additionStart;

    for (const hunkContent of hunk.hunkContent) {
      if (hunkContent.type === "context") {
        for (let index = 0; index < hunkContent.lines; index += 1) {
          lines.push({
            kind: "context",
            oldLineNumber,
            newLineNumber,
            segments: toPlainSegments(diff.additionLines[additionIndex]),
          });
          oldLineNumber += 1;
          newLineNumber += 1;
          deletionIndex += 1;
          additionIndex += 1;
        }

        continue;
      }

      for (let index = 0; index < hunkContent.deletions; index += 1) {
        lines.push({
          kind: "deletion",
          oldLineNumber,
          segments: toPlainSegments(diff.deletionLines[deletionIndex]),
        });
        oldLineNumber += 1;
        deletionIndex += 1;
      }

      for (let index = 0; index < hunkContent.additions; index += 1) {
        lines.push({
          kind: "addition",
          newLineNumber,
          segments: toPlainSegments(diff.additionLines[additionIndex]),
        });
        newLineNumber += 1;
        additionIndex += 1;
      }
    }
  }

  return lines;
}

function buildPlainSideBySideRows(diff: FileDiffMetadata): SideBySideDiffRow[] {
  const rows: SideBySideDiffRow[] = [];
  let deletionIndex = 0;
  let additionIndex = 0;

  for (let hunkIndex = 0; hunkIndex < diff.hunks.length; hunkIndex += 1) {
    const hunk = diff.hunks[hunkIndex];

    if (hunk.collapsedBefore > 0 && hunkIndex > 0) {
      rows.push({
        kind: "gap",
        segments: [{ text: `... ${hunk.collapsedBefore} unchanged lines ...` }],
      });
    }

    const hunkHeader = sanitizePlainText(
      [hunk.hunkSpecs, hunk.hunkContext].filter(Boolean).join(" "),
    );
    rows.push({
      kind: "hunk",
      segments: [{ text: hunkHeader || "@@" }],
    });

    let oldLineNumber = hunk.deletionStart;
    let newLineNumber = hunk.additionStart;

    for (const hunkContent of hunk.hunkContent) {
      if (hunkContent.type === "context") {
        for (let index = 0; index < hunkContent.lines; index += 1) {
          rows.push({
            kind: "line",
            left: {
              kind: "context",
              lineNumber: oldLineNumber,
              segments: toPlainSegments(diff.deletionLines[deletionIndex]),
            },
            right: {
              kind: "context",
              lineNumber: newLineNumber,
              segments: toPlainSegments(diff.additionLines[additionIndex]),
            },
          });

          oldLineNumber += 1;
          newLineNumber += 1;
          deletionIndex += 1;
          additionIndex += 1;
        }

        continue;
      }

      const deletions: SideBySideDiffCell[] = [];
      const additions: SideBySideDiffCell[] = [];

      for (let index = 0; index < hunkContent.deletions; index += 1) {
        deletions.push({
          kind: "deletion",
          lineNumber: oldLineNumber,
          segments: toPlainSegments(diff.deletionLines[deletionIndex]),
        });
        oldLineNumber += 1;
        deletionIndex += 1;
      }

      for (let index = 0; index < hunkContent.additions; index += 1) {
        additions.push({
          kind: "addition",
          lineNumber: newLineNumber,
          segments: toPlainSegments(diff.additionLines[additionIndex]),
        });
        newLineNumber += 1;
        additionIndex += 1;
      }

      const pairCount = Math.max(deletions.length, additions.length);

      for (let index = 0; index < pairCount; index += 1) {
        rows.push({
          kind: "line",
          left: deletions[index] ?? { kind: "empty", segments: [] },
          right: additions[index] ?? { kind: "empty", segments: [] },
        });
      }
    }
  }

  return rows;
}

function toPlainSegments(line: string | undefined): TextSegment[] {
  if (line == null) {
    return [];
  }

  const text = sanitizePlainText(line);
  return text === "" ? [] : [{ text }];
}

function sanitizePlainText(text: string): string {
  return text.replace(/\r?\n$/u, "");
}

function requiresPlainDeferredPreview(patch: string): boolean {
  return patch.split(/\r?\n/u).some((line) => line === "+" || line === "-" || line === " ");
}

function buildUnifiedLines(
  diff: FileDiffMetadata,
  deletionLines: readonly HastNode[],
  additionLines: readonly HastNode[],
  themeVariables: ReadonlyMap<string, string>,
  resolveSegmentColor: SegmentColorResolver,
): UnifiedDiffLine[] {
  const lines: UnifiedDiffLine[] = [];
  let deletionIndex = 0;
  let additionIndex = 0;

  for (let hunkIndex = 0; hunkIndex < diff.hunks.length; hunkIndex += 1) {
    const hunk = diff.hunks[hunkIndex];

    if (hunk.collapsedBefore > 0 && hunkIndex > 0) {
      lines.push({
        kind: "gap",
        segments: [{ text: `... ${hunk.collapsedBefore} unchanged lines ...` }],
      });
    }

    const hunkHeader = [hunk.hunkSpecs, hunk.hunkContext].filter(Boolean).join(" ");
    lines.push({
      kind: "hunk",
      segments: [{ text: hunkHeader || "@@" }],
    });

    let oldLineNumber = hunk.deletionStart;
    let newLineNumber = hunk.additionStart;

    for (const hunkContent of hunk.hunkContent) {
      if (hunkContent.type === "context") {
        for (let index = 0; index < hunkContent.lines; index += 1) {
          lines.push({
            kind: "context",
            oldLineNumber,
            newLineNumber,
            segments: collectSegments(
              additionLines[additionIndex],
              themeVariables,
              resolveSegmentColor,
            ),
          });
          oldLineNumber += 1;
          newLineNumber += 1;
          deletionIndex += 1;
          additionIndex += 1;
        }
        continue;
      }

      for (let index = 0; index < hunkContent.deletions; index += 1) {
        lines.push({
          kind: "deletion",
          oldLineNumber,
          segments: collectSegments(
            deletionLines[deletionIndex],
            themeVariables,
            resolveSegmentColor,
          ),
        });
        oldLineNumber += 1;
        deletionIndex += 1;
      }

      for (let index = 0; index < hunkContent.additions; index += 1) {
        lines.push({
          kind: "addition",
          newLineNumber,
          segments: collectSegments(
            additionLines[additionIndex],
            themeVariables,
            resolveSegmentColor,
          ),
        });
        newLineNumber += 1;
        additionIndex += 1;
      }
    }
  }

  return lines;
}

function buildSideBySideRows(
  diff: FileDiffMetadata,
  deletionLines: readonly HastNode[],
  additionLines: readonly HastNode[],
  themeVariables: ReadonlyMap<string, string>,
  resolveSegmentColor: SegmentColorResolver,
): SideBySideDiffRow[] {
  const rows: SideBySideDiffRow[] = [];
  let deletionIndex = 0;
  let additionIndex = 0;

  for (let hunkIndex = 0; hunkIndex < diff.hunks.length; hunkIndex += 1) {
    const hunk = diff.hunks[hunkIndex];

    if (hunk.collapsedBefore > 0 && hunkIndex > 0) {
      rows.push({
        kind: "gap",
        segments: [{ text: `... ${hunk.collapsedBefore} unchanged lines ...` }],
      });
    }

    const hunkHeader = [hunk.hunkSpecs, hunk.hunkContext].filter(Boolean).join(" ");
    rows.push({
      kind: "hunk",
      segments: [{ text: hunkHeader || "@@" }],
    });

    let oldLineNumber = hunk.deletionStart;
    let newLineNumber = hunk.additionStart;

    for (const hunkContent of hunk.hunkContent) {
      if (hunkContent.type === "context") {
        for (let index = 0; index < hunkContent.lines; index += 1) {
          const leftSegments = collectSegments(
            deletionLines[deletionIndex],
            themeVariables,
            resolveSegmentColor,
          );
          const rightSegments = collectSegments(
            additionLines[additionIndex],
            themeVariables,
            resolveSegmentColor,
          );

          rows.push({
            kind: "line",
            left: {
              kind: "context",
              lineNumber: oldLineNumber,
              segments: leftSegments,
            },
            right: {
              kind: "context",
              lineNumber: newLineNumber,
              segments: rightSegments,
            },
          });

          oldLineNumber += 1;
          newLineNumber += 1;
          deletionIndex += 1;
          additionIndex += 1;
        }

        continue;
      }

      const deletions: SideBySideDiffCell[] = [];
      const additions: SideBySideDiffCell[] = [];

      for (let index = 0; index < hunkContent.deletions; index += 1) {
        deletions.push({
          kind: "deletion",
          lineNumber: oldLineNumber,
          segments: collectSegments(
            deletionLines[deletionIndex],
            themeVariables,
            resolveSegmentColor,
          ),
        });
        oldLineNumber += 1;
        deletionIndex += 1;
      }

      for (let index = 0; index < hunkContent.additions; index += 1) {
        additions.push({
          kind: "addition",
          lineNumber: newLineNumber,
          segments: collectSegments(
            additionLines[additionIndex],
            themeVariables,
            resolveSegmentColor,
          ),
        });
        newLineNumber += 1;
        additionIndex += 1;
      }

      const pairCount = Math.max(deletions.length, additions.length);

      for (let index = 0; index < pairCount; index += 1) {
        rows.push({
          kind: "line",
          left: deletions[index] ?? { kind: "empty", segments: [] },
          right: additions[index] ?? { kind: "empty", segments: [] },
        });
      }
    }
  }

  return rows;
}

function collectSegments(
  node: HastNode | undefined,
  themeVariables: ReadonlyMap<string, string>,
  resolveSegmentColor: SegmentColorResolver,
): TextSegment[] {
  if (node == null) {
    return [];
  }

  const segments: TextSegment[] = [];
  visitNode(node, themeVariables, resolveSegmentColor, {}, segments);
  return compactSegments(segments);
}

function visitNode(
  node: HastNode,
  themeVariables: ReadonlyMap<string, string>,
  resolveSegmentColor: SegmentColorResolver,
  inheritedStyle: SegmentStyle,
  output: TextSegment[],
): void {
  if (node.type === "text") {
    const text = node.value.replace(/\n$/u, "");
    if (text === "") {
      return;
    }

    output.push({
      text,
      ...inheritedStyle,
    });
    return;
  }

  const mergedStyle = {
    ...inheritedStyle,
    ...parseStyle(node.properties?.style, themeVariables, resolveSegmentColor),
  };

  for (const child of node.children ?? []) {
    visitNode(child, themeVariables, resolveSegmentColor, mergedStyle, output);
  }
}

function parseStyle(
  style: unknown,
  themeVariables: ReadonlyMap<string, string>,
  resolveSegmentColor: SegmentColorResolver,
): SegmentStyle {
  if (style == null) {
    return {};
  }

  const css: Record<string, string> = {};

  if (typeof style === "string") {
    for (const declaration of style.split(";")) {
      const [property, value] = declaration.split(":");
      if (property == null || value == null) {
        continue;
      }

      css[property.trim()] = value.trim();
    }
  } else if (typeof style === "object") {
    for (const [property, value] of Object.entries(style as Record<string, unknown>)) {
      if (typeof value === "string") {
        css[property] = value;
      }
    }
  }

  return {
    fg: resolveSegmentColor(resolveCssValue(css.color, themeVariables)),
    bg: resolveCssValue(css["background-color"], themeVariables),
  };
}

function resolveCssValue(
  value: string | undefined,
  themeVariables: ReadonlyMap<string, string>,
): string | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  const variableMatch = /^var\((--[^)]+)\)$/u.exec(value);
  if (variableMatch != null) {
    return themeVariables.get(variableMatch[1]) ?? undefined;
  }

  return value;
}

function parseThemeVariables(themeStyles: string): Map<string, string> {
  const variables = new Map<string, string>();
  const variablePattern = /(--[\w-]+):\s*([^;]+);/gu;

  for (const match of themeStyles.matchAll(variablePattern)) {
    variables.set(match[1], match[2].trim());
  }

  return variables;
}

function compactSegments(segments: readonly TextSegment[]): TextSegment[] {
  const compacted: TextSegment[] = [];

  for (const segment of segments) {
    const previous = compacted.at(-1);
    if (previous != null && previous.fg === segment.fg && previous.bg === segment.bg) {
      previous.text += segment.text;
      continue;
    }

    compacted.push({ ...segment });
  }

  return compacted;
}
