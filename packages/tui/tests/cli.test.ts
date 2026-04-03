import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const execFileAsync = promisify(execFile);
const testsDirectory = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testsDirectory, "../src/cli.tsx");
const repositoryRoot = resolve(testsDirectory, "../../..");

describe("diffdiff CLI help", () => {
  test("supports -h on the root command", async () => {
    const { stdout } = await runCli(["-h"]);

    expect(stdout).toContain("Usage: diffdiff");
    expect(stdout).toContain("[target]");
    expect(stdout).toContain("-H, --head <ref>");
    expect(stdout).toContain("auth");
    expect(stdout).toContain("session");
    expect(stdout).toContain("tui");
  });

  test("supports -h on the tui subcommand", async () => {
    const { stdout } = await runCli(["tui", "-h"]);

    expect(stdout).toContain("Usage: diffdiff tui");
    expect(stdout).toContain("[target]");
    expect(stdout).toContain("-r, --repo <path>");
    expect(stdout).toContain("-b, --base <ref>");
    expect(stdout).toContain("-H, --head <ref>");
  });

  test("supports -h on the auth command and its subcommands", async () => {
    const authHelp = await runCli(["auth", "-h"]);
    const loginHelp = await runCli(["auth", "login", "-h"]);
    const logoutHelp = await runCli(["auth", "logout", "-h"]);

    expect(authHelp.stdout).toContain("Usage: diffdiff auth");
    expect(authHelp.stdout).toContain("login");
    expect(authHelp.stdout).toContain("logout");

    expect(loginHelp.stdout).toContain("Usage: diffdiff auth login");
    expect(loginHelp.stdout).toContain("--token <token>");
    expect(loginHelp.stdout).toContain("--token-stdin");

    expect(logoutHelp.stdout).toContain("Usage: diffdiff auth logout");
  });

  test("supports -h on the session command and its subcommands", async () => {
    const sessionHelp = await runCli(["session", "-h"]);
    const removeHelp = await runCli(["session", "remove", "-h"]);
    const removeAllHelp = await runCli(["session", "remove-all", "-h"]);

    expect(sessionHelp.stdout).toContain("Usage: diffdiff session");
    expect(sessionHelp.stdout).toContain("list");
    expect(sessionHelp.stdout).toContain("remove");
    expect(sessionHelp.stdout).toContain("remove-all");
    expect(sessionHelp.stdout).toContain("--json");

    expect(removeHelp.stdout).toContain("Usage: diffdiff session remove");
    expect(removeHelp.stdout).toContain("<session-id>");

    expect(removeAllHelp.stdout).toContain("Usage: diffdiff session remove-all");
  });

  test("outputs JSON for the session list subcommand", async () => {
    const homeDirectory = await mkdtemp(join(tmpdir(), "diffdiff-cli-home-"));

    try {
      const sessionDirectory = join(homeDirectory, ".diffdiff", "sessions");
      const logFilePath = join(homeDirectory, ".diffdiff", "logs", "log-session-a.jsonl");
      const sessionFilePath = join(sessionDirectory, "session-session-a.json");
      await mkdir(sessionDirectory, { recursive: true });
      await writeFile(
        sessionFilePath,
        `${JSON.stringify(
          {
            command: ["diffdiff"],
            comparison: {
              base: "HEAD",
              head: "working tree",
              mode: "working-tree",
              range: "HEAD...working tree",
            },
            cwd: "/tmp/diffdiff",
            currentBranch: "main",
            endedAt: "2026-04-01T00:00:01.000Z",
            logFilePath,
            pid: 123,
            repoPath: "/tmp/diffdiff",
            repositoryName: "diffdiff",
            repositoryRootPath: "/tmp/diffdiff",
            sessionFilePath,
            sessionId: "session-a",
            startedAt: "2026-04-01T00:00:00.000Z",
            statusMessage: "Exited diffdiff.",
            updatedAt: "2026-04-01T00:00:01.000Z",
          },
          null,
          2,
        )}\n`,
      );

      const { stdout } = await runCli(["session", "list", "--json"], {
        HOME: homeDirectory,
      });

      expect(JSON.parse(stdout)).toMatchObject([
        {
          comparison: {
            base: "HEAD",
            head: "working tree",
          },
          currentBranch: "main",
          repositoryName: "diffdiff",
          sessionId: "session-a",
          state: "ended",
        },
      ]);
    } finally {
      await rm(homeDirectory, { force: true, recursive: true });
    }
  });
});

async function runCli(args: readonly string[], envOverrides: NodeJS.ProcessEnv = {}) {
  return await execFileAsync("bun", [cliPath, ...args], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ...envOverrides,
      NO_COLOR: "1",
    },
  });
}
