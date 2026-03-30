import { describe, expect, test } from "vite-plus/test";
import { parseGitHubRemote } from "../src/github.ts";
import { parseStartupOptions } from "../src/startup-options.ts";

describe("parseStartupOptions", () => {
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
