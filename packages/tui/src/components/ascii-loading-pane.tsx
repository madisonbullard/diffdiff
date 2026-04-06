import { useEffect, useState } from "react";
import type { UiTheme } from "../theme.ts";

export const ASCII_LOADING_FRAME_MS = 120;
export const ASCII_LOADING_FRAMES = [
  "\u00b7",
  "\u2022",
  "\u274b",
  "\u25cf",
  "\u229b",
  "\u235f",
  "\u2022",
] as const;

export interface AsciiLoadingPaneProps {
  theme: UiTheme;
}

export function AsciiLoadingPane({ theme }: AsciiLoadingPaneProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setFrame((currentFrame) => currentFrame + 1);
    }, ASCII_LOADING_FRAME_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const glyph = getAsciiLoadingFrame(frame);
  const color = getAsciiLoadingFrameColor(theme, frame);

  return (
    <box width={1} height={1} alignItems="center" justifyContent="center">
      <text fg={color} wrapMode="none">
        {glyph}
      </text>
    </box>
  );
}

export function getAsciiLoadingFrame(frame: number): string {
  return (
    ASCII_LOADING_FRAMES[modulo(Math.floor(frame), ASCII_LOADING_FRAMES.length)] ??
    ASCII_LOADING_FRAMES[0]
  );
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function getAsciiLoadingFrameColor(theme: UiTheme, frame: number): string {
  switch (getAsciiLoadingFrame(frame)) {
    case "\u00b7":
      return theme.textMuted;
    case "\u2022":
      return theme.text;
    case "\u274b":
      return theme.warning;
    case "\u25cf":
      return theme.accent;
    case "\u229b":
      return theme.success;
    case "\u235f":
      return theme.accent;
    default:
      return theme.text;
  }
}
