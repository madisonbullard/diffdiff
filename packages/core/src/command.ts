import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CommandError } from "./errors.ts";
import { logDiffdiffError, logDiffdiffInfo } from "./logging.ts";

const execFileAsync = promisify(execFile);

export interface RunCommandOptions {
  cwd: string;
  allowedExitCodes?: readonly number[];
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<string> {
  const startedAt = Date.now();
  logDiffdiffInfo("command", "command_started", {
    allowedExitCodes: options.allowedExitCodes,
    args,
    command,
    cwd: options.cwd,
  });

  try {
    const { stderr, stdout } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: process.env,
      maxBuffer: 32 * 1024 * 1024,
      encoding: "utf8",
    });

    logDiffdiffInfo("command", "command_completed", {
      args,
      command,
      cwd: options.cwd,
      durationMs: Date.now() - startedAt,
      stderr,
      stdout,
    });

    return stdout;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };

    const exitCode = typeof failure.code === "number" ? failure.code : undefined;
    const stderr = typeof failure.stderr === "string" ? failure.stderr.trim() : "";

    if (exitCode != null && options.allowedExitCodes?.includes(exitCode)) {
      logDiffdiffInfo("command", "command_completed_with_allowed_exit_code", {
        args,
        command,
        cwd: options.cwd,
        durationMs: Date.now() - startedAt,
        exitCode,
        stderr,
        stdout: typeof failure.stdout === "string" ? failure.stdout : "",
      });
      return typeof failure.stdout === "string" ? failure.stdout : "";
    }

    logDiffdiffError("command", "command_failed", failure, {
      args,
      command,
      cwd: options.cwd,
      durationMs: Date.now() - startedAt,
      exitCode,
      stderr,
      stdout: typeof failure.stdout === "string" ? failure.stdout : "",
    });

    throw new CommandError(
      stderr || `Failed to run ${command}.`,
      [command, ...args].join(" "),
      stderr,
      exitCode,
    );
  }
}
