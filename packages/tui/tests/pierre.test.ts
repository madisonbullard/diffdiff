import type { TerminalColors } from "@opentui/core";
import { expect, test } from "vite-plus/test";
import { createPierreSegmentColorResolver } from "../src/pierre-colors.ts";
import { createTerminalSyntaxPalette } from "../src/syntax-palette.ts";
import { createTerminalUiTheme } from "../src/theme.ts";

test("remaps Pierre dark syntax colors to the terminal palette", async () => {
  const colors = createDarkPalette();
  const theme = createTerminalUiTheme(colors, "dark");
  const syntaxPalette = createTerminalSyntaxPalette(theme, colors);
  const resolveColor = createPierreSegmentColorResolver("pierre-dark", theme, syntaxPalette);

  expect(["#D568EA", "#FF678D", "#FFCA00", "#08C0EF", "#68CDF2"].map(resolveColor)).toEqual([
    "#48bcca",
    "#ca6ae7",
    "#e6edf3",
    "#48bcca",
    "#edc272",
  ]);
});

test("remaps Pierre light syntax colors to the terminal palette", async () => {
  const colors = createLightPalette();
  const theme = createTerminalUiTheme(colors, "light");
  const syntaxPalette = createTerminalSyntaxPalette(theme, colors);
  const resolveColor = createPierreSegmentColorResolver("pierre-light", theme, syntaxPalette);

  expect(["#C635E4", "#FC2B73", "#D5A910", "#08C0EF", "#1CA1C7"].map(resolveColor)).toEqual([
    "#24838d",
    "#925592",
    "#2f2a24",
    "#24838d",
    "#b17d13",
  ]);
});

function createDarkPalette(): TerminalColors {
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
  };
}

function createLightPalette(): TerminalColors {
  return {
    cursorColor: null,
    defaultBackground: "#f7f4eb",
    defaultForeground: "#2f2a24",
    highlightBackground: null,
    highlightForeground: null,
    mouseBackground: null,
    mouseForeground: null,
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
    tekBackground: null,
    tekForeground: null,
  };
}
