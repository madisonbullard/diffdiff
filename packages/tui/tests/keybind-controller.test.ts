import type { Renderable } from "@opentui/core";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createKeybindController } from "../src/app/keybind-controller.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("keybind controller", () => {
  test("blurs the focused renderable on leader entry and restores it when the leader hook clears", () => {
    vi.useFakeTimers();

    const { blurSpy, focusSpy, renderable } = createRenderable();
    let currentFocusedRenderable: Renderable | null = renderable;
    blurSpy.mockImplementation(() => {
      currentFocusedRenderable = null;
    });
    const onActivePrefixChange = vi.fn((activePrefix) => {
      if (activePrefix == null) {
        currentFocusedRenderable = null;
      }
    });
    const onStatusMessage = vi.fn();
    const controller = createKeybindController({
      getFocusedRenderable: () => currentFocusedRenderable,
      onActivePrefixChange,
      onStatusMessage,
    });

    controller.enterPrefixMode("leader", {
      status: "Leader key active.",
      onEnter: ({ clearPrefixMode }) => {
        const timeout = setTimeout(() => {
          clearPrefixMode("Leader key timed out.");
        }, 2_000);

        return () => clearTimeout(timeout);
      },
    });

    expect(controller.isPrefixActive("leader")).toBe(true);
    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2_000);

    expect(controller.getActivePrefix()).toBeNull();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(onActivePrefixChange).toHaveBeenNthCalledWith(1, "leader");
    expect(onActivePrefixChange).toHaveBeenNthCalledWith(2, null);
    expect(onStatusMessage).toHaveBeenNthCalledWith(1, "Leader key active.");
    expect(onStatusMessage).toHaveBeenNthCalledWith(2, "Leader key timed out.");
  });

  test("clears the active prefix when global keybinds are suspended", () => {
    const onActivePrefixChange = vi.fn();
    const controller = createKeybindController({
      getFocusedRenderable: () => createRenderable().renderable,
      onActivePrefixChange,
    });

    controller.enterPrefixMode("leader", {
      status: "Leader key active.",
    });

    const releaseFirst = controller.suspendGlobalKeybinds();
    const releaseSecond = controller.suspendGlobalKeybinds();

    expect(controller.getActivePrefix()).toBeNull();
    expect(controller.globalKeybindsSuspended()).toBe(true);

    releaseFirst();
    expect(controller.globalKeybindsSuspended()).toBe(true);

    releaseSecond();
    expect(controller.globalKeybindsSuspended()).toBe(false);
    expect(onActivePrefixChange).toHaveBeenNthCalledWith(1, "leader");
    expect(onActivePrefixChange).toHaveBeenNthCalledWith(2, null);
  });

  test("keeps the current focus when prefix mode preserves text-input focus", () => {
    const { blurSpy, focusSpy, renderable } = createRenderable();
    const controller = createKeybindController({
      getFocusedRenderable: () => renderable,
      onActivePrefixChange: vi.fn(),
    });

    controller.enterPrefixMode("leader", {
      preserveFocus: true,
      status: "Leader key active.",
    });

    expect(blurSpy).not.toHaveBeenCalled();

    controller.clearPrefixMode();

    expect(focusSpy).not.toHaveBeenCalled();
  });

  test("tracks a space prefix without blurring preserved focus", () => {
    const { blurSpy, focusSpy, renderable } = createRenderable();
    const onActivePrefixChange = vi.fn();
    const controller = createKeybindController({
      getFocusedRenderable: () => renderable,
      onActivePrefixChange,
      onStatusMessage: vi.fn(),
    });

    controller.enterPrefixMode("space", {
      preserveFocus: true,
      status: "Modal picker active.",
    });

    expect(controller.isPrefixActive("space")).toBe(true);
    expect(blurSpy).not.toHaveBeenCalled();

    controller.clearPrefixMode();

    expect(controller.getActivePrefix()).toBeNull();
    expect(focusSpy).not.toHaveBeenCalled();
    expect(onActivePrefixChange).toHaveBeenNthCalledWith(1, "space");
    expect(onActivePrefixChange).toHaveBeenNthCalledWith(2, null);
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
