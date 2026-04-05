import { SyntaxStyle, type TerminalColors } from "@opentui/core";
import {
  createTerminalSyntaxPalette,
  getSyntaxPalette,
  type SyntaxPalette,
} from "./syntax-palette.ts";
import { getSyntaxRules } from "./syntax-rules.ts";
import { getUiTheme } from "./theme.ts";
import type { UiTheme } from "./theme.ts";
import type { PierreThemeName } from "./types.ts";

const DARK_SYNTAX_STYLE = createSyntaxStyle(
  getUiTheme("pierre-dark"),
  getSyntaxPalette("pierre-dark"),
);
const LIGHT_SYNTAX_STYLE = createSyntaxStyle(
  getUiTheme("pierre-light"),
  getSyntaxPalette("pierre-light"),
);

export function getSyntaxStyle(themeName: PierreThemeName): SyntaxStyle {
  return themeName === "pierre-light" ? LIGHT_SYNTAX_STYLE : DARK_SYNTAX_STYLE;
}

export function createTerminalSyntaxStyle(theme: UiTheme, colors: TerminalColors): SyntaxStyle {
  return createSyntaxStyle(theme, createTerminalSyntaxPalette(theme, colors));
}

function createSyntaxStyle(theme: UiTheme, palette: SyntaxPalette): SyntaxStyle {
  return SyntaxStyle.fromTheme(getSyntaxRules(theme, palette));
}
