#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import {
  clearGitHubToken,
  flushDiffdiffLogs,
  GitHubPullRequestService,
  listDiffdiffSessions,
  logDiffdiffError,
  logDiffdiffInfo,
  markDiffdiffSessionEnded,
  removeAllDiffdiffSessions,
  removeDiffdiffSession,
  resolveStartupOptions,
  startDiffdiffLogging,
  storeGitHubToken,
} from "@diffdiff/core";
import type { StartupOptions } from "@diffdiff/core";
import { Command } from "commander";
import packageJson from "../package.json";

interface LaunchCommandOptions {
  base?: string;
  head?: string;
  repo?: string;
}

interface AuthLoginCommandOptions {
  token?: string;
  tokenStdin?: boolean;
}

interface SessionListCommandOptions {
  json?: boolean;
}

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
  const program = createProgram();
  await program.parseAsync(process.argv);
}

function createProgram(): Command {
  const program = new Command();

  program
    .name("diffdiff")
    .description("A git-backed terminal code review tool.")
    .version(packageJson.version)
    .showHelpAfterError();

  addStartupOptions(program);
  program.action(async (options: LaunchCommandOptions) => {
    await launchTui(resolveStartupOptions(options));
  });

  const tuiCommand = program
    .command("tui")
    .description("Launch the diffdiff terminal UI for a repository comparison.");
  addStartupOptions(tuiCommand);
  tuiCommand.action(async (options: LaunchCommandOptions) => {
    await launchTui(resolveStartupOptions(options));
  });

  const authCommand = program.command("auth").description("Manage local GitHub authentication.");
  authCommand.action(() => {
    authCommand.outputHelp();
  });
  authCommand
    .command("login")
    .description("Store a GitHub token for PR review actions.")
    .option("--token <token>", "Read the GitHub token directly from the command line.")
    .option("--token-stdin", "Read the GitHub token from standard input.")
    .action(async (options: AuthLoginCommandOptions) => {
      await runAuthLogin(options);
    });
  authCommand
    .command("logout")
    .description("Clear the stored GitHub token.")
    .action(async () => {
      await runAuthLogout();
    });

  const sessionCommand = program
    .command("session")
    .description("Inspect and clean up local diffdiff session logs and metadata.")
    .option("--json", "Output machine-readable JSON when listing sessions.");
  sessionCommand.action(async (_options: SessionListCommandOptions, command: Command) => {
    await printSessionList(command.optsWithGlobals());
  });
  sessionCommand
    .command("list")
    .description("List active and historical local diffdiff sessions.")
    .option("--json", "Output machine-readable JSON.")
    .action(async (_options: SessionListCommandOptions, command: Command) => {
      await printSessionList(command.optsWithGlobals());
    });
  sessionCommand
    .command("remove")
    .description("Remove one session record and its log file.")
    .argument("<session-id>", "The diffdiff session id to remove.")
    .action(async (sessionId: string) => {
      const removed = await removeDiffdiffSession(sessionId);
      if (!removed) {
        throw new Error(`No diffdiff session found for ${sessionId}.`);
      }

      process.stdout.write(`Removed session ${sessionId}.\n`);
    });
  sessionCommand
    .command("remove-all")
    .description("Remove all local diffdiff session records and logs.")
    .action(async () => {
      const removedCount = await removeAllDiffdiffSessions();
      process.stdout.write(
        removedCount === 0
          ? "No diffdiff sessions found.\n"
          : `Removed ${removedCount} diffdiff session${removedCount === 1 ? "" : "s"}.\n`,
      );
    });

  return program;
}

function addStartupOptions(command: Command): void {
  command.option("-r, --repo <path>", "Path inside the repository to review.");
  command.option("-b, --base <ref>", "Base branch or commit to compare from.");
  command.option("-H, --head <ref>", "Head branch or commit to compare to.");
}

async function launchTui(options: StartupOptions): Promise<void> {
  const logSession = await startDiffdiffLogging({
    command: process.argv,
    cwd: process.cwd(),
  });

  logDiffdiffInfo("cli", "tui_launch_started", {
    logFilePath: logSession?.logFilePath,
    options,
  });

  // Keep the initial module graph light so help/version stay instant, then overlap the
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

    root.render(
      <StartupScreen
        chromeBackground={theme.chromeBackground}
        path={options.repoPath ?? process.cwd()}
        text={theme.text}
        textMuted={theme.textMuted}
      />,
    );

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
        logFilePath={logSession?.logFilePath}
        onExit={() => {
          logDiffdiffInfo("cli", "tui_exit_requested", {
            logFilePath: logSession?.logFilePath,
          });
          void markDiffdiffSessionEnded().finally(() => {
            void flushDiffdiffLogs().finally(() => {
              renderer.destroy();
              process.exit(0);
            });
          });
        }}
        submitPendingReview={(reviewSession, event, body) =>
          gitHubPullRequestService.submitPendingReview(reviewSession, event, body)
        }
        syntaxStyle={syntaxStyle}
        theme={theme}
      />,
    );
  } catch (error) {
    logDiffdiffError("cli", "tui_launch_failed", error, {
      logFilePath: logSession?.logFilePath,
      options,
    });
    await markDiffdiffSessionEnded("diffdiff exited after a launch error.");
    await flushDiffdiffLogs();
    renderer.destroy();
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`diffdiff: ${message}\n`);
    process.exitCode = 1;
  }
}

async function runAuthLogin(options: AuthLoginCommandOptions): Promise<void> {
  const logSession = await startDiffdiffLogging({
    command: process.argv,
    cwd: process.cwd(),
  });

  const token = await resolveAuthToken(options);
  if (token == null) {
    throw new Error("No GitHub token provided. Pass --token-stdin or set DIFFDIFF_GITHUB_TOKEN.");
  }

  const auth = await storeGitHubToken(token);
  logDiffdiffInfo("cli", "auth_login_completed", {
    host: auth.host,
    logFilePath: logSession?.logFilePath,
    tokenSource: auth.tokenSource,
  });
  await markDiffdiffSessionEnded("Completed diffdiff auth login.");
  await flushDiffdiffLogs();
  process.stdout.write(
    auth.tokenSource === "keychain"
      ? "Stored GitHub token in the macOS Keychain.\n"
      : `Stored GitHub token in ${auth.configFilePath}.\n`,
  );
}

async function runAuthLogout(): Promise<void> {
  const logSession = await startDiffdiffLogging({
    command: process.argv,
    cwd: process.cwd(),
  });

  await clearGitHubToken();
  logDiffdiffInfo("cli", "auth_logout_completed", {
    logFilePath: logSession?.logFilePath,
  });
  await markDiffdiffSessionEnded("Completed diffdiff auth logout.");
  await flushDiffdiffLogs();
  process.stdout.write("Cleared stored GitHub auth.\n");
}

async function printSessionList(options: SessionListCommandOptions): Promise<void> {
  const sessions = await listDiffdiffSessions();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(sessions, null, 2)}\n`);
    return;
  }

  if (sessions.length === 0) {
    process.stdout.write("No diffdiff sessions found.\n");
    return;
  }

  process.stdout.write(`${formatSessionList(sessions)}\n`);
}

function formatSessionList(sessions: Awaited<ReturnType<typeof listDiffdiffSessions>>): string {
  return sessions
    .map((session) => {
      const comparisonLabel =
        session.comparison == null
          ? "unknown"
          : `${session.comparison.base} -> ${session.comparison.head} (${session.comparison.mode})`;
      const lines = [
        `${session.sessionId}  ${session.state}  ${session.repositoryName ?? "unknown repo"}`,
        `  activity: ${session.statusMessage ?? "No activity recorded."}`,
        `  focus: ${session.selectedFilePath ?? "No file selected."}`,
        `  comparison: ${comparisonLabel}`,
        `  branch: ${session.currentBranch ?? "detached"}`,
        `  updated: ${session.updatedAt}`,
        `  log: ${session.logFilePath}`,
      ];

      if (session.activeOverlay != null) {
        lines.splice(5, 0, `  overlay: ${session.activeOverlay}`);
      }

      if (session.lastErrorMessage != null) {
        lines.push(`  last error: ${session.lastErrorMessage}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

async function resolveAuthToken(options: AuthLoginCommandOptions): Promise<string | undefined> {
  if (options.token != null) {
    return options.token.trim() || undefined;
  }

  if (options.tokenStdin) {
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

void main().catch(async (error) => {
  logDiffdiffError("cli", "fatal_error", error);
  await markDiffdiffSessionEnded("diffdiff exited after a fatal error.");
  await flushDiffdiffLogs();
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`diffdiff: ${message}\n`);
  process.exitCode = 1;
});
