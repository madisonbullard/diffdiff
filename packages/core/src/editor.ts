import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { logDiffdiffError, logDiffdiffInfo, logDiffdiffWarn } from "./logging.ts";

interface EditorInputController {
  isTTY?: boolean;
  pause(): void;
  resume(): void;
  setRawMode?(mode: boolean): void;
}

interface OpenFileInEditorOptions {
  env?: NodeJS.ProcessEnv;
  filePath: string;
  repositoryRootPath: string;
  runEditorCommand?: EditorCommandRunner;
  stdin?: EditorInputController;
}

interface OpenExternalEditorOptions {
  env?: NodeJS.ProcessEnv;
  fileExtension?: string;
  initialValue: string;
  repositoryRootPath: string;
  runEditorCommand?: EditorCommandRunner;
  stdin?: EditorInputController;
  tempFileName?: string;
}

interface EditorCommandRequest {
  args: string[];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

interface EditorCommandRunner {
  (request: EditorCommandRequest): Promise<void>;
}

export function resolvePreferredEditor(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const visual = env.VISUAL?.trim();
  if (visual != null && visual !== "") {
    return visual;
  }

  const editor = env.EDITOR?.trim();
  return editor == null || editor === "" ? undefined : editor;
}

export async function openFileInEditor({
  env,
  filePath,
  repositoryRootPath,
  runEditorCommand,
  stdin,
}: OpenFileInEditorOptions): Promise<void> {
  const { editorCommand, launchEditor, resolvedEnv, restoreTerminalInput } = prepareEditorLaunch({
    env,
    repositoryRootPath,
    runEditorCommand,
    scope: "editor",
    skippedData: {
      filePath,
      repositoryRootPath,
    },
    stdin,
  });

  const absoluteFilePath = resolve(repositoryRootPath, filePath);

  try {
    await access(absoluteFilePath);
  } catch {
    logDiffdiffWarn("editor", "editor_launch_skipped", {
      absoluteFilePath,
      editorCommand,
      filePath,
      reason: "missing-file",
      repositoryRootPath,
    });
    throw new Error(`${filePath} is not available in the working tree.`);
  }

  logDiffdiffInfo("editor", "editor_launch_started", {
    absoluteFilePath,
    command: editorCommand,
    filePath,
    repositoryRootPath,
  });

  try {
    await launchEditor({
      args: [absoluteFilePath],
      command: editorCommand,
      cwd: repositoryRootPath,
      env: resolvedEnv,
    });
    logDiffdiffInfo("editor", "editor_launch_completed", {
      absoluteFilePath,
      command: editorCommand,
      filePath,
      repositoryRootPath,
    });
  } catch (error) {
    logDiffdiffError("editor", "editor_launch_failed", error, {
      absoluteFilePath,
      command: editorCommand,
      filePath,
      repositoryRootPath,
    });
    throw error;
  } finally {
    restoreTerminalInput();
  }
}

export async function openExternalEditor({
  env,
  fileExtension,
  initialValue,
  repositoryRootPath,
  runEditorCommand,
  stdin,
  tempFileName,
}: OpenExternalEditorOptions): Promise<string> {
  const { editorCommand, launchEditor, resolvedEnv, restoreTerminalInput } = prepareEditorLaunch({
    env,
    repositoryRootPath,
    runEditorCommand,
    scope: "external-editor",
    skippedData: {
      repositoryRootPath,
      tempFileName,
    },
    stdin,
  });
  const temporaryDirectoryPath = await mkdtemp(join(tmpdir(), "diffdiff-editor-"));
  const temporaryFilePath = join(
    temporaryDirectoryPath,
    tempFileName == null || tempFileName.trim() === ""
      ? `diffdiff-edit${normalizeEditorFileExtension(fileExtension)}`
      : tempFileName,
  );

  await writeFile(temporaryFilePath, initialValue, "utf8");

  logDiffdiffInfo("external-editor", "external_editor_launch_started", {
    command: editorCommand,
    repositoryRootPath,
    temporaryFilePath,
  });

  try {
    await launchEditor({
      args: [temporaryFilePath],
      command: editorCommand,
      cwd: repositoryRootPath,
      env: resolvedEnv,
    });
    const content = await readFile(temporaryFilePath, "utf8");
    logDiffdiffInfo("external-editor", "external_editor_launch_completed", {
      command: editorCommand,
      repositoryRootPath,
      temporaryFilePath,
    });
    return content;
  } catch (error) {
    logDiffdiffError("external-editor", "external_editor_launch_failed", error, {
      command: editorCommand,
      repositoryRootPath,
      temporaryFilePath,
    });
    throw error;
  } finally {
    restoreTerminalInput();
    await rm(temporaryDirectoryPath, { force: true, recursive: true });
  }
}

function normalizeEditorFileExtension(fileExtension: string | undefined): string {
  if (fileExtension == null || fileExtension.trim() === "") {
    return ".md";
  }

  return fileExtension.startsWith(".") ? fileExtension : `.${fileExtension}`;
}

function prepareEditorLaunch({
  env,
  repositoryRootPath,
  runEditorCommand,
  scope,
  skippedData,
  stdin,
}: {
  env?: NodeJS.ProcessEnv;
  repositoryRootPath: string;
  runEditorCommand?: EditorCommandRunner;
  scope: "editor" | "external-editor";
  skippedData: Record<string, unknown>;
  stdin?: EditorInputController;
}): {
  editorCommand: string;
  launchEditor: EditorCommandRunner;
  resolvedEnv: NodeJS.ProcessEnv;
  restoreTerminalInput: () => void;
} {
  const resolvedEnv = {
    ...process.env,
    ...env,
  };
  const editorCommand = resolvePreferredEditor(resolvedEnv);
  if (editorCommand == null) {
    logDiffdiffWarn(scope, `${scope}_launch_skipped`, {
      ...skippedData,
      reason: "missing-editor-env",
      repositoryRootPath,
    });
    throw new Error("Set $VISUAL or $EDITOR to open files in an editor.");
  }

  return {
    editorCommand,
    launchEditor: runEditorCommand ?? runEditorCommandInShell,
    resolvedEnv,
    restoreTerminalInput: suspendTerminalInput(stdin ?? process.stdin),
  };
}

function suspendTerminalInput(stdin: EditorInputController): () => void {
  if (!stdin.isTTY) {
    return () => undefined;
  }

  stdin.setRawMode?.(false);
  stdin.pause();

  return () => {
    stdin.setRawMode?.(true);
    stdin.resume();
  };
}

async function runEditorCommandInShell({
  args,
  command,
  cwd,
  env,
}: EditorCommandRequest): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: true,
      stdio: "inherit",
      windowsHide: false,
    });

    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Editor exited with code ${code ?? "unknown"}.`));
    });
  });
}
