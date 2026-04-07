import { listDiffdiffSessions } from "@madisonbullard/diffdiff-core";

interface AuthLoginCommandOptions {
  token?: string;
  tokenStdin?: boolean;
}

interface SessionListCommandOptions {
  json?: boolean;
}

export async function printSessionList(options: SessionListCommandOptions): Promise<void> {
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

export async function resolveAuthToken(
  options: AuthLoginCommandOptions,
): Promise<string | undefined> {
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

export function describeSecureStore(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "the macOS Keychain";
    case "linux":
      return "the Secret Service keyring";
    case "win32":
      return "Windows Credential Manager";
    default:
      return "the OS credential store";
  }
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

export type { AuthLoginCommandOptions, SessionListCommandOptions };
