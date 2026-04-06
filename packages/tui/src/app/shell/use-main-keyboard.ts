import { useKeyboard } from "@opentui/react";
import { useCallback, useRef } from "react";
import type { KeyboardInput } from "../../commands.ts";
import { closeDialog as closeAppDialog } from "../dialogs/stack.ts";
import type { KeymapMode } from "./keymap-mode.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { keyEventFromInput } from "../keymap/key-event.ts";
import { dispatchAction, type ActionDispatchMap } from "../keymap/action-dispatch.ts";

interface UseMainKeyboardOptions {
  actionDispatchMap: ActionDispatchMap;
  activeKeymapMode: KeymapMode;
  commandActions: {
    clearPrefixMode: (status?: string) => void;
    runCommandByValue: (value: string) => void;
  };
  dismissErrorToast: () => void;
  handleBranchModalKey: (key: KeyboardInput) => void;
  handleClearReviewedModalKey: (key: KeyboardInput) => void;
  handleCleanupModalKey: (key: KeyboardInput) => void;
  handleCommandModalKey: (key: KeyboardInput) => void;
  handleCommentComposerKey: (key: KeyboardInput) => void;
  handleDiagnosticsModalKey: (key: KeyboardInput) => void;
  handleListFilterModalKey: (key: KeyboardInput) => void;
  handlePullRequestCommentsModalKey: (key: KeyboardInput) => void;
  handlePullRequestListModalKey: (key: KeyboardInput) => void;
  handleSubmitReviewModalKey: (key: KeyboardInput) => void;
  handleMergeModalKey: (key: KeyboardInput) => void;
  state: DiffdiffAppState;
}

export function useMainKeyboard({
  actionDispatchMap,
  activeKeymapMode,
  commandActions,
  dismissErrorToast,
  handleBranchModalKey,
  handleClearReviewedModalKey,
  handleCleanupModalKey,
  handleCommandModalKey,
  handleCommentComposerKey,
  handleDiagnosticsModalKey,
  handleListFilterModalKey,
  handlePullRequestCommentsModalKey,
  handlePullRequestListModalKey,
  handleSubmitReviewModalKey,
  handleMergeModalKey,
  state,
}: UseMainKeyboardOptions) {
  const keyboardHandlerRef = useRef<(key: KeyboardInput) => void>(() => undefined);

  function isPaneKeymapMode(mode: KeymapMode): boolean {
    return mode === "diff" || mode === "thread" || mode === "tree";
  }

  function handleHelpModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q" || key.sequence === "?") {
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "help", "dismiss"));
    }
  }

  /**
   * Primary key handler for diff/thread/tree pane modes.
   *
   * Keys are fed through the trie-based `KeymapRuntime` which handles:
   *   - Numeric count prefix accumulation (e.g. `5` then `gg` → count=5)
   *   - Multi-key sequence resolution (e.g. `g` → pending, `g` → matched)
   *   - Action ID dispatch via the `ActionDispatchMap`
   *
   * Falls back to the old `AppCommand` system via `runCommandByValue` for
   * actions not yet in the dispatch map (e.g. leader/space sub-commands).
   */
  function handleMainPaneKey(key: KeyboardInput, globalKeybindsSuspended: boolean): void {
    if (globalKeybindsSuspended) {
      return;
    }

    const event = keyEventFromInput(key);
    const result = state.keymapRuntime.get(activeKeymapMode, event);

    switch (result.kind) {
      case "matched": {
        if (dispatchAction(actionDispatchMap, result.actionId, result.count)) {
          return;
        }
        // Action ID not in dispatch map — fall through to command system.
        commandActions.runCommandByValue(result.actionId);
        return;
      }

      case "matched-sequence": {
        for (const actionId of result.actionIds) {
          if (!dispatchAction(actionDispatchMap, actionId, result.count)) {
            commandActions.runCommandByValue(actionId);
          }
        }
        return;
      }

      case "pending": {
        const label = result.node.label;
        if (label != null) {
          state.setStatusMessage(`${label} mode active. Awaiting next key.`);
        }
        return;
      }

      case "cancelled": {
        state.setStatusMessage("");
        return;
      }

      case "not-found": {
        // Count digit accumulation — show the in-progress count.
        const currentCount = state.keymapRuntime.count();
        if (currentCount != null) {
          state.setStatusMessage(`${currentCount}`);
        }
        break;
      }
    }
  }

  function handleKeyForMode(
    mode: KeymapMode,
    key: KeyboardInput,
    globalKeybindsSuspended: boolean,
  ): void {
    switch (mode) {
      case "commands":
        handleCommandModalKey(key);
        return;
      case "pull-request-list":
      case "pull-request-search":
        handlePullRequestListModalKey(key);
        return;
      case "help":
        handleHelpModalKey(key);
        return;
      case "diagnostics":
        handleDiagnosticsModalKey(key);
        return;
      case "clear-reviewed":
        handleClearReviewedModalKey(key);
        return;
      case "comment":
        handleCommentComposerKey(key);
        return;
      case "conversation":
        handlePullRequestCommentsModalKey(key);
        return;
      case "submit-review":
        handleSubmitReviewModalKey(key);
        return;
      case "merge-method":
      case "merge-title":
      case "merge-body":
      case "confirm-merge":
        handleMergeModalKey(key);
        return;
      case "cleanup":
        handleCleanupModalKey(key);
        return;
      case "filters":
        handleListFilterModalKey(key);
        return;
      case "compare-branches":
      case "compare-commits":
      case "commit-search":
        handleBranchModalKey(key);
        return;
      case "tree":
      case "thread":
      case "diff":
        handleMainPaneKey(key, globalKeybindsSuspended);
    }
  }

  keyboardHandlerRef.current = (key) => {
    const globalKeybindsSuspended = state.keybindController.globalKeybindsSuspended();

    if (
      isPaneKeymapMode(activeKeymapMode) &&
      state.errorToastMessage != null &&
      (key.name === "escape" || key.name === "x")
    ) {
      dismissErrorToast();
      return;
    }

    handleKeyForMode(activeKeymapMode, key, globalKeybindsSuspended);
  };

  useKeyboard(
    useCallback((key: KeyboardInput) => {
      keyboardHandlerRef.current(key);
    }, []),
  );
}
