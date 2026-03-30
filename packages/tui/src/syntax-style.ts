import { SyntaxStyle, type TerminalColors } from "@opentui/core";
import {
  createTerminalSyntaxPalette,
  getSyntaxPalette,
  type SyntaxPalette,
} from "./syntax-palette.ts";
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

function getSyntaxRules(theme: UiTheme, palette: SyntaxPalette) {
  return [
    {
      scope: ["default"],
      style: {
        foreground: theme.text,
      },
    },
    {
      scope: ["comment", "comment.documentation"],
      style: {
        foreground: palette.comment,
        italic: true,
      },
    },
    {
      scope: ["string", "symbol", "character", "character.special"],
      style: {
        foreground: palette.string,
      },
    },
    {
      scope: ["number", "boolean", "float", "constant"],
      style: {
        foreground: palette.number,
      },
    },
    {
      scope: [
        "keyword",
        "keyword.conditional",
        "keyword.directive",
        "keyword.exception",
        "keyword.import",
        "keyword.modifier",
        "keyword.operator",
        "keyword.repeat",
        "keyword.return",
        "keyword.type",
      ],
      style: {
        foreground: palette.keyword,
        italic: true,
      },
    },
    {
      scope: ["operator", "punctuation.delimiter", "punctuation.special"],
      style: {
        foreground: palette.operator,
      },
    },
    {
      scope: ["punctuation", "punctuation.bracket"],
      style: {
        foreground: palette.punctuation,
      },
    },
    {
      scope: [
        "function",
        "function.builtin",
        "function.call",
        "function.method",
        "function.method.call",
      ],
      style: {
        foreground: palette.function,
      },
    },
    {
      scope: [
        "variable",
        "variable.member",
        "variable.parameter",
        "property",
        "field",
        "parameter",
      ],
      style: {
        foreground: palette.variable,
      },
    },
    {
      scope: [
        "type",
        "type.builtin",
        "type.definition",
        "class",
        "constructor",
        "module",
        "namespace",
      ],
      style: {
        foreground: palette.type,
      },
    },
    {
      scope: ["attribute", "annotation", "tag.attribute"],
      style: {
        foreground: theme.warning,
      },
    },
    {
      scope: ["tag"],
      style: {
        foreground: theme.danger,
      },
    },
    {
      scope: ["tag.delimiter"],
      style: {
        foreground: palette.operator,
      },
    },
    {
      scope: ["diff.plus"],
      style: {
        foreground: theme.success,
        background: theme.additionBg,
      },
    },
    {
      scope: ["diff.minus"],
      style: {
        foreground: theme.danger,
        background: theme.deletionBg,
      },
    },
    {
      scope: ["diff.delta"],
      style: {
        foreground: theme.border,
        background: theme.contextBg,
      },
    },
  ];
}
