import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CommandError } from "./errors.ts";
import { logDiffdiffError, logDiffdiffInfo, logDiffdiffVerbose } from "./logging.ts";

const execFileAsync = promisify(execFile);
const GIT_LOCAL_ENV_KEYS = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_PARAMETERS",
  "GIT_DIR",
  "GIT_GRAFT_FILE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_INTERNAL_SUPER_PREFIX",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_OBJECT_DIRECTORY",
  "GIT_PREFIX",
  "GIT_REPLACE_REF_BASE",
  "GIT_SHALLOW_FILE",
  "GIT_WORK_TREE",
] as const;

interface RunCommandOptions {
  cwd: string;
  allowedExitCodes?: readonly number[];
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<string> {
  const startedAt = Date.now();
  logDiffdiffVerbose("command", "command_started", {
    allowedExitCodes: options.allowedExitCodes,
    args,
    command,
    cwd: options.cwd,
  });

  try {
    const { stderr, stdout } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: buildCommandEnv(command),
      maxBuffer: 32 * 1024 * 1024,
      encoding: "utf8",
    });

    const stdoutSummary = summarizeTextOutput(stdout);
    const stderrSummary = summarizeTextOutput(stderr);

    logDiffdiffInfo("command", "command_completed", {
      args,
      command,
      cwd: options.cwd,
      durationMs: Date.now() - startedAt,
      stderr: stderrSummary,
      stdout: stdoutSummary,
    });
    logDiffdiffVerbose("command", "command_output", {
      args,
      command,
      cwd: options.cwd,
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
      const stdout = typeof failure.stdout === "string" ? failure.stdout : "";
      const stderrOutput = typeof failure.stderr === "string" ? failure.stderr : "";

      logDiffdiffInfo("command", "command_completed_with_allowed_exit_code", {
        args,
        command,
        cwd: options.cwd,
        durationMs: Date.now() - startedAt,
        exitCode,
        stderr: summarizeTextOutput(stderrOutput),
        stdout: summarizeTextOutput(stdout),
      });
      logDiffdiffVerbose("command", "command_output", {
        args,
        command,
        cwd: options.cwd,
        exitCode,
        stderr: stderrOutput,
        stdout,
      });
      return stdout;
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

function buildCommandEnv(command: string): NodeJS.ProcessEnv {
  if (command !== "git") {
    return process.env;
  }

  const env = { ...process.env };
  for (const key of GIT_LOCAL_ENV_KEYS) {
    delete env[key];
  }

  for (const key of Object.keys(env)) {
    if (/^GIT_CONFIG_KEY_\d+$/u.test(key) || /^GIT_CONFIG_VALUE_\d+$/u.test(key)) {
      delete env[key];
    }
  }

  return env;
}

function summarizeTextOutput(text: string): {
  bytes: number;
  lineCount: number;
  preview?: string;
} {
  if (text === "") {
    return {
      bytes: 0,
      lineCount: 0,
    };
  }

  const normalized = text.replace(/\r\n/gu, "\n");
  const lines = normalized.endsWith("\n")
    ? normalized.slice(0, -1).split("\n")
    : normalized.split("\n");

  return {
    bytes: Buffer.byteLength(text, "utf8"),
    lineCount: lines.length,
    preview: lines.slice(0, 3).join("\n"),
  };
}
