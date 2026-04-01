import { describe, expect, test } from "vite-plus/test";
import { parseChangedFilePatch, splitPatchIntoFiles } from "../src/git.ts";

describe("splitPatchIntoFiles", () => {
  test("splits a multi-file patch into separate sections", () => {
    const patch = [
      "diff --git a/README.md b/README.md",
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "diff --git a/src/app.ts b/src/app.ts",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1 +1 @@",
      "-export const oldValue = true;",
      "+export const newValue = true;",
    ].join("\n");

    expect(splitPatchIntoFiles(patch)).toHaveLength(2);
  });

  test("preserves trailing blank context lines in hunk output", () => {
    // A context line for a blank line in the source file appears as a single space in unified
    // diff output.  An overly aggressive trim could strip that space and break strict parsers
    // that validate hunk line counts against the @@ header.
    const patch = [
      "diff --git a/src/app.ts b/src/app.ts",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,4 +1,4 @@",
      "-old",
      "+new",
      " a",
      " ",
    ].join("\n");

    const sections = splitPatchIntoFiles(patch);
    expect(sections).toHaveLength(1);

    const lines = sections[0].split("\n");
    expect(lines.at(-1)).toBe(" ");
  });

  test("preserves trailing blank context lines when splitting multi-file patches", () => {
    const patch = [
      "diff --git a/first.ts b/first.ts",
      "--- a/first.ts",
      "+++ b/first.ts",
      "@@ -1,3 +1,3 @@",
      "-old",
      "+new",
      " trailing context",
      " ",
      "diff --git a/second.ts b/second.ts",
      "--- a/second.ts",
      "+++ b/second.ts",
      "@@ -1 +1 @@",
      "-a",
      "+b",
    ].join("\n");

    const sections = splitPatchIntoFiles(patch);
    expect(sections).toHaveLength(2);

    const firstLines = sections[0].split("\n");
    expect(firstLines.at(-1)).toBe(" ");
  });
});

describe("parseChangedFilePatch", () => {
  test("parses renamed files", () => {
    const patch = [
      "diff --git a/src/old.ts b/src/new.ts",
      "similarity index 100%",
      "rename from src/old.ts",
      "rename to src/new.ts",
    ].join("\n");

    expect(parseChangedFilePatch(patch)).toMatchObject({
      path: "src/new.ts",
      previousPath: "src/old.ts",
      status: "renamed",
    });
  });

  test("parses binary additions", () => {
    const patch = [
      "diff --git a/assets/logo.png b/assets/logo.png",
      "new file mode 100644",
      "index 0000000..1111111",
      "Binary files /dev/null and b/assets/logo.png differ",
    ].join("\n");

    expect(parseChangedFilePatch(patch)).toMatchObject({
      isBinary: true,
      path: "assets/logo.png",
      status: "added",
    });
  });
});
