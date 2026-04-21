import { Fragment } from "react";
import type { TextInputSurface } from "../text-input-surface.ts";

const BLINK_TEXT_ATTRIBUTE = 1 << 4;

export function TextInputContent({
  cursorColor,
  cursorTextColor,
  placeholder,
  placeholderColor,
  showCursor = true,
  surface,
}: {
  cursorColor: string;
  cursorTextColor?: string;
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
        {showCursor ? renderBlockCursor(cursorColor, cursorTextColor, " ") : null}
        {placeholder != null ? <span fg={placeholderColor}>{placeholder}</span> : null}
      </Fragment>
    );
  }

  if (!showCursor) {
    return value;
  }

  const clampedOffset = Math.max(0, Math.min(cursorOffset, value.length));
  const cursorCharacter = value.slice(clampedOffset, clampedOffset + 1);
  const blockCharacter = cursorCharacter === "" || cursorCharacter === "\n" ? " " : cursorCharacter;
  const suffixOffset =
    cursorCharacter === "" || cursorCharacter === "\n" ? clampedOffset : clampedOffset + 1;

  return (
    <Fragment>
      <span>{value.slice(0, clampedOffset)}</span>
      {renderBlockCursor(cursorColor, cursorTextColor, blockCharacter)}
      <span>{value.slice(suffixOffset)}</span>
    </Fragment>
  );
}

function renderBlockCursor(
  cursorColor: string,
  cursorTextColor: string | undefined,
  content: string,
) {
  return (
    <span attributes={BLINK_TEXT_ATTRIBUTE} bg={cursorColor} fg={cursorTextColor}>
      {content}
    </span>
  );
}
