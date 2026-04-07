import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { openExternalEditor, openFileInEditor, resolvePreferredEditor } from "../src/editor.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("resolvePreferredEditor", () => {
  test("prefers VISUAL over EDITOR", () => {
    expect(resolvePreferredEditor({ EDITOR: "vim", VISUAL: "nvim" })).toBe("nvim");
  });

  test("ignores empty editor variables", () => {
    expect(resolvePreferredEditor({ EDITOR: "   ", VISUAL: "" })).toBeUndefined();
  });
});

describe("openFileInEditor", () => {
  test("launches the preferred editor for an existing file and restores tty state", async () => {
    const repositoryRootPath = await mkdtemp(join(tmpdir(), "diffdiff-editor-"));
    temporaryDirectories.push(repositoryRootPath);
    await mkdir(join(repositoryRootPath, "src"), { recursive: true });
    await writeFile(join(repositoryRootPath, "src/app.ts"), "export const ready = true;\n");

    const runEditorCommand = vi.fn(async () => undefined);
    const stdin = {
      isTTY: true,
      pause: vi.fn(),
      resume: vi.fn(),
      setRawMode: vi.fn(),
    };

    await openFileInEditor({
      env: { EDITOR: "vim", VISUAL: "code -w" },
      filePath: "src/app.ts",
      repositoryRootPath,
      runEditorCommand,
      stdin,
    });

    expect(runEditorCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [join(repositoryRootPath, "src/app.ts")],
        command: "code -w",
        cwd: repositoryRootPath,
      }),
    );
    expect(stdin.setRawMode).toHaveBeenNthCalledWith(1, false);
    expect(stdin.pause).toHaveBeenCalledTimes(1);
    expect(stdin.setRawMode).toHaveBeenNthCalledWith(2, true);
    expect(stdin.resume).toHaveBeenCalledTimes(1);
  });

  test("fails when no editor environment variable is configured", async () => {
    const repositoryRootPath = await mkdtemp(join(tmpdir(), "diffdiff-editor-"));
    temporaryDirectories.push(repositoryRootPath);
    await writeFile(join(repositoryRootPath, "app.ts"), "export {};\n");

    await expect(
      openFileInEditor({
        env: { EDITOR: "", VISUAL: "" },
        filePath: "app.ts",
        repositoryRootPath,
        runEditorCommand: vi.fn(async () => undefined),
      }),
    ).rejects.toThrow("Set $VISUAL or $EDITOR to open files in an editor.");
  });

  test("fails when the focused file is not present in the working tree", async () => {
    const repositoryRootPath = await mkdtemp(join(tmpdir(), "diffdiff-editor-"));
    temporaryDirectories.push(repositoryRootPath);

    await expect(
      openFileInEditor({
        env: { EDITOR: "vim" },
        filePath: "missing.ts",
        repositoryRootPath,
        runEditorCommand: vi.fn(async () => undefined),
      }),
    ).rejects.toThrow("missing.ts is not available in the working tree.");
  });
});

describe("openExternalEditor", () => {
  test("opens a temporary buffer in the preferred editor and returns the edited contents", async () => {
    const repositoryRootPath = await mkdtemp(join(tmpdir(), "diffdiff-editor-"));
    temporaryDirectories.push(repositoryRootPath);

    const runEditorCommand = vi.fn(async ({ args }: { args: string[] }) => {
      await writeFile(args[0]!, "updated body\n", "utf8");
    });
    const stdin = {
      isTTY: true,
      pause: vi.fn(),
      resume: vi.fn(),
      setRawMode: vi.fn(),
    };

    const result = await openExternalEditor({
      env: { EDITOR: "vim" },
      fileExtension: ".md",
      initialValue: "original body\n",
      repositoryRootPath,
      runEditorCommand,
      stdin,
      tempFileName: "REVIEW_COMMENT.md",
    });

    expect(result).toBe("updated body\n");
    expect(runEditorCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [expect.stringMatching(/REVIEW_COMMENT\.md$/u)],
        command: "vim",
        cwd: repositoryRootPath,
      }),
    );
    expect(stdin.setRawMode).toHaveBeenNthCalledWith(1, false);
    expect(stdin.setRawMode).toHaveBeenNthCalledWith(2, true);
  });

  test("fails when no editor environment variable is configured", async () => {
    const repositoryRootPath = await mkdtemp(join(tmpdir(), "diffdiff-editor-"));
    temporaryDirectories.push(repositoryRootPath);

    await expect(
      openExternalEditor({
        env: { EDITOR: "", VISUAL: "" },
        initialValue: "draft",
        repositoryRootPath,
        runEditorCommand: vi.fn(async () => undefined),
      }),
    ).rejects.toThrow("Set $VISUAL or $EDITOR to open files in an editor.");
  });
});
