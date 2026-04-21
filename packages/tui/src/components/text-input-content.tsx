import { Fragment } from "react";
import type { TextInputSurface } from "../text-input-surface.ts";

export function TextInputContent({
  cursorColor,
  placeholder,
  placeholderColor,
  showCursor = true,
  surface,
}: {
  cursorColor: string;
  placeholder?: string;
  placeholderColor?: string;
  showCursor?: boolean;
  surface: TextInputSurface;
}) {
  const { cursorOffset, value } = surface;

  if (value === "") {
    if (!showCursor && placeholder != null) {
      return placeholder;
    }

    return (
      <Fragment>
        {showCursor ? <span fg={cursorColor}>_</span> : null}
        {placeholder != null ? <span fg={placeholderColor}>{placeholder}</span> : null}
      </Fragment>
    );
  }

  const clampedOffset = Math.max(0, Math.min(cursorOffset, value.length));
  return (
    <Fragment>
      <span>{value.slice(0, clampedOffset)}</span>
      {showCursor ? <span fg={cursorColor}>_</span> : null}
      <span>{value.slice(clampedOffset)}</span>
    </Fragment>
  );
}
