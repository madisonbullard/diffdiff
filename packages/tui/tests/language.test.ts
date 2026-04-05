import { describe, expect, test } from "vite-plus/test";
import { getDiffFiletype, resolvePierreLanguage, resolveSyntaxLanguage } from "../src/language.ts";

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

  test("keeps TOML files resolvable for syntax preload", () => {
    expect(resolveSyntaxLanguage({ path: "Cargo.toml" })).toBe("toml");
    expect(resolvePierreLanguage({ path: "Cargo.toml" })).toBe("toml");
    expect(getDiffFiletype("Cargo.toml")).toBe("toml");
  });

  test("uses Pierre-compatible aliases for high-risk formats", () => {
    expect(resolveSyntaxLanguage({ path: "src/app.tsx" })).toBe("typescriptreact");
    expect(resolvePierreLanguage({ path: "src/app.tsx" })).toBe("tsx");

    expect(resolveSyntaxLanguage({ path: "src/app.jsx" })).toBe("javascriptreact");
    expect(resolvePierreLanguage({ path: "src/app.jsx" })).toBe("jsx");

    expect(resolveSyntaxLanguage({ path: "terraform/dev.tfvars" })).toBe("terraform-vars");
    expect(resolvePierreLanguage({ path: "terraform/dev.tfvars" })).toBe("tfvars");
  });

  test("supports JSONC and JSONL by path", () => {
    expect(resolveSyntaxLanguage({ path: "tsconfig.jsonc" })).toBe("jsonc");
    expect(resolvePierreLanguage({ path: "tsconfig.jsonc" })).toBe("jsonc");
    expect(getDiffFiletype("tsconfig.jsonc")).toBe("jsonc");

    expect(resolveSyntaxLanguage({ path: "logs/events.jsonl" })).toBe("jsonl");
    expect(resolvePierreLanguage({ path: "logs/events.jsonl" })).toBe("jsonl");
    expect(getDiffFiletype("logs/events.jsonl")).toBe("jsonl");
  });
});
