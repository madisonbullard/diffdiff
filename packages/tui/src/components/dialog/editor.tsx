import { useLayoutEffect, useRef } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { TextInputSurface } from "../../text-input-surface.ts";
import type { UiTheme } from "../../theme.ts";
import { TextInputContent } from "../text-input-content.tsx";
import { dialogTokens } from "./tokens.ts";
import { cellWidth } from "./text.ts";
export function DialogEditor({
  surface,
  height,
  width,
  theme,
  focused = true,
  paused = false,
  placeholder,
  onFocus,
}: {
  surface: TextInputSurface;
  height: number;
  width: number;
  theme: UiTheme;
  focused?: boolean;
  paused?: boolean;
  placeholder?: string;
  onFocus?: () => void;
}) {
  const scroll = useRef<ScrollBoxRenderable | null>(null);
  useLayoutEffect(() => {
    const before = surface.value.slice(0, surface.cursorOffset);
    const row =
      before
        .split("\n")
        .reduce(
          (sum, line) => sum + Math.max(1, Math.ceil((cellWidth(line) + 1) / Math.max(1, width))),
          0,
        ) - 1;
    if (scroll.current && focused) {
      const top = scroll.current.scrollTop;
      if (row < top) scroll.current.scrollTo(row);
      else if (row >= top + height) scroll.current.scrollTo(row - height + 1);
    }
  }, [surface.value, surface.cursorOffset, height, width, focused]);
  return (
    <box
      height={Math.max(1, height)}
      flexShrink={0}
      backgroundColor={dialogTokens(theme).raised}
      onMouseUp={onFocus}
    >
      <scrollbox ref={scroll} width="100%" height="100%" scrollY scrollX={false}>
        <text fg={paused ? theme.textMuted : theme.text} wrapMode="word">
          <TextInputContent
            surface={surface}
            showCursor={focused && !paused}
            cursorColor={theme.accent}
            cursorTextColor={theme.inverseText}
            placeholder={placeholder}
            placeholderColor={theme.textMuted}
          />
        </text>
      </scrollbox>
    </box>
  );
}
