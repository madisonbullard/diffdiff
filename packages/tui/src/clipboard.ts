import { spawn } from "node:child_process";
import clipboardy from "clipboardy";

interface ClipboardCommand {
  command: string;
  args: string[];
  input?: string;
}

export interface ClipboardEnvironment {
  TMUX?: string;
  STY?: string;
  WAYLAND_DISPLAY?: string;
}

export interface ClipboardOutput {
  isTTY?: boolean;
  write(text: string): unknown;
}

export interface ClipboardCopyOptions {
  platform?: NodeJS.Platform;
  env?: ClipboardEnvironment;
  stdout?: ClipboardOutput;
  runCommand?: ClipboardCommandRunner;
  clipboardWrite?: (text: string) => Promise<void>;
}

export interface ClipboardCommandRunner {
  (command: ClipboardCommand): Promise<boolean>;
}

export async function copyTextToClipboard(
  text: string,
  options: ClipboardCopyOptions = {},
): Promise<boolean> {
  if (text.length === 0) {
    return false;
  }

  writeOsc52(text, options.stdout ?? process.stdout, options.env ?? process.env);

  if (await copyTextWithNativeClipboard(text, options)) {
    return true;
  }

  const clipboardWrite = options.clipboardWrite ?? ((value: string) => clipboardy.write(value));

  try {
    await clipboardWrite(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyTextWithNativeClipboard(
  text: string,
  options: ClipboardCopyOptions = {},
): Promise<boolean> {
  if (text.length === 0) {
    return false;
  }

  const runCommand = options.runCommand ?? runClipboardCommand;

  for (const candidate of getClipboardCommands(
    options.platform ?? process.platform,
    options.env ?? process.env,
    text,
  )) {
    if (await runCommand(candidate)) {
      return true;
    }
  }

  return false;
}

function writeOsc52(text: string, stdout: ClipboardOutput, env: ClipboardEnvironment): void {
  if (!stdout.isTTY) {
    return;
  }

  const base64 = Buffer.from(text).toString("base64");
  const osc52 = `\u001b]52;c;${base64}\u0007`;
  const sequence = env.TMUX || env.STY ? `\u001bPtmux;\u001b${osc52}\u001b\\` : osc52;
  stdout.write(sequence);
}

function getClipboardCommands(
  platform: NodeJS.Platform,
  env: ClipboardEnvironment,
  text: string,
): readonly ClipboardCommand[] {
  switch (platform) {
    case "darwin": {
      const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return [{ command: "osascript", args: ["-e", `set the clipboard to "${escaped}"`] }];
    }
    case "linux": {
      return [
        ...(env.WAYLAND_DISPLAY ? [{ command: "wl-copy", args: [], input: text }] : []),
        { command: "xclip", args: ["-selection", "clipboard"], input: text },
        { command: "xsel", args: ["--clipboard", "--input"], input: text },
      ];
    }
    case "win32": {
      return [
        {
          command: "powershell.exe",
          args: [
            "-NonInteractive",
            "-NoProfile",
            "-Command",
            "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())",
          ],
          input: text,
        },
      ];
    }
    default:
      return [];
  }
}

async function runClipboardCommand({ command, args, input }: ClipboardCommand): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const stdin = input == null ? "ignore" : "pipe";

    try {
      const child = spawn(command, args, {
        stdio: [stdin, "ignore", "ignore"],
      });

      let settled = false;
      const settle = (result: boolean) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(result);
      };

      child.once("error", () => {
        settle(false);
      });

      child.once("close", (code) => {
        settle(code === 0);
      });

      if (input != null) {
        if (child.stdin == null) {
          settle(false);
          return;
        }

        child.stdin.end(input);
      }
    } catch {
      resolve(false);
    }
  });
}
