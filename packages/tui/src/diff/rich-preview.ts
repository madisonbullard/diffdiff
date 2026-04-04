import type { FileDiffMetadata } from "@pierre/diffs";
import type {
  SideBySideDiffCell,
  SideBySideDiffRow,
  TextSegment,
  UnifiedDiffLine,
} from "../types.ts";
import type { SegmentColorResolver } from "../pierre-colors.ts";
import type { HastNode, SegmentStyle } from "./pierre-internals.ts";
import { shouldHideLeadingHunkHeader } from "./hunk-header-visibility.ts";

export function buildUnifiedLines(
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

    if (!shouldHideLeadingHunkHeader(hunkIndex, hunk)) {
      const hunkHeader = [hunk.hunkSpecs, hunk.hunkContext].filter(Boolean).join(" ");
      lines.push({ kind: "hunk", segments: [{ text: hunkHeader || "@@" }] });
    }

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

export function buildSideBySideRows(
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

    if (!shouldHideLeadingHunkHeader(hunkIndex, hunk)) {
      const hunkHeader = [hunk.hunkSpecs, hunk.hunkContext].filter(Boolean).join(" ");
      rows.push({ kind: "hunk", segments: [{ text: hunkHeader || "@@" }] });
    }

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
              segments: collectSegments(
                deletionLines[deletionIndex],
                themeVariables,
                resolveSegmentColor,
              ),
            },
            right: {
              kind: "context",
              lineNumber: newLineNumber,
              segments: collectSegments(
                additionLines[additionIndex],
                themeVariables,
                resolveSegmentColor,
              ),
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

export function parseThemeVariables(themeStyles: string): Map<string, string> {
  const variables = new Map<string, string>();
  const variablePattern = /(--[\w-]+):\s*([^;]+);/gu;

  for (const match of themeStyles.matchAll(variablePattern)) {
    variables.set(match[1], match[2].trim());
  }

  return variables;
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

    output.push({ text, ...inheritedStyle });
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
