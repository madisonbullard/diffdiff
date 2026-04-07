import type { ComparisonInfo } from "@madisonbullard/diffdiff-core";
import { copyTextToClipboard } from "./clipboard.ts";

export interface SessionReopenCommandInput {
  comparison: Pick<ComparisonInfo, "base" | "head" | "mode">;
  initialListMode?: "pull-requests";
  repositoryRootPath: string;
  verbose?: boolean;
}

interface CopySessionReopenCommandOptions {
  copyText?: (text: string) => Promise<boolean>;
  platform?: NodeJS.Platform;
}

export async function copySessionReopenCommand(
  input: SessionReopenCommandInput,
  options: CopySessionReopenCommandOptions = {},
): Promise<string> {
  const reopenCommand = buildSessionReopenCommand(input, options.platform);
  const copied = await (options.copyText ?? copyTextToClipboard)(reopenCommand);
  if (!copied) {
    throw new Error("Unable to copy the reopen command.");
  }

  return reopenCommand;
}

export function buildSessionReopenCommand(
  input: SessionReopenCommandInput,
  platform: NodeJS.Platform = process.platform,
): string {
  const diffdiffCommand = buildSessionDiffdiffCommand(input);

  switch (platform) {
    case "darwin":
      return [
        "osascript",
        "-e",
        quotePosixShellArgument('tell application "Terminal" to activate'),
        "-e",
        quotePosixShellArgument(
          `tell application "Terminal" to do script "${escapeAppleScriptString(diffdiffCommand)}"`,
        ),
      ].join(" ");
    case "linux":
      return buildLinuxTerminalOpenCommand(diffdiffCommand);
    case "win32":
      return buildWindowsTerminalOpenCommand(diffdiffCommand);
    default:
      return diffdiffCommand;
  }
}

export function buildSessionDiffdiffCommand(input: SessionReopenCommandInput): string {
  if (input.repositoryRootPath === "") {
    throw new Error("A repository root path is required to reopen the current review.");
  }

  const args = ["diffdiff", "tui", "--repo", input.repositoryRootPath];

  if (input.initialListMode === "pull-requests") {
    args.push("pr");
  }

  if (input.comparison.mode === "range") {
    args.push("--base", input.comparison.base, "--head", input.comparison.head);
  }

  if (input.verbose === true) {
    args.push("--verbose");
  }

  return args.map(quotePosixShellArgument).join(" ");
}

function quotePosixShellArgument(value: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/u.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildLinuxTerminalOpenCommand(command: string): string {
  const launchers = [
    (innerCommand: string) =>
      `x-terminal-emulator -e sh -lc ${quotePosixShellArgument(innerCommand)}`,
    (innerCommand: string) => `gnome-terminal -- sh -lc ${quotePosixShellArgument(innerCommand)}`,
    (innerCommand: string) => `konsole -e sh -lc ${quotePosixShellArgument(innerCommand)}`,
    (innerCommand: string) => `alacritty -e sh -lc ${quotePosixShellArgument(innerCommand)}`,
    (innerCommand: string) => `wezterm start -- sh -lc ${quotePosixShellArgument(innerCommand)}`,
    (innerCommand: string) => `xterm -e sh -lc ${quotePosixShellArgument(innerCommand)}`,
  ] as const;
  const launcherNames = [
    "x-terminal-emulator",
    "gnome-terminal",
    "konsole",
    "alacritty",
    "wezterm",
    "xterm",
  ] as const;

  const script = launcherNames
    .map(
      (launcherName, index) =>
        `if command -v ${launcherName} >/dev/null 2>&1; then exec ${launchers[index]!(command)}; fi`,
    )
    .concat([
      `printf '%s\n' 'No supported terminal emulator was found to reopen diffdiff.' >&2`,
      "exit 1",
    ])
    .join("; ");

  return `sh -lc ${quotePosixShellArgument(script)}`;
}

function buildWindowsTerminalOpenCommand(command: string): string {
  const innerCommand = [
    "Start-Process",
    "powershell.exe",
    "-ArgumentList",
    "@(",
    quotePowerShellString("-NoExit"),
    ",",
    quotePowerShellString("-Command"),
    ",",
    quotePowerShellString(buildWindowsDiffdiffCommand(command)),
    ")",
  ].join(" ");

  return [
    "powershell.exe",
    "-NoLogo",
    "-NoProfile",
    "-Command",
    quotePowerShellString(innerCommand),
  ].join(" ");
}

function buildWindowsDiffdiffCommand(command: string): string {
  return command.replace(/(^|\s)'([^']*)'/gu, (_, prefix: string, value: string) => {
    const unescapedValue = value.replace(/'\\''/g, "'");
    return `${prefix}${quotePowerShellString(unescapedValue)}`;
  });
}

function quotePowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
