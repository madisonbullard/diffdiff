import { useEffect, useRef, useState } from "react";
import { getStartupTraceNow } from "./startup-tracing.ts";

export const STARTUP_SCREEN_ART_LINES = [
  "   ███╗                ███╗",
  "   ███║███╗ ███╗███╗   ███║███╗ ███╗███╗",
  "██████║╚══╝██╔═██╔═╝██████║╚══╝██╔═██╔═╝",
  "██ ███║███╗███╗███╗ ██ ███║███╗███╗███╗",
  "██████║███║██╔╝██╔╝ ██████║███║██╔╝██╔╝",
  "╚═════╝╚══╝██║ ██║  ╚═════╝╚══╝██║ ██║",
  "           ╚═╝ ╚═╝             ╚═╝ ╚═╝",
] as const;

export const STARTUP_SCREEN_FRAME_MS = 33;
export const STARTUP_SCREEN_FRAME_DELAY_THRESHOLD_MS = 40;
export const STARTUP_SCREEN_BAND_WIDTH = 40;
export const STARTUP_SCREEN_BAND_EDGE_WIDTH = 8;
export const STARTUP_SCREEN_WIPE_ROW_OFFSET = 1;
export const STARTUP_SCREEN_ART_WIDTH = Math.max(
  ...STARTUP_SCREEN_ART_LINES.map((line) => Array.from(line).length),
);

const STARTUP_SCREEN_COLORS = {
  green: "#42f58d",
  red: "#e34d5f",
  white: "#ffffff",
} as const;
export const STARTUP_SCREEN_INITIAL_FRAME_COUNT = 1;
export const STARTUP_SCREEN_WIPE_FRAME_COUNT = 15;
export const STARTUP_SCREEN_FINAL_FRAME =
  STARTUP_SCREEN_INITIAL_FRAME_COUNT + STARTUP_SCREEN_WIPE_FRAME_COUNT;

export interface StartupScreenProps {
  chromeBackground: string;
  onFrameDelay?: (details: StartupScreenFrameDelay) => void;
  path: string;
  text: string;
  textMuted: string;
}

export interface StartupScreenFrameDelay {
  actualIntervalMs: number;
  delayMs: number;
  frame: number;
}

export type StartupScreenAnimationState =
  | {
      color: string;
      kind: "solid";
    }
  | {
      kind: "band";
      progress: number;
    };

export function StartupScreen({
  chromeBackground,
  onFrameDelay,
  path,
  text,
  textMuted,
}: StartupScreenProps) {
  const [frame, setFrame] = useState(0);
  const lastTickAtRef = useRef<number | null>(null);

  useEffect(() => {
    lastTickAtRef.current = getStartupTraceNow();

    const intervalId = setInterval(() => {
      const now = getStartupTraceNow();
      const previousTickAt = lastTickAtRef.current ?? now;
      const actualIntervalMs = now - previousTickAt;
      lastTickAtRef.current = now;

      setFrame((currentFrame) => {
        const delayMs = actualIntervalMs - STARTUP_SCREEN_FRAME_MS;

        if (delayMs >= STARTUP_SCREEN_FRAME_DELAY_THRESHOLD_MS) {
          onFrameDelay?.({
            actualIntervalMs: Math.round(actualIntervalMs * 10) / 10,
            delayMs: Math.round(delayMs * 10) / 10,
            frame: currentFrame,
          });
        }

        return Math.min(currentFrame + 1, STARTUP_SCREEN_FINAL_FRAME);
      });
    }, STARTUP_SCREEN_FRAME_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [onFrameDelay]);

  const animationState = getStartupScreenAnimationState(frame);

  return (
    <box
      width="100%"
      height="100%"
      backgroundColor={chromeBackground}
      alignItems="center"
      justifyContent="center"
      paddingX={1}
    >
      <box flexDirection="column" alignItems="center" gap={1}>
        <box width={STARTUP_SCREEN_ART_WIDTH} flexDirection="column" gap={0}>
          {STARTUP_SCREEN_ART_LINES.map((line, lineIndex) => (
            <text key={lineIndex} wrapMode="none">
              {Array.from(line).map((character, column) => (
                <span
                  key={column}
                  fg={getStartupScreenCharacterColor(column, lineIndex, animationState)}
                >
                  {character}
                </span>
              ))}
            </text>
          ))}
        </box>
        <box flexDirection="column" alignItems="center" gap={0}>
          <text fg={text} wrapMode="none">
            Loading review session
          </text>
          <text fg={textMuted} wrapMode="none">
            {path}
          </text>
        </box>
      </box>
    </box>
  );
}

export function getStartupScreenAnimationState(frame: number): StartupScreenAnimationState {
  const normalizedFrame = Math.max(0, Math.floor(frame));

  if (normalizedFrame < STARTUP_SCREEN_INITIAL_FRAME_COUNT) {
    return { color: STARTUP_SCREEN_COLORS.white, kind: "solid" };
  }

  if (normalizedFrame < STARTUP_SCREEN_INITIAL_FRAME_COUNT + STARTUP_SCREEN_WIPE_FRAME_COUNT) {
    return {
      kind: "band",
      progress:
        (normalizedFrame - STARTUP_SCREEN_INITIAL_FRAME_COUNT) /
        (STARTUP_SCREEN_WIPE_FRAME_COUNT - 1),
    };
  }

  return { color: STARTUP_SCREEN_COLORS.white, kind: "solid" };
}

export function getStartupScreenCharacterColor(
  column: number,
  row: number,
  state: StartupScreenAnimationState,
): string {
  if (state.kind === "solid") {
    return state.color;
  }

  // The total travel distance: the band must clear the art plus its own width
  // plus edge gradients on both sides, accounting for row offset slant.
  const maxRowOffset = (STARTUP_SCREEN_ART_LINES.length - 1) * STARTUP_SCREEN_WIPE_ROW_OFFSET;
  const totalTravel =
    STARTUP_SCREEN_ART_WIDTH +
    STARTUP_SCREEN_BAND_WIDTH +
    STARTUP_SCREEN_BAND_EDGE_WIDTH * 2 +
    maxRowOffset;

  // bandCenter is the midpoint of the band for this row.
  const bandCenter =
    state.progress * totalTravel -
    STARTUP_SCREEN_BAND_WIDTH / 2 -
    STARTUP_SCREEN_BAND_EDGE_WIDTH -
    row * STARTUP_SCREEN_WIPE_ROW_OFFSET;

  const halfBand = STARTUP_SCREEN_BAND_WIDTH / 2;
  const bandLeft = bandCenter - halfBand;
  const bandRight = bandCenter + halfBand;

  // Distance from column into the band interior (negative = outside left, positive inside)
  const distFromLeft = column - bandLeft;
  const distFromRight = bandRight - column;

  // Outside the band + edge regions entirely: white
  if (
    distFromLeft < -STARTUP_SCREEN_BAND_EDGE_WIDTH ||
    distFromRight < -STARTUP_SCREEN_BAND_EDGE_WIDTH
  ) {
    return STARTUP_SCREEN_COLORS.white;
  }

  // Left edge gradient: white -> green
  if (distFromLeft < 0) {
    const edgeMix =
      (distFromLeft + STARTUP_SCREEN_BAND_EDGE_WIDTH) / STARTUP_SCREEN_BAND_EDGE_WIDTH;
    return blendHexColors(STARTUP_SCREEN_COLORS.white, STARTUP_SCREEN_COLORS.green, edgeMix);
  }

  // Right edge gradient: red -> white
  if (distFromRight < 0) {
    const edgeMix =
      (distFromRight + STARTUP_SCREEN_BAND_EDGE_WIDTH) / STARTUP_SCREEN_BAND_EDGE_WIDTH;
    return blendHexColors(STARTUP_SCREEN_COLORS.white, STARTUP_SCREEN_COLORS.red, edgeMix);
  }

  // Inside the band: gradient from green (left) to red (right)
  const bandPosition = STARTUP_SCREEN_BAND_WIDTH > 0 ? distFromLeft / STARTUP_SCREEN_BAND_WIDTH : 0;
  return blendHexColors(STARTUP_SCREEN_COLORS.green, STARTUP_SCREEN_COLORS.red, bandPosition);
}

function blendHexColors(fromColor: string, toColor: string, ratio: number): string {
  const from = parseHexColor(fromColor);
  const to = parseHexColor(toColor);
  const mix = clamp(ratio, 0, 1);

  return formatHexColor({
    b: Math.round(from.b + (to.b - from.b) * mix),
    g: Math.round(from.g + (to.g - from.g) * mix),
    r: Math.round(from.r + (to.r - from.r) * mix),
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatHexColor({ b, g, r }: { b: number; g: number; r: number }): string {
  return `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`;
}

function parseHexColor(color: string): { b: number; g: number; r: number } {
  const normalized = color.startsWith("#") ? color.slice(1) : color;

  if (normalized.length !== 6) {
    throw new Error(`Unsupported color format: ${color}`);
  }

  return {
    b: Number.parseInt(normalized.slice(4, 6), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    r: Number.parseInt(normalized.slice(0, 2), 16),
  };
}

function toHexPair(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}
