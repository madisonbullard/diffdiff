import type { Renderable } from "@opentui/core";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createKeybindController } from "../src/app/keybind-controller.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("keybind controller", () => {
  test("blurs the focused renderable on leader entry and restores it on timeout", () => {
    vi.useFakeTimers();

    const { blurSpy, focusSpy, renderable } = createRenderable();
    let currentFocusedRenderable: Renderable | null = renderable;
    blurSpy.mockImplementation(() => {
      currentFocusedRenderable = null;
    });
    const onLeaderActiveChange = vi.fn((active: boolean) => {
      if (!active) {
        currentFocusedRenderable = null;
      }
    });
    const onStatusMessage = vi.fn();
    const controller = createKeybindController({
      getFocusedRenderable: () => currentFocusedRenderable,
      onLeaderActiveChange,
      onStatusMessage,
    });

    controller.enterLeaderMode({
      status: "Leader key active.",
      timeoutStatus: "Leader key timed out.",
    });

    expect(controller.isLeaderActive()).toBe(true);
    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2_000);

    expect(controller.isLeaderActive()).toBe(false);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(onLeaderActiveChange).toHaveBeenNthCalledWith(1, true);
    expect(onLeaderActiveChange).toHaveBeenNthCalledWith(2, false);
    expect(onStatusMessage).toHaveBeenNthCalledWith(1, "Leader key active.");
    expect(onStatusMessage).toHaveBeenNthCalledWith(2, "Leader key timed out.");
  });

  test("clears leader mode when global keybinds are suspended", () => {
    const onLeaderActiveChange = vi.fn();
    const controller = createKeybindController({
      getFocusedRenderable: () => createRenderable().renderable,
      onLeaderActiveChange,
    });

    controller.enterLeaderMode({
      status: "Leader key active.",
      timeoutStatus: "Leader key timed out.",
    });

    const releaseFirst = controller.suspendGlobalKeybinds();
    const releaseSecond = controller.suspendGlobalKeybinds();

    expect(controller.isLeaderActive()).toBe(false);
    expect(controller.globalKeybindsSuspended()).toBe(true);

    releaseFirst();
    expect(controller.globalKeybindsSuspended()).toBe(true);

    releaseSecond();
    expect(controller.globalKeybindsSuspended()).toBe(false);
    expect(onLeaderActiveChange).toHaveBeenNthCalledWith(1, true);
    expect(onLeaderActiveChange).toHaveBeenNthCalledWith(2, false);
  });

  test("keeps the current focus when leader mode preserves text-input focus", () => {
    vi.useFakeTimers();

    const { blurSpy, focusSpy, renderable } = createRenderable();
    const controller = createKeybindController({
      getFocusedRenderable: () => renderable,
      onLeaderActiveChange: vi.fn(),
    });

    controller.enterLeaderMode({
      preserveFocus: true,
      status: "Leader key active.",
      timeoutStatus: "Leader key timed out.",
    });

    expect(blurSpy).not.toHaveBeenCalled();

    controller.clearLeaderMode();

    expect(focusSpy).not.toHaveBeenCalled();
  });
});

function createRenderable(): {
  blurSpy: ReturnType<typeof vi.fn>;
  focusSpy: ReturnType<typeof vi.fn>;
  renderable: Renderable;
} {
  const blurSpy = vi.fn();
  const focusSpy = vi.fn();

  return {
    blurSpy,
    focusSpy,
    renderable: {
      blur: blurSpy,
      focus: focusSpy,
      isDestroyed: false,
    } as unknown as Renderable,
  };
}
