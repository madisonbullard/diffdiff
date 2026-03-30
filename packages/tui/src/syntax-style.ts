import { SyntaxStyle } from "@opentui/core";
import { getUiTheme } from "./theme.ts";
import type { UiTheme } from "./theme.ts";
import type { PierreThemeName } from "./types.ts";

const DARK_SYNTAX_STYLE = createSyntaxStyle(getUiTheme("pierre-dark"));
const LIGHT_SYNTAX_STYLE = createSyntaxStyle(getUiTheme("pierre-light"));

export function getSyntaxStyle(themeName: PierreThemeName): SyntaxStyle {
  return themeName === "pierre-light" ? LIGHT_SYNTAX_STYLE : DARK_SYNTAX_STYLE;
}

function createSyntaxStyle(theme: UiTheme): SyntaxStyle {
  return SyntaxStyle.fromTheme(getSyntaxRules(theme));
}

function getSyntaxRules(theme: UiTheme) {
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
        foreground: theme.syntaxComment,
        italic: true,
      },
    },
    {
      scope: ["string", "symbol", "character", "character.special"],
      style: {
        foreground: theme.syntaxString,
      },
    },
    {
      scope: ["number", "boolean", "float", "constant"],
      style: {
        foreground: theme.syntaxNumber,
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
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["operator", "punctuation.delimiter", "punctuation.special"],
      style: {
        foreground: theme.syntaxOperator,
      },
    },
    {
      scope: ["punctuation", "punctuation.bracket"],
      style: {
        foreground: theme.syntaxPunctuation,
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
        foreground: theme.syntaxFunction,
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
        foreground: theme.syntaxVariable,
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
        foreground: theme.syntaxType,
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
        foreground: theme.syntaxOperator,
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
