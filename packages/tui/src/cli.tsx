#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { formatHelpText, parseStartupOptions } from "@diffdiff/core";
import type { StartupOptions } from "@diffdiff/core";
import packageJson from "../package.json";
import { DiffdiffApp } from "./app.tsx";
import { loadPreparedReviewSession } from "./pierre.ts";
import { createTerminalSyntaxStyle, getSyntaxStyle } from "./syntax-style.ts";
import {
  createTerminalUiTheme,
  getPierreThemeName,
  getTerminalBackgroundMode,
  getTerminalColors,
  getUiTheme,
} from "./theme.ts";

async function main(): Promise<void> {
  const options = parseStartupOptions();

  if (options.help) {
    process.stdout.write(`${formatHelpText()}\n`);
    return;
  }

  if (options.version) {
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }

  const mode = await getTerminalBackgroundMode();
  const themeName = getPierreThemeName(mode);
  const fallbackTheme = getUiTheme(themeName);

  const renderer = await createCliRenderer({
    useAlternateScreen: true,
    useConsole: false,
    exitOnCtrlC: true,
    backgroundColor: "transparent",
  });

  try {
    const terminalColors = await getTerminalColors(renderer);
    const theme =
      terminalColors == null ? fallbackTheme : createTerminalUiTheme(terminalColors, mode);
    const syntaxStyle =
      terminalColors == null
        ? getSyntaxStyle(themeName)
        : createTerminalSyntaxStyle(theme, terminalColors);

    renderer.setBackgroundColor(theme.appBackground);

    const loadSession = (nextOptions: StartupOptions) =>
      loadPreparedReviewSession(nextOptions, themeName);
    const initialSession = await loadSession(options);

    createRoot(renderer).render(
      <DiffdiffApp
        initialOptions={options}
        initialSession={initialSession}
        loadSession={loadSession}
        onExit={() => {
          renderer.destroy();
          process.exit(0);
        }}
        syntaxStyle={syntaxStyle}
        theme={theme}
      />,
    );
  } catch (error) {
    renderer.destroy();
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`diffdiff: ${message}\n`);
    process.exitCode = 1;
  }
}

void main();
