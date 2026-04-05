import { describe, expect, test } from "vite-plus/test";
import { getStartupOptionValues } from "../src/command-options.ts";

describe("getStartupOptionValues", () => {
  test("reads startup flags from command globals", () => {
    const values = getStartupOptionValues({
      optsWithGlobals: () => ({
        base: "origin/main",
        head: "feature/review",
        repo: "../sure/certainly",
        verbose: true,
      }),
    });

    expect(values).toEqual({
      base: "origin/main",
      head: "feature/review",
      repo: "../sure/certainly",
      verbose: true,
    });
  });
});
