import { useEffect, useState } from "react";

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
export const STARTUP_SCREEN_WIPE_GRADIENT_WIDTH = 8;
export const STARTUP_SCREEN_WIPE_ROW_OFFSET = 1;
export const STARTUP_SCREEN_ART_WIDTH = Math.max(
  ...STARTUP_SCREEN_ART_LINES.map((line) => Array.from(line).length),
);

const STARTUP_SCREEN_COLORS = {
  green: "#22c55e",
  red: "#ff4d4f",
  white: "#ffffff",
} as const;
export const STARTUP_SCREEN_INITIAL_FRAME_COUNT = 1;
export const STARTUP_SCREEN_WIPE_FRAME_COUNT = 6;
export const STARTUP_SCREEN_FINAL_FRAME =
  STARTUP_SCREEN_INITIAL_FRAME_COUNT + STARTUP_SCREEN_WIPE_FRAME_COUNT * 3;

export interface StartupScreenProps {
  chromeBackground: string;
  path: string;
  text: string;
  textMuted: string;
}

export type StartupScreenAnimationState =
  | {
      color: string;
      kind: "solid";
    }
  | {
      fromColor: string;
      kind: "wipe";
      progress: number;
      toColor: string;
    };

export function StartupScreen({ chromeBackground, path, text, textMuted }: StartupScreenProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setFrame((currentFrame) => Math.min(currentFrame + 1, STARTUP_SCREEN_FINAL_FRAME));
    }, STARTUP_SCREEN_FRAME_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

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
      fromColor: STARTUP_SCREEN_COLORS.white,
      kind: "wipe",
      progress: normalizedFrame / STARTUP_SCREEN_WIPE_FRAME_COUNT,
      toColor: STARTUP_SCREEN_COLORS.red,
    };
  }

  if (normalizedFrame < STARTUP_SCREEN_INITIAL_FRAME_COUNT + STARTUP_SCREEN_WIPE_FRAME_COUNT * 2) {
    return {
      fromColor: STARTUP_SCREEN_COLORS.red,
      kind: "wipe",
      progress:
        (normalizedFrame -
          STARTUP_SCREEN_INITIAL_FRAME_COUNT -
          STARTUP_SCREEN_WIPE_FRAME_COUNT +
          1) /
        STARTUP_SCREEN_WIPE_FRAME_COUNT,
      toColor: STARTUP_SCREEN_COLORS.green,
    };
  }

  if (normalizedFrame < STARTUP_SCREEN_INITIAL_FRAME_COUNT + STARTUP_SCREEN_WIPE_FRAME_COUNT * 3) {
    return {
      fromColor: STARTUP_SCREEN_COLORS.green,
      kind: "wipe",
      progress:
        (normalizedFrame -
          STARTUP_SCREEN_INITIAL_FRAME_COUNT -
          STARTUP_SCREEN_WIPE_FRAME_COUNT * 2 +
          1) /
        STARTUP_SCREEN_WIPE_FRAME_COUNT,
      toColor: STARTUP_SCREEN_COLORS.white,
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

  const wipeEdge =
    state.progress * (STARTUP_SCREEN_ART_WIDTH + STARTUP_SCREEN_WIPE_GRADIENT_WIDTH) -
    row * STARTUP_SCREEN_WIPE_ROW_OFFSET;
  const mix = clamp((wipeEdge - column) / STARTUP_SCREEN_WIPE_GRADIENT_WIDTH, 0, 1);
  return blendHexColors(state.fromColor, state.toColor, mix);
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
