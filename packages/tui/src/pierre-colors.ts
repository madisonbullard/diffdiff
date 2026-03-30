import type { SyntaxPalette } from "./syntax-palette.ts";
import type { UiTheme } from "./theme.ts";
import type { PierreThemeName } from "./types.ts";

export type SegmentColorResolver = (value: string | undefined) => string | undefined;

export function createPierreSegmentColorResolver(
  themeName: PierreThemeName,
  theme: UiTheme,
  syntaxPalette: SyntaxPalette,
): SegmentColorResolver {
  const replacements = new Map<string, string>(
    Object.entries(
      themeName === "pierre-light"
        ? {
            "#08c0ef": syntaxPalette.operator,
            "#16a994": theme.warning,
            "#17a5af": syntaxPalette.keyword,
            "#199f43": syntaxPalette.string,
            "#1ca1c7": syntaxPalette.number,
            "#79797f": syntaxPalette.variable,
            "#7b43f8": syntaxPalette.function,
            "#84848a": syntaxPalette.comment,
            "#c635e4": syntaxPalette.type,
            "#d47628": syntaxPalette.variable,
            "#d52c36": theme.danger,
            "#d5a910": syntaxPalette.variable,
            "#f44747": theme.danger,
            "#fc2b73": syntaxPalette.keyword,
            "#ffffff": theme.danger,
          }
        : {
            "#08c0ef": syntaxPalette.operator,
            "#5ecc71": syntaxPalette.string,
            "#61d5c0": theme.warning,
            "#64d1db": syntaxPalette.keyword,
            "#68cdf2": syntaxPalette.number,
            "#79797f": syntaxPalette.variable,
            "#84848a": syntaxPalette.comment,
            "#9d6afb": syntaxPalette.function,
            "#adadb1": syntaxPalette.variable,
            "#d568ea": syntaxPalette.type,
            "#f44747": theme.danger,
            "#ff6762": theme.danger,
            "#ff678d": syntaxPalette.keyword,
            "#ffa359": syntaxPalette.variable,
            "#ffca00": syntaxPalette.variable,
            "#ffd452": syntaxPalette.number,
            "#ffffff": theme.danger,
          },
    ),
  );

  return (value) => {
    if (value == null) {
      return undefined;
    }

    const normalized = normalizeHexColor(value);
    if (normalized == null) {
      return value;
    }

    return replacements.get(normalized) ?? value;
  };
}

function normalizeHexColor(value: string): string | undefined {
  return /^#[0-9a-fA-F]{6}$/u.test(value) ? value.toLowerCase() : undefined;
}
