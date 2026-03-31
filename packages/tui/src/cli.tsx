#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { formatHelpText, parseStartupOptions } from "@diffdiff/core";
import type { StartupOptions } from "@diffdiff/core";
import packageJson from "../package.json";

// This tiny shell gives users immediate feedback while the heavier repository and diff prep runs.
function StartupScreen({
  chromeBackground,
  path,
  text,
  textMuted,
}: {
  chromeBackground: string;
  path: string;
  text: string;
  textMuted: string;
}) {
  return (
    <box width="100%" height="100%" backgroundColor={chromeBackground} paddingX={2} paddingY={1}>
      <box width="100%" flexDirection="column" gap={0}>
        <text fg="#9cdcfe" wrapMode="none">
          diffdiff
        </text>
        <text wrapMode="none">
          <span fg={text}>Loading review session</span>
          <span fg={textMuted}>{"..."}</span>
        </text>
        <text fg={textMuted} wrapMode="none">
          {path}
        </text>
      </box>
    </box>
  );
}

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

  // Keep the initial module graph light so `--help` and `--version` stay instant, then overlap the
  // background-color probe with the heavier TUI/runtime imports for the real app launch.
  const themeModulePromise = import("./theme.ts");
  const runtimeModulesPromise = Promise.all([
    import("./app.tsx"),
    import("./pierre.ts"),
    import("./syntax-palette.ts"),
    import("./syntax-style.ts"),
  ]);
  const themeModule = await themeModulePromise;
  const modePromise = themeModule.getTerminalBackgroundMode();
  const [
    { DiffdiffApp },
    { loadPreparedReviewSession },
    { createTerminalSyntaxPalette, getSyntaxPalette },
    { createTerminalSyntaxStyle, getSyntaxStyle },
  ] = await runtimeModulesPromise;
  const mode = await modePromise;
  const themeName = themeModule.getPierreThemeName(mode);
  const fallbackTheme = themeModule.getUiTheme(themeName);

  const renderer = await createCliRenderer({
    useAlternateScreen: true,
    useConsole: false,
    exitOnCtrlC: true,
    backgroundColor: "transparent",
  });

  try {
    const terminalColors = await themeModule.getTerminalColors(renderer);
    const theme =
      terminalColors == null
        ? fallbackTheme
        : themeModule.createTerminalUiTheme(terminalColors, mode);
    const syntaxPalette =
      terminalColors == null
        ? getSyntaxPalette(themeName)
        : createTerminalSyntaxPalette(theme, terminalColors);
    const syntaxStyle =
      terminalColors == null
        ? getSyntaxStyle(themeName)
        : createTerminalSyntaxStyle(theme, terminalColors);

    renderer.setBackgroundColor(theme.appBackground);
    const root = createRoot(renderer);

    // Render a lightweight shell first so the user gets immediate feedback while git and syntax
    // preparation finish in the background.
    root.render(
      <StartupScreen
        chromeBackground={theme.chromeBackground}
        path={options.repoPath ?? process.cwd()}
        text={theme.text}
        textMuted={theme.textMuted}
      />,
    );

    // Launch with deferred syntax rendering so the first interactive frame is ready before we do
    // any eager Shiki/Pierre tokenization work.
    const loadSession = (nextOptions: StartupOptions) =>
      loadPreparedReviewSession(nextOptions, themeName, theme, syntaxPalette, {
        deferSyntaxRendering: true,
      });
    const initialSession = await loadSession(options);

    root.render(
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
