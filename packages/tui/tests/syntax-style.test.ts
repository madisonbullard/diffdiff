import { describe, expect, test } from "vite-plus/test";
import { getSyntaxPalette } from "../src/syntax-palette.ts";
import { getSyntaxRules } from "../src/syntax-rules.ts";
import { getUiTheme } from "../src/theme.ts";

describe("getSyntaxRules", () => {
  test("covers shell-relevant token scopes from opencode", () => {
    const theme = getUiTheme("pierre-dark");
    const palette = getSyntaxPalette("pierre-dark");
    const rules = getSyntaxRules(theme, palette);

    expect(findForeground(rules, "keyword.function")).toBe(palette.function);
    expect(findForeground(rules, "keyword.operator")).toBe(palette.operator);
    expect(findForeground(rules, "punctuation.delimiter")).toBe(palette.operator);
    expect(findForeground(rules, "function.call")).toBe(palette.variable);
    expect(findForeground(rules, "variable.builtin")).toBe(palette.variable);
    expect(findForeground(rules, "string.escape")).toBe(palette.keyword);
    expect(findForeground(rules, "keyword.directive")).toBe(palette.keyword);
  });
});

function findForeground(
  rules: ReturnType<typeof getSyntaxRules>,
  scope: string,
): string | undefined {
  return rules.find((rule) => rule.scope.includes(scope))?.style.foreground;
}
