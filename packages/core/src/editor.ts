import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { logDiffdiffError, logDiffdiffInfo, logDiffdiffWarn } from "./logging.ts";

export interface EditorInputController {
  isTTY?: boolean;
  pause(): void;
  resume(): void;
  setRawMode?(mode: boolean): void;
}

export interface OpenFileInEditorOptions {
  env?: NodeJS.ProcessEnv;
  filePath: string;
  repositoryRootPath: string;
  runEditorCommand?: EditorCommandRunner;
  stdin?: EditorInputController;
}

export interface EditorCommandRequest {
  args: string[];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface EditorCommandRunner {
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
  const resolvedEnv = {
    ...process.env,
    ...env,
  };
  const editorCommand = resolvePreferredEditor(resolvedEnv);
  if (editorCommand == null) {
    logDiffdiffWarn("editor", "editor_launch_skipped", {
      filePath,
      reason: "missing-editor-env",
      repositoryRootPath,
    });
    throw new Error("Set $VISUAL or $EDITOR to open files in an editor.");
  }

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

  const restoreTerminalInput = suspendTerminalInput(stdin ?? process.stdin);
  const launchEditor = runEditorCommand ?? runEditorCommandInShell;

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
