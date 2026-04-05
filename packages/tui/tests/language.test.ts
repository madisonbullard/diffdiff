import { describe, expect, test } from "vite-plus/test";
import { getDiffFiletype, resolveSyntaxLanguage } from "../src/language.ts";

describe("shell syntax language resolution", () => {
  test("matches opencode shell aliases", () => {
    expect(resolveSyntaxLanguage({ path: "scripts/build.sh" })).toBe("shellscript");
    expect(resolveSyntaxLanguage({ path: ".bashrc" })).toBe("shellscript");
    expect(resolveSyntaxLanguage({ path: ".zshrc" })).toBe("shellscript");
  });

  test("normalizes shell parser hints", () => {
    expect(resolveSyntaxLanguage({ hintedLanguage: "bash" })).toBe("shellscript");
    expect(resolveSyntaxLanguage({ hintedLanguage: "zsh" })).toBe("shellscript");
  });

  test("falls back to shebang detection for extensionless files", () => {
    const patch = [
      "diff --git a/scripts/setup b/scripts/setup",
      "new file mode 100755",
      "index 0000000..1111111",
      "--- /dev/null",
      "+++ b/scripts/setup",
      "@@ -0,0 +1,3 @@",
      "+#!/usr/bin/env bash",
      "+set -euo pipefail",
      "+echo ready",
    ].join("\n");

    expect(resolveSyntaxLanguage({ path: "scripts/setup", patch })).toBe("shellscript");
    expect(getDiffFiletype("scripts/setup", patch)).toBe("shellscript");
  });
});
