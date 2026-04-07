#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import {
  clearGitHubToken,
  ensureComparisonRefsAvailable,
  flushDiffdiffLogs,
  GitHubPullRequestService,
  getRepositorySearchPath,
  appendReviewComposerHistory,
  loadDiffdiffPreferences,
  loadReviewComposerHistory,
  openFileInEditor,
  openExternalEditor,
  loadReviewSession,
  loadReviewCache,
  logDiffdiffError,
  logDiffdiffInfo,
  markDiffdiffSessionEnded,
  removeAllDiffdiffSessions,
  removeDiffdiffSession,
  resolveGitHubAuth,
  resolveStartupOptions,
  startDiffdiffLogging,
  storeGitHubToken,
  syncGitRemotes,
  GitRepositoryProvider,
} from "@madisonbullard/diffdiff-core";
import { Command } from "commander";
import packageJson from "../package.json";
import {
  describeSecureStore,
  printSessionList,
  resolveAuthToken,
  type AuthLoginCommandOptions,
  type SessionListCommandOptions,
} from "./cli-helpers.ts";
import { getStartupOptionValues } from "./command-options.ts";
import { resolveLaunchOptionsFromTarget } from "./launch-target.ts";
import { loadStartupPreparedReviewSession } from "./startup-session.ts";
import { StartupScreen } from "./startup-screen.tsx";
import {
  getStartupTraceNow,
  createStartupInstrumentation,
  markStartupInstrumentationPhase,
  summarizeStartupInstrumentation,
  type StartupInstrumentation,
  type StartupInstrumentationPhase,
} from "./startup-tracing.ts";
import type { LaunchOptions } from "./types.ts";

interface LaunchCommandOptions {
  base?: string;
  head?: string;
  repo?: string;
  verbose?: boolean;
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
  program.argument(
    "[target]",
    "PR shortcut, PR number, GitHub PR URL, owner/repo/number, or repository path.",
  );
  program.action(
    async (target: string | undefined, _options: LaunchCommandOptions, command: Command) => {
      await launchTui(
        await resolveLaunchOptionsFromTarget(
          target,
          resolveStartupOptions(getStartupOptionValues(command)),
        ),
      );
    },
  );

  const tuiCommand = program
    .command("tui")
    .description("Launch the diffdiff terminal UI for a repository comparison.");
  addStartupOptions(tuiCommand);
  tuiCommand.argument(
    "[target]",
    "PR shortcut, PR number, GitHub PR URL, owner/repo/number, or repository path.",
  );
  tuiCommand.action(
    async (target: string | undefined, _options: LaunchCommandOptions, command: Command) => {
      await launchTui(
        await resolveLaunchOptionsFromTarget(
          target,
          resolveStartupOptions(getStartupOptionValues(command)),
        ),
      );
    },
  );

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
  command.option("-v, --verbose", "Preserve full command and API payloads in session logs.");
}

async function launchTui(options: LaunchOptions): Promise<void> {
  let launchOptions = options;
  let startupInstrumentation = createStartupInstrumentation();
  const logSession = await startDiffdiffLogging({
    command: process.argv,
    cwd: process.cwd(),
    verbose: launchOptions.verbose,
  });

  logDiffdiffInfo("cli", "tui_launch_started", {
    logFilePath: logSession?.logFilePath,
    options: launchOptions,
  });

  const repository = await new GitRepositoryProvider().detectRepository(
    getRepositorySearchPath(launchOptions.repoPath),
  );
  if (repository != null) {
    const preparedOptions = await ensureComparisonRefsAvailable(
      repository.rootPath,
      launchOptions,
      (message) => {
        process.stdout.write(`${message}\n`);
      },
    );
    if (preparedOptions !== launchOptions) {
      process.stdout.write("\n");
      logDiffdiffInfo("cli", "tui_launch_options_resolved_from_remote_refs", {
        initialOptions: launchOptions,
        logFilePath: logSession?.logFilePath,
        resolvedOptions: preparedOptions,
      });
      launchOptions = preparedOptions;
    }
  }

  // Keep the initial module graph light so help/version stay instant, then overlap the
  // background-color probe with the heavier TUI/runtime imports for the real app launch.
  const themeModulePromise = import("./theme.ts");
  const runtimeModulesPromise = Promise.all([
    import("./app/DiffdiffApp.tsx"),
    import("./diff/prepare-review-session.ts"),
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
  startupInstrumentation = logStartupPhase(startupInstrumentation, "importsReadyAt");
  const mode = await modePromise;
  const themeName = themeModule.getPierreThemeName(mode);
  const fallbackTheme = themeModule.getUiTheme(themeName);

  const renderer = await createCliRenderer({
    useAlternateScreen: true,
    useConsole: false,
    exitOnCtrlC: true,
    backgroundColor: "transparent",
  });
  startupInstrumentation = logStartupPhase(startupInstrumentation, "rendererReadyAt");

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
    startupInstrumentation = logStartupPhase(startupInstrumentation, "themeReadyAt");

    renderer.setBackgroundColor(theme.appBackground);
    const root = createRoot(renderer);

    root.render(
      <StartupScreen
        chromeBackground={theme.chromeBackground}
        onFrameDelay={(details) => {
          logDiffdiffInfo("perf", "startup_animation_frame_delayed", {
            ...details,
            startup: summarizeStartupInstrumentation(startupInstrumentation),
          });
        }}
        path={launchOptions.repoPath ?? process.cwd()}
        text={theme.text}
        textMuted={theme.textMuted}
      />,
    );
    startupInstrumentation = logStartupPhase(startupInstrumentation, "startupScreenRenderedAt");

    const loadSession = (nextOptions: LaunchOptions) =>
      loadStartupPreparedReviewSession(
        loadPreparedReviewSession,
        nextOptions,
        themeName,
        theme,
        syntaxPalette,
      );
    const gitHubPullRequestService = new GitHubPullRequestService();
    const isGitHubAuthenticated = (await resolveGitHubAuth({ host: "github.com" })) != null;
    const initialSession = await loadSession(launchOptions);
    startupInstrumentation = logStartupPhase(startupInstrumentation, "sessionPreparedAt");
    const initialPreferences = await loadDiffdiffPreferences();
    startupInstrumentation = logStartupPhase(startupInstrumentation, "preferencesLoadedAt");

    const initialReviewCache = await loadReviewCache({
      repositoryRootPath: initialSession.repository.rootPath,
      base: initialSession.comparison.base,
      head: initialSession.comparison.head,
    });
    startupInstrumentation = logStartupPhase(startupInstrumentation, "reviewCacheLoadedAt");
    startupInstrumentation = logStartupPhase(startupInstrumentation, "appRenderRequestedAt");

    root.render(
      <DiffdiffApp
        addPullRequestComment={(reviewSession, body) =>
          gitHubPullRequestService.addPullRequestComment(reviewSession, body)
        }
        addReviewThread={(reviewSession, anchor, body) =>
          gitHubPullRequestService
            .addPendingReviewThread(reviewSession, anchor, body)
            .then(() => undefined)
        }
        initialGitHubPreferences={initialPreferences.github}
        initialUserKeymapConfig={initialPreferences.keys}
        isGitHubAuthenticated={isGitHubAuthenticated}
        initialReviewCache={initialReviewCache}
        initialOptions={launchOptions}
        initialSession={initialSession}
        listGitHubPullRequests={() => gitHubPullRequestService.listDashboardPullRequests()}
        loadReviewComposerHistory={() => loadReviewComposerHistory()}
        loadComparisonBrowserData={async (nextOptions) => {
          const session = await loadReviewSession(nextOptions);
          return {
            branches: session.branches,
            commits: session.commits,
            workingTreeSummary: session.workingTreeSummary,
          };
        }}
        loadSession={loadSession}
        logFilePath={logSession?.logFilePath}
        markFileAsViewed={(reviewSession, path) =>
          gitHubPullRequestService.markFileAsViewed(reviewSession, path)
        }
        mergePullRequest={(reviewSession, input) =>
          gitHubPullRequestService.mergePullRequest(reviewSession, input)
        }
        appendReviewComposerHistory={(entry) => appendReviewComposerHistory(entry)}
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
        openExternalEditor={(repositoryRootPath, initialValue, options) =>
          openExternalEditor({
            fileExtension: options?.fileExtension,
            initialValue,
            repositoryRootPath,
            tempFileName: options?.tempFileName,
          })
        }
        openFileInEditor={(repositoryRootPath, filePath) =>
          openFileInEditor({
            filePath,
            repositoryRootPath,
          })
        }
        resolveLaunchTarget={(target, startupOptions) =>
          resolveLaunchOptionsFromTarget(target, startupOptions, {
            promptForRepositoryPath: async () => undefined,
          })
        }
        replyToReviewComment={(reviewSession, commentId, body) =>
          gitHubPullRequestService.replyToReviewComment(reviewSession, commentId, body)
        }
        removeCleanupRefs={(repositoryRootPath, refs) =>
          gitHubPullRequestService.removeCleanupRefs(repositoryRootPath, refs)
        }
        submitPendingReview={(reviewSession, event, body) =>
          gitHubPullRequestService.submitPendingReview(reviewSession, event, body)
        }
        startupInstrumentation={startupInstrumentation}
        syncRemotes={(repositoryRootPath) =>
          syncGitRemotes(repositoryRootPath).then(() => undefined)
        }
        syntaxStyle={syntaxStyle}
        theme={theme}
        unmarkFileAsViewed={(reviewSession, path) =>
          gitHubPullRequestService.unmarkFileAsViewed(reviewSession, path)
        }
      />,
    );

    setTimeout(() => {
      logDiffdiffInfo("perf", "startup_app_render_settled", {
        startup: summarizeStartupInstrumentation(startupInstrumentation, getStartupTraceNow()),
      });
    }, 0);
  } catch (error) {
    logDiffdiffError("cli", "tui_launch_failed", error, {
      logFilePath: logSession?.logFilePath,
      options: launchOptions,
    });
    await markDiffdiffSessionEnded("diffdiff exited after a launch error.");
    await flushDiffdiffLogs();
    renderer.destroy();
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`diffdiff: ${message}\n`);
    process.exitCode = 1;
  }
}

function logStartupPhase(
  startupInstrumentation: StartupInstrumentation,
  phase: StartupInstrumentationPhase,
): StartupInstrumentation {
  const nextInstrumentation = markStartupInstrumentationPhase(startupInstrumentation, phase);
  logDiffdiffInfo("perf", "startup_phase_completed", {
    phase,
    startup: summarizeStartupInstrumentation(nextInstrumentation),
  });
  return nextInstrumentation;
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
    auth.tokenSource === "secure-store"
      ? `Stored GitHub token in ${describeSecureStore(process.platform)}.\n`
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

void main().catch(async (error) => {
  logDiffdiffError("cli", "fatal_error", error);
  await markDiffdiffSessionEnded("diffdiff exited after a fatal error.");
  await flushDiffdiffLogs();
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`diffdiff: ${message}\n`);
  process.exitCode = 1;
});
