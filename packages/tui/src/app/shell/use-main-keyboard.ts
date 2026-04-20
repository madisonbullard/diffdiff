import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useRef } from "react";
import { findKeymapPrefixByNodeLabel } from "../keymap/prefixes.ts";
import type { KeyboardInput } from "../../keyboard-input.ts";
import { getPrefixMenuConfig } from "../commands/prefix-menus.ts";
import { dispatchAction, type ActionDispatchMap } from "../keymap/action-dispatch.ts";
import { keyEventFromInput } from "../keymap/key-event.ts";
import type { ReviewInputControllers } from "../review/review-input-controllers.ts";
import type { AppTextInputControllers } from "../text-input/input-controllers.ts";
import type { KeymapMode } from "./keymap-mode.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";

interface UseMainKeyboardOptions {
  actionDispatchMap: ActionDispatchMap;
  activeKeymapMode: KeymapMode;
  commandActions: {
    runCommandByValue: (value: string) => void;
  };
  dismissErrorToast: () => void;
  textInputControllers: AppTextInputControllers;
  reviewInputControllers: ReviewInputControllers;
  state: DiffdiffAppState;
}

export function useMainKeyboard({
  actionDispatchMap,
  activeKeymapMode,
  commandActions,
  dismissErrorToast,
  textInputControllers,
  reviewInputControllers,
  state,
}: UseMainKeyboardOptions) {
  const keyboardHandlerRef = useRef<(key: KeyboardInput) => void>(() => undefined);

  function isPaneKeymapMode(mode: KeymapMode): boolean {
    return mode === "diff" || mode === "thread" || mode === "tree";
  }

  function isLeaderTextInputMode(mode: KeymapMode): boolean {
    return (
      mode === "commands" ||
      mode === "pull-request-search" ||
      mode === "commit-search" ||
      mode === "comment" ||
      mode === "submit-review" ||
      mode === "merge-title" ||
      mode === "merge-body"
    );
  }

  function handleTextInputKey(key: KeyboardInput): boolean {
    switch (activeKeymapMode) {
      case "commands": {
        return textInputControllers.commandPalette.applyKey(key);
      }
      case "pull-request-search": {
        return textInputControllers.pullRequestSearch.applyKey(key);
      }
      case "commit-search": {
        return textInputControllers.commitSearch.applyKey(key);
      }
      case "comment": {
        return reviewInputControllers.reviewComposer.applyKey(key);
      }
      case "submit-review": {
        return reviewInputControllers.reviewSubmission.applyKey(key);
      }
      case "merge-title": {
        return reviewInputControllers.mergeMessage.applyTitleKey(key);
      }
      case "merge-body": {
        return reviewInputControllers.mergeMessage.applyBodyKey(key);
      }
    }

    return false;
  }

  function syncPendingPrefix(label: string | undefined): void {
    if (label == null) {
      state.keybindController.clearPrefixMode();
      return;
    }

    const prefix = findKeymapPrefixByNodeLabel(label)?.prefix;
    if (prefix == null) {
      state.keybindController.clearPrefixMode();
      state.setStatusMessage(`${label} mode active. Awaiting next key.`);
      return;
    }

    const prefixMenu = getPrefixMenuConfig(prefix);
    if (prefixMenu == null) {
      return;
    }

    state.keybindController.enterPrefixMode(prefix, {
      preserveFocus: isLeaderTextInputMode(activeKeymapMode) || prefixMenu.preserveFocusByDefault,
      status: `${label} mode active. Awaiting next key.`,
      onClear: () => {
        state.keymapRuntime.reset();
      },
      onEnter: prefixMenu.onEnterMode,
    });
  }

  function handleResult(key: KeyboardInput): void {
    if (key.super === true && isLeaderTextInputMode(activeKeymapMode) && handleTextInputKey(key)) {
      return;
    }

    const event = keyEventFromInput(key);
    const result = state.keymapRuntime.get(activeKeymapMode, event);

    switch (result.kind) {
      case "matched": {
        state.keybindController.clearPrefixMode();
        if (dispatchAction(actionDispatchMap, result.actionId, result.count)) {
          return;
        }
        commandActions.runCommandByValue(result.actionId);
        return;
      }

      case "matched-sequence": {
        state.keybindController.clearPrefixMode();
        for (const actionId of result.actionIds) {
          if (!dispatchAction(actionDispatchMap, actionId, result.count)) {
            commandActions.runCommandByValue(actionId);
          }
        }
        return;
      }

      case "pending": {
        syncPendingPrefix(result.node.label);
        return;
      }

      case "cancelled": {
        const activePrefix = state.keybindController.getActivePrefix();
        const activePrefixMenu =
          activePrefix == null ? undefined : getPrefixMenuConfig(activePrefix);

        if (activePrefixMenu != null) {
          state.keybindController.clearPrefixMode(
            key.name === "escape"
              ? activePrefixMenu.cancelStatus
              : activePrefixMenu.getUnboundStatus(key.name),
          );
          return;
        }

        state.keybindController.clearPrefixMode();
        state.setStatusMessage("");
        return;
      }

      case "not-found": {
        state.keybindController.clearPrefixMode();
        const currentCount = state.keymapRuntime.count();
        if (currentCount != null) {
          state.setStatusMessage(`${currentCount}`);
          return;
        }

        handleTextInputKey(key);
      }
    }
  }

  keyboardHandlerRef.current = (key) => {
    if (
      isPaneKeymapMode(activeKeymapMode) &&
      state.errorToastMessage != null &&
      (key.name === "escape" || key.name === "x")
    ) {
      dismissErrorToast();
      return;
    }

    handleResult(key);
  };

  useEffect(() => {
    state.keymapRuntime.reset();
    state.keybindController.clearPrefixMode();
  }, [activeKeymapMode, state.keybindController, state.keymapRuntime]);

  useKeyboard(
    useCallback((key: KeyboardInput) => {
      keyboardHandlerRef.current(key);
    }, []),
  );
}
