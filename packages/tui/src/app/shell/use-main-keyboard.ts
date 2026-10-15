import { flushSync, useKeyboard } from "@opentui/react";
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
import { insertTextInputText } from "../text-input/input-state.ts";
import { updateReviewComposerInput } from "../review/review-composer-state.ts";
import type { PasteEvent } from "@opentui/core";
import { resolveDialogRect, type DialogFamily } from "../../components/dialog/geometry.ts";

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
  const pasteHandlerRef = useRef<(event: PasteEvent) => void>(() => undefined);

  function isPaneKeymapMode(mode: KeymapMode): boolean {
    return mode === "diff" || mode === "thread" || mode === "tree";
  }

  function isLeaderTextInputMode(mode: KeymapMode): boolean {
    return (
      mode === "commands" ||
      mode === "pull-request-search" ||
      mode === "reviewer-picker" ||
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
      case "help":
        return textInputControllers.commandPalette.applyKey(key);
      case "pull-request-search": {
        if (key.sequence === "/" && state.pullRequestSearchInput.value === "") return true;
        return textInputControllers.pullRequestSearch.applyKey(key);
      }
      case "reviewer-picker": {
        return textInputControllers.reviewerSearch.applyKey(key);
      }
      case "commit-search": {
        return textInputControllers.commitSearch.applyKey(key);
      }
      case "comment": {
        return reviewInputControllers.reviewComposer.applyKey(key);
      }
      case "submit-review": {
        return (
          state.reviewSubmissionField === "body" &&
          reviewInputControllers.reviewSubmission.applyKey(key)
        );
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
    const family: DialogFamily = [
      "comment",
      "submit-review",
      "merge-method",
      "merge-title",
      "merge-body",
      "confirm-merge",
    ].includes(activeKeymapMode)
      ? "form"
      : ["checks", "conversation", "diagnostics"].includes(activeKeymapMode)
        ? "inspector"
        : state.activeOverlay === "clear-reviewed"
          ? "confirm"
          : "picker";
    if (
      state.activeOverlay != null &&
      resolveDialogRect(family, state.terminalDimensions.width, state.terminalDimensions.height)
        .tooSmall &&
      key.name !== "escape"
    )
      return;
    if (
      activeKeymapMode === "comment" &&
      (key.name === "up" || key.name === "down") &&
      !key.ctrl &&
      !key.meta &&
      !state.writeGuard.isPending("comment")
    ) {
      if (reviewInputControllers.reviewComposer.applyKey(key)) return;
    }
    if (
      activeKeymapMode === "submit-review" &&
      state.reviewSubmissionField === "body" &&
      (key.name === "up" || key.name === "down") &&
      !key.ctrl &&
      !key.meta
    ) {
      reviewInputControllers.reviewSubmission.applyKey(key);
      return;
    }
    if (
      activeKeymapMode === "reviewer-picker" &&
      state.reviewerPickerAsyncRef.current.submitting &&
      key.name !== "escape"
    )
      return;
    const writeKey =
      activeKeymapMode === "comment"
        ? "comment"
        : activeKeymapMode === "submit-review"
          ? "review"
          : activeKeymapMode.startsWith("merge-") || activeKeymapMode === "confirm-merge"
            ? "merge"
            : undefined;
    if (writeKey != null && state.writeGuard.isPending(writeKey) && key.name !== "escape") return;
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

  pasteHandlerRef.current = (event) => {
    const multiline =
      activeKeymapMode === "comment" ||
      activeKeymapMode === "submit-review" ||
      activeKeymapMode === "merge-body";
    const normalized = new TextDecoder().decode(event.bytes).replace(/\r\n?/gu, "\n");
    const text = multiline ? normalized : normalized.replace(/\n/gu, " ");
    const insert = (input: import("../text-input/input-state.ts").TextInputState) =>
      insertTextInputText(input, text);
    switch (activeKeymapMode) {
      case "commands":
      case "help":
        state.setCommandInput(insert);
        state.setCommandIndex(0);
        break;
      case "pull-request-search":
        state.setPullRequestSearchInput(insert);
        state.setPullRequestListIndex(0);
        break;
      case "commit-search":
        state.setCommitSearchInput(insert);
        state.setCommitListIndex(0);
        state.setBranchListIndex(0);
        break;
      case "submit-review":
        if (state.writeGuard.isPending("review") || state.reviewSubmissionField !== "body") break;
        state.setReviewSubmissionInput(insert);
        break;
      case "merge-title":
      case "merge-body":
        if (state.writeGuard.isPending("merge")) break;
        (activeKeymapMode === "merge-title"
          ? state.setMergeCommitTitleInput
          : state.setMergeCommitMessageInput)(insert);
        break;
      case "reviewer-picker":
        if (state.reviewerPickerAsyncRef.current.submitting) break;
        state.setReviewerPicker((picker) => ({ ...picker, index: 0, input: insert(picker.input) }));
        break;
      case "comment":
        if (state.writeGuard.isPending("comment")) break;
        state.setReviewComposer((composer) => updateReviewComposerInput(composer, insert));
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    const handler = (event: PasteEvent) => flushSync(() => pasteHandlerRef.current(event));
    state.renderer.keyInput.on("paste", handler);
    return () => {
      state.renderer.keyInput.off("paste", handler);
    };
  }, [state.renderer]);

  useEffect(() => {
    state.keymapRuntime.reset();
    state.keybindController.clearPrefixMode();
  }, [activeKeymapMode, state.keybindController, state.keymapRuntime]);

  useKeyboard(
    useCallback((key: KeyboardInput) => {
      // Native stdin can deliver several keys before React commits. Commit each
      // event's state/mode transition before the parser emits the next key.
      flushSync(() => keyboardHandlerRef.current(key));
    }, []),
  );
}
