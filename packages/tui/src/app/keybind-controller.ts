import type { Renderable } from "@opentui/core";
import type { KeymapPrefixId } from "./keymap/prefixes.ts";

interface PrefixModeHandlers {
  onEnter?: (controls: { clearPrefixMode: (status?: string) => void }) => void | (() => void);
}

interface EnterPrefixModeOptions extends PrefixModeHandlers {
  onClear?: () => void;
  preserveFocus?: boolean;
  status: string;
}

interface KeybindController {
  clearPrefixMode(status?: string): void;
  dispose(): void;
  enterPrefixMode(prefix: KeymapPrefixId, options: EnterPrefixModeOptions): void;
  getActivePrefix(): KeymapPrefixId | null;
  isPrefixActive(prefix: KeymapPrefixId): boolean;
}

export function createKeybindController({
  getFocusedRenderable,
  onActivePrefixChange,
  onStatusMessage,
}: {
  getFocusedRenderable: () => Renderable | null | undefined;
  onActivePrefixChange: (activePrefix: KeymapPrefixId | null) => void;
  onStatusMessage?: (status: string) => void;
}): KeybindController {
  let activePrefix: KeymapPrefixId | null = null;
  let prefixCleanup: (() => void) | null = null;
  let prefixOnClear: (() => void) | null = null;
  let prefixFocus: Renderable | null = null;

  function setActivePrefix(nextPrefix: KeymapPrefixId | null): void {
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

  function clearPrefixOnClear(): void {
    prefixOnClear?.();
    prefixOnClear = null;
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
    clearPrefixOnClear();

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

  function enterPrefixMode(prefix: KeymapPrefixId, options: EnterPrefixModeOptions): void {
    clearPrefixCleanup();
    prefixOnClear = options.onClear ?? null;

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

  return {
    clearPrefixMode,
    dispose() {
      clearPrefixCleanup();
      clearPrefixOnClear();
      prefixFocus = null;
      setActivePrefix(null);
    },
    enterPrefixMode,
    getActivePrefix() {
      return activePrefix;
    },
    isPrefixActive(prefix) {
      return activePrefix === prefix;
    },
  };
}
