import type { TerminalColors } from "@opentui/core";
import { boostTerminalColor, type ThemeMode, type UiTheme } from "./theme.ts";
import type { PierreThemeName } from "./types.ts";

export interface SyntaxPalette {
  comment: string;
  function: string;
  keyword: string;
  number: string;
  operator: string;
  punctuation: string;
  string: string;
  type: string;
  variable: string;
}

const DARK_SYNTAX_PALETTE: SyntaxPalette = {
  comment: "#8ea4b5",
  function: "#61afef",
  keyword: "#c678dd",
  number: "#e5c07b",
  operator: "#56b6c2",
  punctuation: "#e6edf3",
  string: "#98c379",
  type: "#56b6c2",
  variable: "#e6edf3",
};

const LIGHT_SYNTAX_PALETTE: SyntaxPalette = {
  comment: "#5b7383",
  function: "#4b78a6",
  keyword: "#8f5c8f",
  number: "#a97b1d",
  operator: "#2d7f88",
  punctuation: "#10202d",
  string: "#5f7d48",
  type: "#2d7f88",
  variable: "#10202d",
};

export function getSyntaxPalette(themeName: PierreThemeName): SyntaxPalette {
  return themeName === "pierre-light" ? LIGHT_SYNTAX_PALETTE : DARK_SYNTAX_PALETTE;
}

export function createTerminalSyntaxPalette(theme: UiTheme, colors: TerminalColors): SyntaxPalette {
  const mode = getThemeMode(theme);
  const colorAt = (index: number) => {
    return (
      colors.palette[index] ?? ANSI_COLORS[Math.max(0, Math.min(index, ANSI_COLORS.length - 1))]
    );
  };

  return {
    comment: theme.textMuted,
    function: boostTerminalColor(colorAt(4), mode, 0.22),
    keyword: boostTerminalColor(colorAt(5), mode, 0.24),
    number: boostTerminalColor(colorAt(3), mode, 0.16),
    operator: boostTerminalColor(colorAt(6), mode, 0.2),
    punctuation: theme.text,
    string: boostTerminalColor(colorAt(2), mode, 0.18),
    type: boostTerminalColor(colorAt(6), mode, 0.2),
    variable: theme.text,
  };
}

function getThemeMode(theme: UiTheme): ThemeMode {
  const background = theme.inverseText.slice(1);
  const red = parseInt(background.slice(0, 2), 16);
  const green = parseInt(background.slice(2, 4), 16);
  const blue = parseInt(background.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.5 ? "light" : "dark";
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
