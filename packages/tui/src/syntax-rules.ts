import type { SyntaxPalette } from "./syntax-palette.ts";
import type { UiTheme } from "./theme.ts";

export function getSyntaxRules(theme: UiTheme, palette: SyntaxPalette) {
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
      scope: ["string.escape", "string.regexp", "string.special", "string.special.url"],
      style: {
        foreground: palette.keyword,
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
        "keyword.coroutine",
        "keyword.directive",
        "keyword.exception",
        "keyword.export",
        "keyword.import",
        "keyword.modifier",
        "keyword.repeat",
        "keyword.return",
      ],
      style: {
        foreground: palette.keyword,
        italic: true,
      },
    },
    {
      scope: ["keyword.function"],
      style: {
        foreground: palette.function,
      },
    },
    {
      scope: ["keyword.type"],
      style: {
        foreground: palette.type,
        italic: true,
      },
    },
    {
      scope: [
        "keyword.operator",
        "operator",
        "punctuation.delimiter",
        "punctuation.special",
        "keyword.conditional.ternary",
      ],
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
      scope: ["function", "function.method", "variable.member", "constructor"],
      style: {
        foreground: palette.function,
      },
    },
    {
      scope: [
        "variable",
        "variable.parameter",
        "variable.builtin",
        "variable.super",
        "property",
        "field",
        "parameter",
        "function.call",
        "function.method.call",
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
        "module",
        "namespace",
        "constant.builtin",
        "function.builtin",
        "module.builtin",
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
