import { expect, test } from "vite-plus/test";
import { resolveDialogRect } from "../src/components/dialog/geometry.ts";
import { fitText, fitPath, cellWidth } from "../src/components/dialog/text.ts";
import { getUiTheme, createTerminalUiTheme } from "../src/theme.ts";
import { dialogTokens, accessibleDialogTheme } from "../src/components/dialog/tokens.ts";
function contrast(a: string, b: string) {
  const lum = (color: string) =>
    [1, 3, 5]
      .map((i) => Number.parseInt(color.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("unrounded dialog text contrast and footer separation hold in light and dark", () => {
  for (const name of ["pierre-dark", "pierre-light"] as const) {
    const theme = getUiTheme(name);
    const tokens = dialogTokens(theme);
    for (const bg of [tokens.panel, tokens.popover, tokens.cursor, tokens.warning, tokens.raised]) {
      expect(contrast(theme.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.textMuted, bg)).toBeGreaterThanOrEqual(3);
    }
    expect(tokens.panel).not.toBe(tokens.footer);
  }
});
test("terminal palette panels remain distinct from the app and footer", () => {
  for (const [background, foreground, mode] of [
    ["#fdf6e3", "#657b83", "light"],
    ["#002b36", "#93a1a1", "dark"],
    ["#ffffff", "#24292e", "light"],
  ] as const) {
    const theme = accessibleDialogTheme(
      createTerminalUiTheme(
        {
          defaultBackground: background,
          defaultForeground: foreground,
          palette: [],
        } as unknown as import("@opentui/core").TerminalColors,
        mode,
      ),
    );
    const tokens = dialogTokens(theme);
    expect(tokens.panel).not.toBe(tokens.footer);
    expect(tokens.popover).not.toBe(background);
    expect(contrast(theme.text, tokens.panel)).toBeGreaterThanOrEqual(4.5);
  }
});
test("compact sheets reserve the footer and confirmations stay floating", () => {
  for (const [cols, rows] of [
    [120, 40],
    [100, 30],
    [99, 40],
    [120, 29],
    [80, 24],
    [58, 16],
  ])
    for (const family of ["picker", "form", "inspector", "confirm"] as const) {
      const rect = resolveDialogRect(family, cols!, rows!);
      expect(rect.top + rect.height).toBeLessThan(rows!);
      expect(rect.width).toBeLessThanOrEqual(cols!);
      expect(rect.sheet).toBe(family !== "confirm" && (cols! < 100 || rows! < 30));
      if (rect.sheet) expect(rect.top).toBe(0);
    }
});
test("truncation respects terminal cells and complete graphemes", () => {
  for (let cells = 0; cells < 30; cells += 1)
    for (const text of ["src/日本語/👩🏽‍💻-e\u0301/file.ts", "long branch title"]) {
      expect(cellWidth(fitText(text, cells))).toBeLessThanOrEqual(cells);
      expect(cellWidth(fitPath(text, cells))).toBeLessThanOrEqual(cells);
      expect(fitText(text, cells)).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
    }
});
