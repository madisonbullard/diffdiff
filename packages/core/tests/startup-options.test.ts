import { describe, expect, test } from "vite-plus/test";
import { parseGitHubRemote } from "../src/github.ts";
import {
  formatHelpText,
  parseStartupOptions,
  resolveStartupOptions,
} from "../src/startup-options.ts";

describe("parseStartupOptions", () => {
  test("accepts the optional tui subcommand", () => {
    const result = parseStartupOptions(["tui", "--base", "origin/main"]);

    expect(result.base).toBe("origin/main");
  });

  test("prefers CLI values over env values", () => {
    const result = parseStartupOptions(["--base", "origin/main", "--head", "feature"], {
      DIFFDIFF_BASE: "main",
      DIFFDIFF_HEAD: "HEAD",
    });

    expect(result.base).toBe("origin/main");
    expect(result.head).toBe("feature");
  });

  test("falls back to env values", () => {
    const result = parseStartupOptions([], {
      DIFFDIFF_REPO: "/tmp/repo",
      DIFFDIFF_BASE: "main",
      DIFFDIFF_HEAD: "HEAD",
    });

    expect(result.repoPath).toBe("/tmp/repo");
    expect(result.base).toBe("main");
    expect(result.head).toBe("HEAD");
  });

  test("supports -H as the short flag for head", () => {
    const result = parseStartupOptions(["-H", "feature"], {});

    expect(result.head).toBe("feature");
  });

  test("resolves startup options from command values and env", () => {
    const result = resolveStartupOptions(
      { base: "origin/main" },
      {
        DIFFDIFF_HEAD: "feature/ui",
        DIFFDIFF_REPO: "/tmp/repo",
      },
    );

    expect(result).toEqual({
      base: "origin/main",
      head: "feature/ui",
      repoPath: "/tmp/repo",
    });
  });

  test("documents the session command suite in help output", () => {
    const helpText = formatHelpText();

    expect(helpText).toContain("diffdiff session list [--json]");
    expect(helpText).toContain("diffdiff session remove <session-id>");
    expect(helpText).toContain("diffdiff session remove-all");
    expect(helpText).toContain("  --head, -H   Head branch or commit to compare to");
  });
});

describe("parseGitHubRemote", () => {
  test("parses HTTPS remotes", () => {
    expect(parseGitHubRemote("https://github.com/diffdiff/diffdiff.git")).toEqual({
      forge: "github",
      owner: "diffdiff",
      repo: "diffdiff",
      host: "github.com",
    });
  });

  test("parses SSH remotes", () => {
    expect(parseGitHubRemote("git@github.com:diffdiff/diffdiff.git")).toEqual({
      forge: "github",
      owner: "diffdiff",
      repo: "diffdiff",
      host: "github.com",
    });
  });
});
