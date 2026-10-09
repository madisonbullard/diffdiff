import { parseColor, StyledText } from "@opentui/core";
import type { TextSegment } from "../types.ts";

/** No React spans: syntax and word-diff styles go directly into the native buffer. */
export function toTextContent(segments: readonly TextSegment[]): string | StyledText {
  if (!segments.some((segment) => segment.fg != null || segment.bg != null)) {
    return segments.map((segment) => segment.text).join("");
  }
  return new StyledText(
    segments.map((segment) => ({
      __isChunk: true,
      text: segment.text,
      fg: segment.fg == null ? undefined : parseColor(segment.fg),
      bg: segment.bg == null ? undefined : parseColor(segment.bg),
    })),
  );
}
