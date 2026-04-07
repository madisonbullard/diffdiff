import { Fragment } from "react";

export function TextInputContent({
  cursorColor,
  cursorOffset,
  placeholder,
  placeholderColor,
  showCursor = true,
  value,
}: {
  cursorColor: string;
  cursorOffset: number;
  placeholder?: string;
  placeholderColor?: string;
  showCursor?: boolean;
  value: string;
}) {
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
