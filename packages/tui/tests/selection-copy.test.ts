import type { Selection } from "@opentui/core";
import { expect, test, vi } from "vite-plus/test";
import {
  copyTextToClipboard,
  copyTextWithPlatformClipboard,
  installSelectionAutoCopy,
  type SelectionClipboardRenderer,
} from "../src/selection-copy.ts";

test("copies selected text and clears the selection", () => {
  const renderer = createRenderer();
  const copyText = vi.fn(() => true);

  installSelectionAutoCopy(renderer, copyText);

  renderer.emitSelection("stack trace");

  expect(copyText).toHaveBeenCalledWith("stack trace", renderer);
  expect(renderer.clearSelection).toHaveBeenCalledTimes(1);
});

test("clears the selection even when copying fails", () => {
  const renderer = createRenderer();

  installSelectionAutoCopy(
    renderer,
    vi.fn(() => {
      throw new Error("clipboard unavailable");
    }),
  );

  expect(() => renderer.emitSelection("fatal error")).not.toThrow();
  expect(renderer.clearSelection).toHaveBeenCalledTimes(1);
});

test("detaches the renderer selection listener", () => {
  const renderer = createRenderer();

  const detach = installSelectionAutoCopy(renderer);
  const registeredHandler = renderer.on.mock.calls[0]?.[1];

  detach();

  expect(renderer.off).toHaveBeenCalledWith("selection", registeredHandler);
});

test("falls back to the platform clipboard command when OSC52 fails", () => {
  const renderer = createRenderer({ osc52Result: false });
  const runCommand = vi
    .fn<(command: string, args: string[], text: string) => boolean>()
    .mockReturnValue(true);

  const copied = copyTextToClipboard("copied text", renderer, {
    platform: "darwin",
    runCommand,
  });

  expect(copied).toBe(true);
  expect(renderer.copyToClipboardOSC52).toHaveBeenCalledWith("copied text");
  expect(runCommand).toHaveBeenCalledWith("pbcopy", [], "copied text");
});

test("tries multiple Linux clipboard commands until one succeeds", () => {
  const runCommand = vi
    .fn<(command: string, args: string[], text: string) => boolean>()
    .mockImplementation((command) => command === "xclip");

  const copied = copyTextWithPlatformClipboard("copied text", {
    platform: "linux",
    runCommand,
  });

  expect(copied).toBe(true);
  expect(runCommand.mock.calls).toEqual([
    ["wl-copy", [], "copied text"],
    ["xclip", ["-selection", "clipboard"], "copied text"],
  ]);
});

function createRenderer(options: { osc52Result?: boolean } = {}) {
  let selectionHandler: ((selection: Selection) => void) | undefined;

  const clearSelection = vi.fn<() => void>();
  const copyToClipboardOSC52 = vi
    .fn<(text: string) => boolean>()
    .mockImplementation(() => options.osc52Result ?? true);
  const on = vi.fn<SelectionClipboardRenderer["on"]>().mockImplementation((event, listener) => {
    if (event === "selection") {
      selectionHandler = listener;
    }
  });
  const off = vi.fn<SelectionClipboardRenderer["off"]>();

  const renderer: SelectionClipboardRenderer & {
    clearSelection: typeof clearSelection;
    copyToClipboardOSC52: typeof copyToClipboardOSC52;
    on: typeof on;
    off: typeof off;
    emitSelection(text: string): void;
  } = {
    clearSelection,
    copyToClipboardOSC52,
    on,
    off,
    emitSelection(text: string) {
      selectionHandler?.({ getSelectedText: () => text } as Selection);
    },
  };

  return renderer;
}
