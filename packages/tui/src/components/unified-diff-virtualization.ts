import type { PreparedReviewFile, TextSegment, UnifiedDiffLine } from "../types.ts";

export interface PreviewViewport {
  bottom: number;
  overscan: number;
  top: number;
}

export function shouldVirtualizeUnifiedPreview({
  hasSelectedReviewAnchor,
  previewViewport,
  reviewThreadCount,
}: {
  hasSelectedReviewAnchor: boolean;
  previewViewport?: PreviewViewport;
  reviewThreadCount: number;
}) {
  return previewViewport != null && reviewThreadCount === 0 && !hasSelectedReviewAnchor;
}

export function getUnifiedVirtualWindow({
  file,
  previewViewport,
  terminalWidth,
}: {
  file: PreparedReviewFile;
  previewViewport: PreviewViewport;
  terminalWidth: number;
}) {
  if (file.unifiedLines.length === 0) {
    return undefined;
  }

  const contentWidth = Math.max(terminalWidth - file.lineNumberWidth - 8, 12);
  const fullWidth = Math.max(terminalWidth - 4, contentWidth);
  const lineHeights = file.unifiedLines.map((line) =>
    estimateUnifiedLineHeight({
      contentWidth,
      fullWidth,
      line,
      lineNumberWidth: file.lineNumberWidth,
    }),
  );
  const offsets = [0];

  for (const height of lineHeights) {
    offsets.push(offsets[offsets.length - 1] + height);
  }

  const totalHeight = offsets[offsets.length - 1] ?? 0;
  if (totalHeight === 0) {
    return undefined;
  }

  const rawWindowTop = previewViewport.top - previewViewport.overscan;
  const rawWindowBottom = previewViewport.bottom + previewViewport.overscan;

  if (rawWindowBottom <= 0 || rawWindowTop >= totalHeight) {
    return {
      bottomSpacerHeight: totalHeight,
      endIndex: -1,
      startIndex: 0,
      topSpacerHeight: 0,
    };
  }

  const windowTop = Math.max(rawWindowTop, 0);
  const windowBottom = Math.max(rawWindowBottom, windowTop + 1);

  let startIndex = 0;
  while (startIndex < lineHeights.length && offsets[startIndex + 1] <= windowTop) {
    startIndex += 1;
  }

  let endIndex = startIndex;
  while (endIndex < lineHeights.length && offsets[endIndex] < windowBottom) {
    endIndex += 1;
  }

  endIndex = Math.max(startIndex, Math.min(endIndex - 1, lineHeights.length - 1));

  return {
    bottomSpacerHeight: totalHeight - offsets[endIndex + 1],
    endIndex,
    startIndex,
    topSpacerHeight: offsets[startIndex],
  };
}

function estimateUnifiedLineHeight({
  contentWidth,
  fullWidth,
  line,
  lineNumberWidth,
}: {
  contentWidth: number;
  fullWidth: number;
  line: UnifiedDiffLine;
  lineNumberWidth: number;
}) {
  const text = getSegmentsText(line.segments);

  if (line.kind === "hunk" || line.kind === "gap") {
    return estimateWrappedLineCount(`${" ".repeat(lineNumberWidth + 3)}${text}`, fullWidth);
  }

  return estimateWrappedLineCount(text, contentWidth);
}

function estimateWrappedLineCount(text: string, width: number) {
  if (width <= 0 || text.length === 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(text.length / width));
}

function getSegmentsText(segments: readonly TextSegment[]) {
  let text = "";
  for (const segment of segments) {
    text += segment.text;
  }
  return text;
}
