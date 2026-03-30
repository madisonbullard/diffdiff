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
