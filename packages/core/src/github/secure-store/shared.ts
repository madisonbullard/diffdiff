import { spawn } from "node:child_process";

export interface SecureStoreCommandResult {
  stderr: string;
  stdout: string;
}

export interface SecureStoreCommandOptions {
  env?: NodeJS.ProcessEnv;
  input?: string;
}

export type SecureStoreCommandRunner = (
  command: string,
  args: string[],
  options?: SecureStoreCommandOptions,
) => Promise<SecureStoreCommandResult>;

const SECURE_STORE_SERVICE_PREFIX = "diffdiff:github-token:";

export function getSecureStoreServiceName(host: string): string {
  return `${SECURE_STORE_SERVICE_PREFIX}${host}`;
}

export async function runSecureStoreCommand(
  command: string,
  args: string[],
  options: SecureStoreCommandOptions = {},
): Promise<SecureStoreCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: "pipe",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stderr, stdout });
        return;
      }

      const error = new Error(`Failed to run ${command}.`) as Error & {
        code?: number;
        stderr?: string;
        stdout?: string;
      };
      error.code = code ?? undefined;
      error.stderr = stderr;
      error.stdout = stdout;
      reject(error);
    });

    child.stdin.end(options.input);
  });
}
