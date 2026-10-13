import type {
  LineColorConfig,
  LineNumberRenderable,
  LineSign,
  TextRenderable,
} from "@opentui/core";
import { memo, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { Ref } from "react";
import type { SelectedReviewAnchor } from "../review-anchors.ts";
import type { UiTheme } from "../theme.ts";
import type { TextSegment } from "../types.ts";
import type { DiffLineTarget } from "../app/layout/diff-scroll.ts";
import type { ChunkLine, DiffChunk } from "./diff-chunks.ts";
import { tintHex } from "./shared.tsx";
import { toTextContent } from "../diff/styled-text.ts";

type LinesChunk = Extract<DiffChunk, { kind: "lines" }>;

export const NativeDiffChunk = memo(function NativeDiffChunk({
  chunk,
  split,
  lineNumberWidth,
  anchor,
  selectedDiffRowRef,
  theme,
}: {
  chunk: LinesChunk;
  split: boolean;
  lineNumberWidth: number;
  anchor?: SelectedReviewAnchor;
  selectedDiffRowRef?: Ref<DiffLineTarget>;
  theme: UiTheme;
}) {
  return split ? (
    <box width="100%" flexDirection="row">
      <BufferSide
        lines={chunk.lines}
        side="left"
        width="50%"
        lineNumberWidth={lineNumberWidth}
        anchor={anchor}
        selectedDiffRowRef={selectedDiffRowRef}
        theme={theme}
      />
      <BufferSide
        lines={chunk.lines}
        side="right"
        width="50%"
        lineNumberWidth={lineNumberWidth}
        anchor={anchor}
        selectedDiffRowRef={selectedDiffRowRef}
        theme={theme}
      />
    </box>
  ) : (
    <BufferSide
      lines={chunk.lines}
      side="unified"
      width="100%"
      lineNumberWidth={lineNumberWidth}
      anchor={anchor}
      selectedDiffRowRef={selectedDiffRowRef}
      theme={theme}
    />
  );
});

function BufferSide({
  lines,
  side,
  width,
  lineNumberWidth,
  anchor,
  selectedDiffRowRef,
  theme,
}: {
  lines: readonly ChunkLine[];
  side: "left" | "right" | "unified";
  width: "50%" | "100%";
  lineNumberWidth: number;
  anchor?: SelectedReviewAnchor;
  selectedDiffRowRef?: Ref<DiffLineTarget>;
  theme: UiTheme;
}) {
  const gutterRef = useRef<LineNumberRenderable | null>(null);
  const data = useMemo(() => {
    const segments: TextSegment[] = [];
    const lineNumbers = new Map<number, number>();
    const hideLineNumbers = new Set<number>();
    const lineSigns = new Map<number, LineSign>();
    const lineColors = new Map<number, LineColorConfig>();
    let selectedLine = -1;
    lines.forEach((row, index) => {
      const cell = side === "unified" ? row.unified : row[side];
      const kind = cell?.kind ?? "empty";
      const number =
        side === "unified"
          ? (row.unified?.newLineNumber ?? row.unified?.oldLineNumber)
          : row[side]?.lineNumber;
      if (number != null) lineNumbers.set(index, number);
      else hideLineNumbers.add(index);
      const selected =
        anchor != null &&
        (side === "unified"
          ? (anchor.side === "LEFT" ? row.unified?.oldLineNumber : row.unified?.newLineNumber) ===
            anchor.line
          : (anchor.side === "LEFT" ? side === "left" : side === "right") &&
            number === anchor.line);
      if (selected) selectedLine = index;
      const annotations = row.annotations[side === "right" ? "right" : "left"];
      const annotationColor =
        annotations.length === 0
          ? undefined
          : annotations.some(({ thread }) => !thread.isOutdated)
            ? theme.success
            : theme.warning;
      const gutter =
        kind === "addition"
          ? theme.additionLineNumberBg
          : kind === "deletion"
            ? theme.deletionLineNumberBg
            : theme.contextBg;
      const content =
        kind === "addition"
          ? theme.additionBg
          : kind === "deletion"
            ? theme.deletionBg
            : theme.contextBg;
      const annotatedGutter =
        annotations.length > 0 ? tintHex(gutter, theme.commentAnnotation, 0.1) : gutter;
      const annotatedContent =
        annotations.length > 0 ? tintHex(content, theme.commentAnnotation, 0.07) : content;
      lineColors.set(index, {
        gutter: selected ? tintHex(annotatedGutter, theme.accent, 0.24) : annotatedGutter,
        content: selected ? tintHex(annotatedContent, theme.accent, 0.18) : annotatedContent,
      });
      lineSigns.set(index, {
        // Reserve both cells even when inactive, so selection never changes wrapping.
        before: `${selected ? "▶" : " "}${annotationColor == null ? " " : "┃"}`,
        beforeColor: selected ? theme.accent : annotationColor,
        after: kind === "addition" ? " +" : kind === "deletion" ? " -" : "  ",
        afterColor:
          kind === "addition"
            ? theme.success
            : kind === "deletion"
              ? theme.danger
              : theme.textMuted,
      });
      if (index > 0) segments.push({ text: "\n" });
      for (const segment of cell?.segments ?? []) {
        segments.push(
          segment.isWordChange && segment.bg == null
            ? {
                ...segment,
                bg: tintHex(content, kind === "deletion" ? theme.danger : theme.success, 0.25),
              }
            : segment,
        );
      }
    });
    return {
      content: toTextContent(segments),
      lineNumbers,
      hideLineNumbers,
      lineSigns,
      lineColors,
      selectedLine,
    };
  }, [lines, side, anchor, theme]);
  useLayoutEffect(() => {
    // OpenTUI 0.1.92 exposes methods, not property setters, for these maps.
    // JSX props initialize them, but subsequent React prop assignments do not
    // update the native gutter or repaint the selected line.
    const gutter = gutterRef.current;
    if (gutter == null) return;
    gutter.setLineColors(data.lineColors);
    gutter.setLineSigns(data.lineSigns);
    gutter.setLineNumbers(data.lineNumbers);
    gutter.setHideLineNumbers(data.hideLineNumbers);
    gutter.requestRender();
  }, [data]);
  const register = useCallback(
    (node: TextRenderable | null) => {
      if (data.selectedLine < 0 || selectedDiffRowRef == null) return;
      const target = node == null ? null : { node, line: data.selectedLine };
      if (typeof selectedDiffRowRef === "function") selectedDiffRowRef(target);
      else selectedDiffRowRef.current = target;
    },
    [data.selectedLine, selectedDiffRowRef],
  );
  // A single text buffer owns wrapping/selection. Plain text avoids a span per
  // logical line; highlighted segments are applied without changing its text.
  return (
    <line-number
      ref={gutterRef}
      width={width}
      minWidth={lineNumberWidth + 2}
      paddingRight={1}
      fg={theme.textMuted}
      lineNumbers={data.lineNumbers}
      hideLineNumbers={data.hideLineNumbers}
      lineSigns={data.lineSigns}
      lineColors={data.lineColors}
    >
      <text
        ref={register}
        width="100%"
        flexShrink={1}
        flexGrow={1}
        fg={theme.text}
        wrapMode={side === "unified" ? "word" : "none"}
        content={data.content}
      />
    </line-number>
  );
}
