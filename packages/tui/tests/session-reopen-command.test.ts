import { describe, expect, test, vi } from "vite-plus/test";
import {
  buildSessionDiffdiffCommand,
  buildSessionReopenCommand,
  copySessionReopenCommand,
  type SessionReopenCommandInput,
} from "../src/session-reopen-command.ts";

describe("buildSessionDiffdiffCommand", () => {
  test("captures repo, base, head, and verbose for range sessions", () => {
    const command = buildSessionDiffdiffCommand({
      comparison: {
        base: "origin/main",
        head: "feature/review-window",
        mode: "range",
      },
      repositoryRootPath: "/Users/madison/code/diffdiff",
      verbose: true,
    });

    expect(command).toBe(
      "diffdiff tui --repo /Users/madison/code/diffdiff --base origin/main --head feature/review-window --verbose",
    );
  });

  test("quotes repository paths and omits base/head for working tree sessions", () => {
    const command = buildSessionDiffdiffCommand({
      comparison: {
        base: "HEAD",
        head: "working tree",
        mode: "working-tree",
      },
      repositoryRootPath: "/Users/madison/code/repo with spaces",
    });

    expect(command).toBe("diffdiff tui --repo '/Users/madison/code/repo with spaces'");
  });

  test("preserves PR list launch mode in the reopen command", () => {
    const command = buildSessionDiffdiffCommand({
      comparison: {
        base: "origin/main",
        head: "feature/review-window",
        mode: "range",
      },
      initialListMode: "pull-requests",
      repositoryRootPath: "/Users/madison/code/diffdiff",
    });

    expect(command).toBe(
      "diffdiff tui --repo /Users/madison/code/diffdiff pr --base origin/main --head feature/review-window",
    );
  });

  test("requires a repository root path to reopen the current review", () => {
    expect(() =>
      buildSessionDiffdiffCommand({
        comparison: {
          base: "origin/main",
          head: "feature/review-window",
          mode: "range",
        },
        repositoryRootPath: "",
      }),
    ).toThrow("A repository root path is required to reopen the current review.");
  });
});

describe("buildSessionReopenCommand", () => {
  test("wraps the diffdiff command in a macOS Terminal opener", () => {
    const command = buildSessionReopenCommand(
      {
        comparison: {
          base: "origin/main",
          head: "feature/review-window",
          mode: "range",
        },
        repositoryRootPath: "/Users/madison/code/diffdiff",
      },
      "darwin",
    );

    expect(command).toContain("osascript -e");
    expect(command).toContain('tell application "Terminal" to activate');
    expect(command).toContain('tell application "Terminal" to do script');
    expect(command).toContain(
      "diffdiff tui --repo /Users/madison/code/diffdiff --base origin/main --head feature/review-window",
    );
  });

  test("wraps the diffdiff command in a PowerShell launcher on Windows", () => {
    const command = buildSessionReopenCommand(
      {
        comparison: {
          base: "origin/main",
          head: "feature/review-window",
          mode: "range",
        },
        repositoryRootPath: "C:/Users/madison/code/diffdiff",
      },
      "win32",
    );

    expect(command).toContain("powershell.exe -NoLogo -NoProfile -Command");
    expect(command).toContain("Start-Process");
    expect(command).toContain("diffdiff tui --repo C:/Users/madison/code/diffdiff");
  });

  test("uses PowerShell-safe quoting for Windows paths with spaces", () => {
    const command = buildSessionReopenCommand(
      {
        comparison: {
          base: "origin/main",
          head: "feature/review-window",
          mode: "range",
        },
        repositoryRootPath: "C:/Users/madison/code/repo with spaces",
      },
      "win32",
    );

    expect(command).toContain("''C:/Users/madison/code/repo with spaces''");
  });
});

describe("copySessionReopenCommand", () => {
  test("copies the reopen command for the current session", async () => {
    const copyText = vi.fn(async () => true);
    const input: SessionReopenCommandInput = {
      comparison: {
        base: "origin/main",
        head: "feature/review-window",
        mode: "range",
      },
      repositoryRootPath: "/Users/madison/code/diffdiff",
      verbose: true,
    };

    const command = await copySessionReopenCommand(input, {
      copyText,
      platform: "darwin",
    });

    expect(copyText).toHaveBeenCalledWith(command);
    expect(command).toContain("osascript -e");
    expect(command).toContain("--verbose");
  });

  test("fails when the clipboard write fails", async () => {
    await expect(
      copySessionReopenCommand(
        {
          comparison: {
            base: "origin/main",
            head: "feature/review-window",
            mode: "range",
          },
          repositoryRootPath: "/Users/madison/code/diffdiff",
        },
        {
          copyText: vi.fn(async () => false),
        },
      ),
    ).rejects.toThrow("Unable to copy the reopen command.");
  });
});
