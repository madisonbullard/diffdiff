import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
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
    expect(stdout).toContain("-H, --head <ref>");
    expect(stdout).toContain("auth");
    expect(stdout).toContain("session");
    expect(stdout).toContain("tui");
  });

  test("supports -h on the tui subcommand", async () => {
    const { stdout } = await runCli(["tui", "-h"]);

    expect(stdout).toContain("Usage: diffdiff tui");
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
});

async function runCli(args: readonly string[]) {
  return await execFileAsync("bun", [cliPath, ...args], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      NO_COLOR: "1",
    },
  });
}
