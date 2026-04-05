import type { Renderable } from "@opentui/core";

const TRANSIENT_KEY_TIMEOUT_MS = 2_000;

type TransientKeyMode = "leader" | "modal-picker" | null;

export interface KeybindController {
  clearModalPickerMode(status?: string): void;
  clearLeaderMode(status?: string): void;
  clearTransientMode(status?: string): void;
  dispose(): void;
  enterLeaderMode(options: {
    preserveFocus?: boolean;
    status: string;
    timeoutStatus: string;
  }): void;
  enterModalPickerMode(options: {
    preserveFocus?: boolean;
    status: string;
    timeoutStatus: string;
  }): void;
  globalKeybindsSuspended(): boolean;
  isLeaderActive(): boolean;
  isModalPickerActive(): boolean;
  resumeGlobalKeybinds(): void;
  suspendGlobalKeybinds(): () => void;
}

export function createKeybindController({
  getFocusedRenderable,
  onLeaderActiveChange,
  onModalPickerActiveChange,
  onStatusMessage,
}: {
  getFocusedRenderable: () => Renderable | null | undefined;
  onLeaderActiveChange: (active: boolean) => void;
  onModalPickerActiveChange: (active: boolean) => void;
  onStatusMessage?: (status: string) => void;
}): KeybindController {
  let activeMode: TransientKeyMode = null;
  let transientFocus: Renderable | null = null;
  let suspendCount = 0;
  let transientTimeout: ReturnType<typeof setTimeout> | null = null;

  function setActiveMode(nextMode: TransientKeyMode): void {
    if (activeMode === nextMode) {
      return;
    }

    activeMode = nextMode;
    onLeaderActiveChange(nextMode === "leader");
    onModalPickerActiveChange(nextMode === "modal-picker");
  }

  function clearTransientTimeout(): void {
    if (transientTimeout != null) {
      clearTimeout(transientTimeout);
      transientTimeout = null;
    }
  }

  function restoreTransientFocus(): void {
    const previousFocus = transientFocus;
    transientFocus = null;
    if (previousFocus == null || previousFocus.isDestroyed) {
      return;
    }

    if (getFocusedRenderable() == null) {
      previousFocus.focus();
    }
  }

  function clearTransientMode(status?: string): void {
    clearTransientTimeout();

    if (activeMode != null) {
      restoreTransientFocus();
    } else {
      transientFocus = null;
    }

    setActiveMode(null);

    if (status != null) {
      onStatusMessage?.(status);
    }
  }

  function clearLeaderMode(status?: string): void {
    if (activeMode !== "leader") {
      return;
    }

    clearTransientMode(status);
  }

  function clearModalPickerMode(status?: string): void {
    if (activeMode !== "modal-picker") {
      return;
    }

    clearTransientMode(status);
  }

  function enterTransientMode(
    nextMode: Exclude<TransientKeyMode, null>,
    options: {
      preserveFocus?: boolean;
      status: string;
      timeoutStatus: string;
    },
  ): void {
    clearTransientTimeout();

    if (activeMode !== nextMode) {
      if (activeMode != null) {
        restoreTransientFocus();
      }

      transientFocus = options.preserveFocus ? null : (getFocusedRenderable() ?? null);
      transientFocus?.blur();
    }

    setActiveMode(nextMode);
    onStatusMessage?.(options.status);
    transientTimeout = setTimeout(() => {
      transientTimeout = null;
      clearTransientMode(options.timeoutStatus);
    }, TRANSIENT_KEY_TIMEOUT_MS);
  }

  function enterLeaderMode(options: {
    preserveFocus?: boolean;
    status: string;
    timeoutStatus: string;
  }): void {
    enterTransientMode("leader", options);
  }

  function enterModalPickerMode(options: {
    preserveFocus?: boolean;
    status: string;
    timeoutStatus: string;
  }): void {
    enterTransientMode("modal-picker", options);
  }

  function suspendGlobalKeybinds(): () => void {
    suspendCount += 1;
    clearTransientMode();

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
    clearModalPickerMode,
    clearLeaderMode,
    clearTransientMode,
    dispose() {
      clearTransientTimeout();
      transientFocus = null;
      setActiveMode(null);
      suspendCount = 0;
    },
    enterLeaderMode,
    enterModalPickerMode,
    globalKeybindsSuspended() {
      return suspendCount > 0;
    },
    isLeaderActive() {
      return activeMode === "leader";
    },
    isModalPickerActive() {
      return activeMode === "modal-picker";
    },
    resumeGlobalKeybinds,
    suspendGlobalKeybinds,
  };
}
