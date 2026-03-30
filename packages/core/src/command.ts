import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CommandError } from "./errors.ts";

const execFileAsync = promisify(execFile);

export interface RunCommandOptions {
  cwd: string;
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: process.env,
      maxBuffer: 32 * 1024 * 1024,
      encoding: "utf8",
    });

    return stdout;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      code?: number | string;
      stderr?: string;
    };

    const exitCode = typeof failure.code === "number" ? failure.code : undefined;
    const stderr = typeof failure.stderr === "string" ? failure.stderr.trim() : "";

    throw new CommandError(
      stderr || `Failed to run ${command}.`,
      [command, ...args].join(" "),
      stderr,
      exitCode,
    );
  }
}
