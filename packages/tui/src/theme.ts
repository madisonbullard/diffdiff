import type { TerminalColors } from "@opentui/core";
import type { PierreThemeName } from "./types.ts";

export type ThemeMode = "dark" | "light";

export interface TerminalPaletteSource {
  getPalette(options?: { size?: number; timeout?: number }): Promise<TerminalColors>;
}

export interface UiTheme {
  appBackground: string;
  chromeBackground: string;
  inverseText: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderActive: string;
  text: string;
  textMuted: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  additionBg: string;
  additionLineNumberBg: string;
  deletionBg: string;
  deletionLineNumberBg: string;
  contextBg: string;
  hunkBg: string;
  modalBg: string;
  reviewedBg: string;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const ANSI_COLORS = [
  "#000000",
  "#800000",
  "#008000",
  "#808000",
  "#000080",
  "#800080",
  "#008080",
  "#c0c0c0",
  "#808080",
  "#ff0000",
  "#00ff00",
  "#ffff00",
  "#0000ff",
  "#ff00ff",
  "#00ffff",
  "#ffffff",
] as const;

export const DARK_THEME: UiTheme = {
  appBackground: "#07131b",
  chromeBackground: "#0b1b26",
  inverseText: "#0b1b26",
  surface: "#10202d",
  surfaceMuted: "#152838",
  border: "#29475c",
  borderActive: "#67b7e1",
  text: "#e6edf3",
  textMuted: "#8ea4b5",
  accent: "#9cdcfe",
  success: "#3fb950",
  danger: "#ff7b72",
  warning: "#d4a72c",
  additionBg: "#0f2619",
  additionLineNumberBg: "#163526",
  deletionBg: "#2a1718",
  deletionLineNumberBg: "#3a2021",
  contextBg: "#0d1822",
  hunkBg: "#183041",
  modalBg: "#0c1823",
  reviewedBg: "#0d2634",
};

export const LIGHT_THEME: UiTheme = {
  appBackground: "#eef5f8",
  chromeBackground: "#dce8ee",
  inverseText: "#dce8ee",
  surface: "#ffffff",
  surfaceMuted: "#edf3f6",
  border: "#b4c7d3",
  borderActive: "#2676a3",
  text: "#10202d",
  textMuted: "#5b7383",
  accent: "#0c6d97",
  success: "#177245",
  danger: "#a93a32",
  warning: "#8a6200",
  additionBg: "#e8f5ec",
  additionLineNumberBg: "#dceee3",
  deletionBg: "#f9ebeb",
  deletionLineNumberBg: "#f4dddd",
  contextBg: "#f5f9fb",
  hunkBg: "#e5f0f7",
  modalBg: "#fdfefe",
  reviewedBg: "#e8f3f8",
};

export function getUiTheme(themeName: PierreThemeName): UiTheme {
  return themeName === "pierre-light" ? LIGHT_THEME : DARK_THEME;
}

export function getPierreThemeName(mode: ThemeMode): PierreThemeName {
  return mode === "light" ? "pierre-light" : "pierre-dark";
}

export async function getTerminalBackgroundMode(): Promise<ThemeMode> {
  if (!process.stdin.isTTY) {
    return "dark";
  }

  return new Promise((resolve) => {
    let timeout: NodeJS.Timeout;

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.removeListener("data", handler);
      clearTimeout(timeout);
    };

    const handler = (data: Buffer) => {
      const color = extractOsc11Color(data.toString());
      if (color == null) {
        return;
      }

      cleanup();
      resolve(getThemeModeFromTerminalColor(color));
    };

    process.stdin.setRawMode(true);
    process.stdin.on("data", handler);
    process.stdout.write("\x1b]11;?\x07");

    timeout = setTimeout(() => {
      cleanup();
      resolve("dark");
    }, 1000);
  });
}

export async function getTerminalColors(
  paletteSource: TerminalPaletteSource,
): Promise<TerminalColors | undefined> {
  try {
    const colors = await paletteSource.getPalette({
      size: 16,
    });

    return colors.palette[0] == null ? undefined : colors;
  } catch {
    return undefined;
  }
}

export function createTerminalUiTheme(colors: TerminalColors, mode: ThemeMode): UiTheme {
  const background = parseHexColor(colors.defaultBackground ?? colors.palette[0] ?? "#000000");
  const foreground = parseHexColor(colors.defaultForeground ?? colors.palette[7] ?? "#ffffff");
  const isDark = mode === "dark";
  const colorAt = (index: number) =>
    parseHexColor(colors.palette[index] ?? ANSI_COLORS[index] ?? "#ffffff");
  const grays = generateGrayScale(background, isDark);
  const textMuted = generateMutedTextColor(background, isDark);
  const ansiColors = {
    red: colorAt(1),
    green: colorAt(2),
    yellow: colorAt(3),
    cyan: colorAt(6),
    redBright: colorAt(9),
    greenBright: colorAt(10),
  };
  const diffAlpha = isDark ? 0.22 : 0.14;

  return {
    appBackground: "transparent",
    chromeBackground: toHex(grays[2]),
    inverseText: toHex(background),
    surface: toHex(grays[2]),
    surfaceMuted: toHex(grays[3]),
    border: toHex(grays[7]),
    borderActive: toHex(ansiColors.cyan),
    text: toHex(foreground),
    textMuted: toHex(textMuted),
    accent: toHex(ansiColors.cyan),
    success: toHex(ansiColors.green),
    danger: toHex(ansiColors.red),
    warning: toHex(ansiColors.yellow),
    additionBg: toHex(tint(background, ansiColors.green, diffAlpha)),
    additionLineNumberBg: toHex(tint(grays[3], ansiColors.greenBright, diffAlpha)),
    deletionBg: toHex(tint(background, ansiColors.red, diffAlpha)),
    deletionLineNumberBg: toHex(tint(grays[3], ansiColors.redBright, diffAlpha)),
    contextBg: toHex(grays[1]),
    hunkBg: toHex(tint(grays[1], ansiColors.yellow, isDark ? 0.14 : 0.1)),
    modalBg: toHex(grays[2]),
    reviewedBg: toHex(tint(grays[3], ansiColors.cyan, isDark ? 0.18 : 0.12)),
  };
}

export function getThemeModeFromTerminalColor(color: string): ThemeMode {
  const rgb = parseTerminalColor(color);
  if (rgb == null) {
    return "dark";
  }

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "light" : "dark";
}

function parseTerminalColor(color: string): RgbColor | undefined {
  if (color.startsWith("rgb:")) {
    const [r, g, b] = color.substring(4).split("/");
    if (r == null || g == null || b == null) {
      return undefined;
    }

    return {
      r: parseInt(r, 16) >> 8,
      g: parseInt(g, 16) >> 8,
      b: parseInt(b, 16) >> 8,
    };
  }

  if (/^#[0-9a-fA-F]{6}$/u.test(color)) {
    return parseHexColor(color);
  }

  const rgbMatch = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/u.exec(color);
  if (rgbMatch != null) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  return undefined;
}

function parseHexColor(color: string): RgbColor {
  return {
    r: parseInt(color.substring(1, 3), 16),
    g: parseInt(color.substring(3, 5), 16),
    b: parseInt(color.substring(5, 7), 16),
  };
}

function tint(base: RgbColor, overlay: RgbColor, alpha: number): RgbColor {
  return {
    r: Math.round(base.r + (overlay.r - base.r) * alpha),
    g: Math.round(base.g + (overlay.g - base.g) * alpha),
    b: Math.round(base.b + (overlay.b - base.b) * alpha),
  };
}

function generateGrayScale(bg: RgbColor, isDark: boolean): Record<number, RgbColor> {
  const grays: Record<number, RgbColor> = {};
  const luminance = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;

  for (let index = 1; index <= 12; index += 1) {
    const factor = index / 12;
    let nextR: number;
    let nextG: number;
    let nextB: number;

    if (isDark) {
      if (luminance < 10) {
        const grayValue = Math.floor(factor * 0.4 * 255);
        nextR = grayValue;
        nextG = grayValue;
        nextB = grayValue;
      } else {
        const nextLuminance = luminance + (255 - luminance) * factor * 0.4;
        const ratio = nextLuminance / luminance;
        nextR = Math.min(bg.r * ratio, 255);
        nextG = Math.min(bg.g * ratio, 255);
        nextB = Math.min(bg.b * ratio, 255);
      }
    } else if (luminance > 245) {
      const grayValue = Math.floor(255 - factor * 0.4 * 255);
      nextR = grayValue;
      nextG = grayValue;
      nextB = grayValue;
    } else {
      const nextLuminance = luminance * (1 - factor * 0.4);
      const ratio = nextLuminance / luminance;
      nextR = Math.max(bg.r * ratio, 0);
      nextG = Math.max(bg.g * ratio, 0);
      nextB = Math.max(bg.b * ratio, 0);
    }

    grays[index] = {
      r: Math.floor(nextR),
      g: Math.floor(nextG),
      b: Math.floor(nextB),
    };
  }

  return grays;
}

function generateMutedTextColor(bg: RgbColor, isDark: boolean): RgbColor {
  const luminance = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;
  let grayValue: number;

  if (isDark) {
    if (luminance < 10) {
      grayValue = 180;
    } else {
      grayValue = Math.min(Math.floor(160 + luminance * 0.3), 200);
    }
  } else if (luminance > 245) {
    grayValue = 75;
  } else {
    grayValue = Math.max(Math.floor(100 - (255 - luminance) * 0.2), 60);
  }

  return {
    r: grayValue,
    g: grayValue,
    b: grayValue,
  };
}

function toHex(color: RgbColor): string {
  return `#${[color.r, color.g, color.b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function extractOsc11Color(value: string): string | undefined {
  const prefix = "\u001B]11;";
  const start = value.indexOf(prefix);
  if (start === -1) {
    return undefined;
  }

  const colorStart = start + prefix.length;
  const belIndex = value.indexOf("\u0007", colorStart);
  const escIndex = value.indexOf("\u001B", colorStart);
  const end = [belIndex, escIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (end == null) {
    return undefined;
  }

  return value.slice(colorStart, end);
}
