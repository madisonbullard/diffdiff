import type { Renderable } from "@opentui/core";

const LEADER_TIMEOUT_MS = 2_000;

export interface KeybindController {
  clearLeaderMode(status?: string): void;
  dispose(): void;
  enterLeaderMode(options: { status: string; timeoutStatus: string }): void;
  globalKeybindsSuspended(): boolean;
  isLeaderActive(): boolean;
  resumeGlobalKeybinds(): void;
  suspendGlobalKeybinds(): () => void;
}

export function createKeybindController({
  getFocusedRenderable,
  onLeaderActiveChange,
  onStatusMessage,
}: {
  getFocusedRenderable: () => Renderable | null | undefined;
  onLeaderActiveChange: (active: boolean) => void;
  onStatusMessage?: (status: string) => void;
}): KeybindController {
  let leaderActive = false;
  let leaderFocus: Renderable | null = null;
  let suspendCount = 0;
  let leaderTimeout: ReturnType<typeof setTimeout> | null = null;

  function setLeaderActive(nextActive: boolean): void {
    if (leaderActive === nextActive) {
      return;
    }

    leaderActive = nextActive;
    onLeaderActiveChange(nextActive);
  }

  function clearLeaderTimeout(): void {
    if (leaderTimeout != null) {
      clearTimeout(leaderTimeout);
      leaderTimeout = null;
    }
  }

  function restoreLeaderFocus(): void {
    const previousFocus = leaderFocus;
    leaderFocus = null;
    if (previousFocus == null || previousFocus.isDestroyed) {
      return;
    }

    if (getFocusedRenderable() == null) {
      previousFocus.focus();
    }
  }

  function clearLeaderMode(status?: string): void {
    clearLeaderTimeout();

    if (leaderActive) {
      restoreLeaderFocus();
    } else {
      leaderFocus = null;
    }

    setLeaderActive(false);

    if (status != null) {
      onStatusMessage?.(status);
    }
  }

  function enterLeaderMode(options: { status: string; timeoutStatus: string }): void {
    clearLeaderTimeout();

    if (!leaderActive) {
      leaderFocus = getFocusedRenderable() ?? null;
      leaderFocus?.blur();
    }

    setLeaderActive(true);
    onStatusMessage?.(options.status);
    leaderTimeout = setTimeout(() => {
      leaderTimeout = null;
      clearLeaderMode(options.timeoutStatus);
    }, LEADER_TIMEOUT_MS);
  }

  function suspendGlobalKeybinds(): () => void {
    suspendCount += 1;
    clearLeaderMode();

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
    clearLeaderMode,
    dispose() {
      clearLeaderTimeout();
      leaderFocus = null;
      setLeaderActive(false);
      suspendCount = 0;
    },
    enterLeaderMode,
    globalKeybindsSuspended() {
      return suspendCount > 0;
    },
    isLeaderActive() {
      return leaderActive;
    },
    resumeGlobalKeybinds,
    suspendGlobalKeybinds,
  };
}
