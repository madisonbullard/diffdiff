import type { TerminalColors } from "@opentui/core";
import { expect, test } from "vite-plus/test";
import { createTerminalUiTheme, getThemeModeFromTerminalColor } from "../src/theme.ts";

test("matches opencode terminal background color parsing", () => {
  expect(getThemeModeFromTerminalColor("rgb:ffff/ffff/ffff")).toBe("light");
  expect(getThemeModeFromTerminalColor("#000000")).toBe("dark");
  expect(getThemeModeFromTerminalColor("rgb(240, 240, 240)")).toBe("light");
  expect(getThemeModeFromTerminalColor("not-a-color")).toBe("dark");
});

test("builds a dark UI theme from terminal colors", () => {
  const theme = createTerminalUiTheme(createPalette(), "dark");

  expect(formatColor(theme.appBackground)).toBe("transparent");
  expect(formatColor(theme.inverseText)).toBe("#101214");
  expect(formatColor(theme.text)).toBe("#e6edf3");
  expect(formatColor(theme.accent)).toBe("#48bcca");
  expect(formatColor(theme.success)).toBe("#97c973");
  expect(formatColor(theme.danger)).toBe("#ec6570");
  expect(formatColor(theme.additionBg)).toBe("#303e2b");
});

test("builds a light UI theme from terminal colors", () => {
  const theme = createTerminalUiTheme(
    createPalette({
      defaultBackground: "#f7f4eb",
      defaultForeground: "#2f2a24",
      palette: [
        "#f7f4eb",
        "#b14d3d",
        "#5f7d48",
        "#a97b1d",
        "#4b78a6",
        "#8f5c8f",
        "#2d7f88",
        "#2f2a24",
        "#a8a196",
        "#d25e4b",
        "#709356",
        "#c29124",
        "#5e8fbe",
        "#a06aa0",
        "#3394a0",
        "#1f1a15",
      ],
    }),
    "light",
  );

  expect(formatColor(theme.appBackground)).toBe("transparent");
  expect(formatColor(theme.inverseText)).toBe("#f7f4eb");
  expect(formatColor(theme.text)).toBe("#2f2a24");
  expect(formatColor(theme.warning)).toBe("#ae7c17");
  expect(formatColor(theme.borderActive)).toBe("#24838d");
  expect(formatColor(theme.deletionBg)).toBe("#edd9ce");
});

function createPalette(overrides: Partial<TerminalColors> = {}): TerminalColors {
  return {
    cursorColor: null,
    defaultBackground: "#101214",
    defaultForeground: "#e6edf3",
    highlightBackground: null,
    highlightForeground: null,
    mouseBackground: null,
    mouseForeground: null,
    palette: [
      "#101214",
      "#e06c75",
      "#98c379",
      "#e5c07b",
      "#61afef",
      "#c678dd",
      "#56b6c2",
      "#e6edf3",
      "#6b7280",
      "#ff7b72",
      "#b4e88d",
      "#f0d48a",
      "#79c0ff",
      "#d2a8ff",
      "#76e3ea",
      "#ffffff",
    ],
    tekBackground: null,
    tekForeground: null,
    ...overrides,
  };
}

function formatColor(color: string): string {
  return color;
}
