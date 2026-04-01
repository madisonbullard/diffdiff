#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import {
  clearGitHubToken,
  formatHelpText,
  GitHubPullRequestService,
  parseStartupOptions,
  storeGitHubToken,
} from "@diffdiff/core";
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
  if (await handleAuthCommand(process.argv.slice(2))) {
    return;
  }

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
    const gitHubPullRequestService = new GitHubPullRequestService();
    const initialSession = await loadSession(options);

    root.render(
      <DiffdiffApp
        addReviewThread={(reviewSession, anchor, body) =>
          gitHubPullRequestService
            .addPendingReviewThread(reviewSession, anchor, body)
            .then(() => undefined)
        }
        initialOptions={options}
        initialSession={initialSession}
        loadSession={loadSession}
        onExit={() => {
          renderer.destroy();
          process.exit(0);
        }}
        submitPendingReview={(reviewSession, event, body) =>
          gitHubPullRequestService.submitPendingReview(reviewSession, event, body)
        }
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

async function handleAuthCommand(argv: readonly string[]): Promise<boolean> {
  if (argv[0] !== "auth") {
    return false;
  }

  if (argv[1] === "login") {
    const token = await resolveAuthToken(argv);
    if (token == null) {
      throw new Error("No GitHub token provided. Pass --token-stdin or set DIFFDIFF_GITHUB_TOKEN.");
    }

    const auth = await storeGitHubToken(token);
    process.stdout.write(
      auth.tokenSource === "keychain"
        ? "Stored GitHub token in the macOS Keychain.\n"
        : `Stored GitHub token in ${auth.configFilePath}.\n`,
    );
    return true;
  }

  if (argv[1] === "logout") {
    await clearGitHubToken();
    process.stdout.write("Cleared stored GitHub auth.\n");
    return true;
  }

  throw new Error(`Unknown auth command: ${argv.slice(1).join(" ") || "auth"}`);
}

async function resolveAuthToken(argv: readonly string[]): Promise<string | undefined> {
  const tokenFlagIndex = argv.indexOf("--token");
  if (tokenFlagIndex >= 0) {
    return argv[tokenFlagIndex + 1]?.trim() || undefined;
  }

  if (argv.includes("--token-stdin")) {
    const stdin = await readStandardInput();
    const token = stdin.trim();
    return token === "" ? undefined : token;
  }

  const token =
    process.env.DIFFDIFF_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  return token?.trim() === "" ? undefined : token?.trim();
}

async function readStandardInput(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks: Uint8Array[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

void main();
