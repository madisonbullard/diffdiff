import { tintHex } from "../shared.tsx";
import type { UiTheme } from "../../theme.ts";
function relativeLuminance(value: string) {
  return [1, 3, 5]
    .map((i) => Number.parseInt(value.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
}
function contrast(a: string, b: string) {
  const x = relativeLuminance(a),
    y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function accessibleDialogTheme(theme: UiTheme): UiTheme {
  const colors = dialogTokens(theme);
  const backgrounds = [
    colors.panel,
    colors.popover,
    colors.cursor,
    colors.raised,
    colors.warning,
    colors.danger,
  ];
  const target = relativeLuminance(colors.panel) > 0.45 ? "#000000" : "#ffffff";
  const adjust = (fg: string, minimum: number) => {
    for (let i = 0; i <= 100; i += 1) {
      const value = tintHex(fg, target, i / 100);
      if (backgrounds.every((bg) => contrast(value, bg) >= minimum)) return value;
    }
    return target;
  };
  return { ...theme, text: adjust(theme.text, 4.6), textMuted: adjust(theme.textMuted, 3.1) };
}
export function dialogTokens(theme: UiTheme) {
  const app = theme.appBackground === "transparent" ? theme.inverseText : theme.appBackground;
  const luminance = (value: string) =>
    [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0) /
    765;
  const dark = luminance(theme.modalBg) < 0.5;
  const panel = dark ? tintHex(theme.modalBg, theme.border, 0.45) : theme.modalBg;
  const footer = theme.chromeBackground;
  return {
    panel,
    scrim: dark ? "#00000066" : "#00000026",
    popover: dark ? panel : tintHex(app, theme.border, 0.55),
    raised: tintHex(panel, theme.text, 0.08),
    cursor: tintHex(panel, theme.accent, 0.2),
    rule: tintHex(theme.border, panel, 0.3),
    warning: tintHex(panel, theme.warning, 0.16),
    danger: tintHex(panel, theme.danger, 0.16),
    // Terminal palettes can make modalBg and the global footer identical.
    footer:
      panel.toLowerCase() === footer.toLowerCase() ? tintHex(footer, theme.border, 0.55) : footer,
  };
}
