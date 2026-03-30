import {
  getFiletypeFromFileName,
  getSharedHighlighter,
  parsePatchFiles,
  renderDiffWithHighlighter,
} from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs";
import type { ChangedFile, ReviewSession, StartupOptions } from "@diffdiff/core";
import { loadReviewSession } from "@diffdiff/core";
import type {
  PierreThemeName,
  PreparedReviewFile,
  PreparedReviewSession,
  TextSegment,
  UnifiedDiffLine,
} from "./types.ts";

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

export async function loadPreparedReviewSession(
  options: StartupOptions,
  themeName: PierreThemeName,
): Promise<PreparedReviewSession> {
  const session = await loadReviewSession(options);
  return prepareReviewSession(session, themeName);
}

export async function prepareReviewSession(
  session: ReviewSession,
  themeName: PierreThemeName,
): Promise<PreparedReviewSession> {
  const parsedFiles = session.files.map((file) => parseReviewFile(file));
  const languages = new Set<string>();

  for (const parsedFile of parsedFiles) {
    if (parsedFile.diff?.lang != null) {
      languages.add(parsedFile.diff.lang);
      continue;
    }

    const inferredLanguage = getFiletypeFromFileName(parsedFile.path);
    if (inferredLanguage != null) {
      languages.add(inferredLanguage);
    }
  }

  if (languages.size === 0) {
    languages.add("text");
  }

  const highlighter = await getSharedHighlighter({
    themes: [themeName],
    langs: [...languages],
  });

  const files = parsedFiles.map((file) => {
    if (file.diff == null || file.isBinary) {
      return file;
    }

    try {
      const rendered = renderDiffWithHighlighter(file.diff, highlighter, {
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
      );

      return {
        ...file,
        unifiedLines,
        lineNumberWidth: getLineNumberWidth(file.diff),
      };
    } catch (error) {
      return {
        ...file,
        renderError: error instanceof Error ? error.message : "Unable to render diff.",
      };
    }
  });

  return {
    ...session,
    files,
    themeName,
  };
}

function parseReviewFile(file: ChangedFile): PreparedReviewFile {
  if (file.isBinary) {
    return {
      ...file,
      unifiedLines: [],
      lineNumberWidth: 3,
    };
  }

  try {
    const diff = parsePatchFiles(file.patch)[0]?.files[0];

    return {
      ...file,
      diff,
      unifiedLines: [],
      lineNumberWidth: diff == null ? 3 : getLineNumberWidth(diff),
      renderError: diff == null ? "Unable to parse the git patch for this file." : undefined,
    };
  } catch (error) {
    return {
      ...file,
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

function buildUnifiedLines(
  diff: FileDiffMetadata,
  deletionLines: readonly HastNode[],
  additionLines: readonly HastNode[],
  themeVariables: ReadonlyMap<string, string>,
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
            segments: collectSegments(additionLines[additionIndex], themeVariables),
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
          segments: collectSegments(deletionLines[deletionIndex], themeVariables),
        });
        oldLineNumber += 1;
        deletionIndex += 1;
      }

      for (let index = 0; index < hunkContent.additions; index += 1) {
        lines.push({
          kind: "addition",
          newLineNumber,
          segments: collectSegments(additionLines[additionIndex], themeVariables),
        });
        newLineNumber += 1;
        additionIndex += 1;
      }
    }
  }

  return lines;
}

function collectSegments(
  node: HastNode | undefined,
  themeVariables: ReadonlyMap<string, string>,
): TextSegment[] {
  if (node == null) {
    return [];
  }

  const segments: TextSegment[] = [];
  visitNode(node, themeVariables, {}, segments);
  return compactSegments(segments);
}

function visitNode(
  node: HastNode,
  themeVariables: ReadonlyMap<string, string>,
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
    ...parseStyle(node.properties?.style, themeVariables),
  };

  for (const child of node.children ?? []) {
    visitNode(child, themeVariables, mergedStyle, output);
  }
}

function parseStyle(style: unknown, themeVariables: ReadonlyMap<string, string>): SegmentStyle {
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
    fg: resolveCssValue(css.color, themeVariables),
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
