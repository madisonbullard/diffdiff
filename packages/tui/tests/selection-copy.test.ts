import { expect, test, vi } from "vite-plus/test";
import { copyTextToClipboard } from "../src/clipboard.ts";
import { copySelection, type SelectionClipboardRenderer } from "../src/selection-copy.ts";

test("copies the current selection and clears it immediately", async () => {
  const renderer = createRenderer("stack trace");
  const copyText = vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(true);
  const onSuccess = vi.fn<() => void>();

  expect(copySelection(renderer, { copyText, onSuccess })).toBe(true);
  expect(copyText).toHaveBeenCalledWith("stack trace");
  expect(renderer.clearSelection).toHaveBeenCalledTimes(1);

  await Promise.resolve();

  expect(onSuccess).toHaveBeenCalledTimes(1);
});

test("returns false when there is no active selection", () => {
  const renderer = createRenderer(null);
  const copyText = vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(true);

  expect(copySelection(renderer, { copyText })).toBe(false);
  expect(copyText).not.toHaveBeenCalled();
  expect(renderer.clearSelection).not.toHaveBeenCalled();
});

test("reports clipboard failures without throwing", async () => {
  const renderer = createRenderer("fatal error");
  const onError = vi.fn<() => void>();

  expect(
    copySelection(renderer, {
      copyText: vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(false),
      onError,
    }),
  ).toBe(true);

  await Promise.resolve();

  expect(onError).toHaveBeenCalledTimes(1);
  expect(renderer.clearSelection).toHaveBeenCalledTimes(1);
});

test("writes OSC52 and uses the native macOS clipboard command", async () => {
  const write = vi.fn<(text: string) => unknown>();
  const runCommand = vi
    .fn<(command: { command: string; args: string[]; input?: string }) => Promise<boolean>>()
    .mockResolvedValue(true);

  const copied = await copyTextToClipboard("copied text", {
    platform: "darwin",
    stdout: { isTTY: true, write },
    env: {},
    runCommand,
  });

  expect(copied).toBe(true);
  expect(write).toHaveBeenCalledWith("\u001b]52;c;Y29waWVkIHRleHQ=\u0007");
  expect(runCommand).toHaveBeenCalledWith({
    command: "osascript",
    args: ["-e", 'set the clipboard to "copied text"'],
  });
});

test("tries Linux clipboard commands in opencode order before falling back", async () => {
  const runCommand = vi
    .fn<(command: { command: string; args: string[]; input?: string }) => Promise<boolean>>()
    .mockImplementation(async ({ command }) => command === "xclip");
  const clipboardWrite = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();

  const copied = await copyTextToClipboard("copied text", {
    platform: "linux",
    env: { WAYLAND_DISPLAY: "wayland-0" },
    stdout: { isTTY: false, write: vi.fn<(text: string) => unknown>() },
    runCommand,
    clipboardWrite,
  });

  expect(copied).toBe(true);
  expect(runCommand.mock.calls).toEqual([
    [{ command: "wl-copy", args: [], input: "copied text" }],
    [{ command: "xclip", args: ["-selection", "clipboard"], input: "copied text" }],
  ]);
  expect(clipboardWrite).not.toHaveBeenCalled();
});

test("falls back to clipboardy when native commands fail", async () => {
  const clipboardWrite = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();

  const copied = await copyTextToClipboard("copied text", {
    platform: "linux",
    env: {},
    stdout: { isTTY: false, write: vi.fn<(text: string) => unknown>() },
    runCommand: vi
      .fn<(command: { command: string; args: string[]; input?: string }) => Promise<boolean>>()
      .mockResolvedValue(false),
    clipboardWrite,
  });

  expect(copied).toBe(true);
  expect(clipboardWrite).toHaveBeenCalledWith("copied text");
});

function createRenderer(selectedText: string | null): SelectionClipboardRenderer & {
  clearSelection: ReturnType<typeof vi.fn<() => void>>;
} {
  const clearSelection = vi.fn<() => void>();

  return {
    clearSelection,
    getSelection() {
      if (selectedText == null) {
        return null;
      }

      return {
        getSelectedText: () => selectedText,
      };
    },
  };
}
