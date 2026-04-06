import type { Renderable } from "@opentui/core";
import type { CommandKeybindPrefix } from "../commands.ts";

interface PrefixModeHandlers {
  onEnter?: (controls: { clearPrefixMode: (status?: string) => void }) => void | (() => void);
}

interface EnterPrefixModeOptions extends PrefixModeHandlers {
  preserveFocus?: boolean;
  status: string;
}

interface KeybindController {
  clearPrefixMode(status?: string): void;
  dispose(): void;
  enterPrefixMode(prefix: CommandKeybindPrefix, options: EnterPrefixModeOptions): void;
  getActivePrefix(): CommandKeybindPrefix | null;
  globalKeybindsSuspended(): boolean;
  isPrefixActive(prefix: CommandKeybindPrefix): boolean;
  resumeGlobalKeybinds(): void;
  suspendGlobalKeybinds(): () => void;
}

export function createKeybindController({
  getFocusedRenderable,
  onActivePrefixChange,
  onStatusMessage,
}: {
  getFocusedRenderable: () => Renderable | null | undefined;
  onActivePrefixChange: (activePrefix: CommandKeybindPrefix | null) => void;
  onStatusMessage?: (status: string) => void;
}): KeybindController {
  let activePrefix: CommandKeybindPrefix | null = null;
  let prefixCleanup: (() => void) | null = null;
  let prefixFocus: Renderable | null = null;
  let suspendCount = 0;

  function setActivePrefix(nextPrefix: CommandKeybindPrefix | null): void {
    if (activePrefix === nextPrefix) {
      return;
    }

    activePrefix = nextPrefix;
    onActivePrefixChange(nextPrefix);
  }

  function clearPrefixCleanup(): void {
    prefixCleanup?.();
    prefixCleanup = null;
  }

  function restorePrefixFocus(): void {
    const previousFocus = prefixFocus;
    prefixFocus = null;
    if (previousFocus == null || previousFocus.isDestroyed) {
      return;
    }

    if (getFocusedRenderable() == null) {
      previousFocus.focus();
    }
  }

  function clearPrefixMode(status?: string): void {
    clearPrefixCleanup();

    if (activePrefix != null) {
      restorePrefixFocus();
    } else {
      prefixFocus = null;
    }

    setActivePrefix(null);

    if (status != null) {
      onStatusMessage?.(status);
    }
  }

  function enterPrefixMode(prefix: CommandKeybindPrefix, options: EnterPrefixModeOptions): void {
    clearPrefixCleanup();

    if (activePrefix !== prefix) {
      if (activePrefix != null) {
        restorePrefixFocus();
      }

      prefixFocus = options.preserveFocus ? null : (getFocusedRenderable() ?? null);
      prefixFocus?.blur();
    }

    setActivePrefix(prefix);
    onStatusMessage?.(options.status);

    const cleanup = options.onEnter?.({
      clearPrefixMode,
    });
    prefixCleanup = typeof cleanup === "function" ? cleanup : null;
  }

  function suspendGlobalKeybinds(): () => void {
    suspendCount += 1;
    clearPrefixMode();

    let released = false;
    return () => {
      if (released) {
        return;
      }

      released = true;
      suspendCount = Math.max(0, suspendCount - 1);
    };
  }

  function resumeGlobalKeybinds(): void {
    suspendCount = Math.max(0, suspendCount - 1);
  }

  return {
    clearPrefixMode,
    dispose() {
      clearPrefixCleanup();
      prefixFocus = null;
      setActivePrefix(null);
      suspendCount = 0;
    },
    enterPrefixMode,
    getActivePrefix() {
      return activePrefix;
    },
    globalKeybindsSuspended() {
      return suspendCount > 0;
    },
    isPrefixActive(prefix) {
      return activePrefix === prefix;
    },
    resumeGlobalKeybinds,
    suspendGlobalKeybinds,
  };
}
