import { SyntaxStyle } from "@opentui/core";
import { getUiTheme } from "./theme.ts";
import type { UiTheme } from "./theme.ts";
import type { PierreThemeName } from "./types.ts";

interface SyntaxPalette {
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
  function: "#9cdcfe",
  keyword: "#ff7b72",
  number: "#79c0ff",
  operator: "#8ea4b5",
  punctuation: "#8ea4b5",
  string: "#7ee787",
  type: "#d4a72c",
  variable: "#e6edf3",
};

const LIGHT_SYNTAX_PALETTE: SyntaxPalette = {
  comment: "#5b7383",
  function: "#0c6d97",
  keyword: "#a93a32",
  number: "#2676a3",
  operator: "#5b7383",
  punctuation: "#5b7383",
  string: "#177245",
  type: "#8a6200",
  variable: "#10202d",
};

const DARK_SYNTAX_STYLE = createSyntaxStyle(getUiTheme("pierre-dark"), DARK_SYNTAX_PALETTE);
const LIGHT_SYNTAX_STYLE = createSyntaxStyle(getUiTheme("pierre-light"), LIGHT_SYNTAX_PALETTE);

export function getSyntaxStyle(themeName: PierreThemeName): SyntaxStyle {
  return themeName === "pierre-light" ? LIGHT_SYNTAX_STYLE : DARK_SYNTAX_STYLE;
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
        foreground: theme.textMuted,
        background: theme.contextBg,
      },
    },
  ];
}
