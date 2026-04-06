import { useKeyboard } from "@opentui/react";
import { useCallback, useRef } from "react";
import {
  matchCommandKeybind,
  type CommandKeybindPrefix,
  type KeyboardInput,
} from "../../commands.ts";
import { COMMAND_LIST_KEYBIND } from "../shared/constants.ts";
import { closeDialog as closeAppDialog } from "../dialogs/stack.ts";
import type { KeymapMode } from "./keymap-mode.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { AppCommand } from "../commands/registry.ts";
import {
  getPrefixMenuByTriggerKey,
  getPrefixMenuConfig,
  type PrefixMenuConfig,
} from "../commands/prefix-menus.ts";

interface UseMainKeyboardOptions {
  activeKeymapMode: KeymapMode;
  commandActions: {
    clearPrefixMode: (status?: string) => void;
    enterPrefixMode: (prefix: CommandKeybindPrefix, options?: { preserveFocus?: boolean }) => void;
    runCommand: (command: AppCommand) => void;
    runCommandByValue: (value: string) => void;
  };
  dismissErrorToast: () => void;
  findCommandByKey: (
    key: KeyboardInput,
    prefix?: CommandKeybindPrefix | null,
  ) => AppCommand | undefined;
  getPrefixMenuCommands: (
    prefix: CommandKeybindPrefix,
  ) => readonly import("../commands/prefix-menus.ts").PrefixMenuCommand[];
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
  handleTreePaneKey: (key: KeyboardInput) => boolean;
  handleMergeModalKey: (key: KeyboardInput) => void;
  moveSelectedFile: (delta: number) => void;
  moveSelectedReviewAnchor: (delta: number) => void;
  state: DiffdiffAppState;
}

export function useMainKeyboard({
  activeKeymapMode,
  commandActions,
  dismissErrorToast,
  findCommandByKey,
  getPrefixMenuCommands,
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
  handleTreePaneKey,
  handleMergeModalKey,
  moveSelectedFile,
  moveSelectedReviewAnchor,
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

  function handleActivePrefixKey(key: KeyboardInput, prefixMenu: PrefixMenuConfig): void {
    if (key.name === "escape") {
      commandActions.clearPrefixMode(prefixMenu.cancelStatus);
      return;
    }

    const command = findCommandByKey(key, prefixMenu.prefix);
    if (command != null) {
      commandActions.runCommand(command);
      return;
    }

    commandActions.clearPrefixMode(prefixMenu.getUnboundStatus(key.name));
  }

  function maybeEnterPrefixMode(key: KeyboardInput): boolean {
    const prefixMenu = getPrefixMenuByTriggerKey(key);
    if (prefixMenu == null) {
      return false;
    }

    const prefixCommands = getPrefixMenuCommands(prefixMenu.prefix);
    if (prefixCommands.length === 0) {
      return false;
    }

    commandActions.enterPrefixMode(prefixMenu.prefix);
    return true;
  }

  function handleMainPaneKey(key: KeyboardInput, globalKeybindsSuspended: boolean): void {
    if (globalKeybindsSuspended) {
      return;
    }

    if (maybeEnterPrefixMode(key)) {
      return;
    }

    if (matchCommandKeybind(COMMAND_LIST_KEYBIND, key)) {
      commandActions.runCommandByValue("system.command-palette");
      return;
    }

    if (key.sequence === "?") {
      commandActions.runCommandByValue("system.help");
      return;
    }

    if (state.activePane === "tree") {
      if (handleTreePaneKey(key)) {
        return;
      }

      const treeCommand = findCommandByKey(key);
      if (treeCommand != null) {
        commandActions.runCommand(treeCommand);
      }
      return;
    }

    const command = findCommandByKey(key);
    if (command != null) {
      commandActions.runCommand(command);
      return;
    }

    if (key.name === "j" || key.name === "down") {
      moveSelectedFile(1);
      return;
    }

    if (key.name === "k" || key.name === "up") {
      moveSelectedFile(-1);
      return;
    }

    if (key.name === "home") {
      state.setSelectedFileIndex(0);
      state.setStatusMessage("Jumped to the first file.");
      return;
    }

    if (key.name === "end") {
      state.setSelectedFileIndex(Math.max(state.session.files.length - 1, 0));
      state.setStatusMessage("Jumped to the last file.");
      return;
    }

    if (key.name === "[") {
      moveSelectedReviewAnchor(-1);
      return;
    }

    if (key.name === "]") {
      moveSelectedReviewAnchor(1);
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
    const activePrefix = state.keybindController.getActivePrefix();
    const activePrefixMenu = activePrefix == null ? undefined : getPrefixMenuConfig(activePrefix);
    const globalKeybindsSuspended = state.keybindController.globalKeybindsSuspended();

    if (
      isPaneKeymapMode(activeKeymapMode) &&
      state.errorToastMessage != null &&
      (key.name === "escape" || key.name === "x")
    ) {
      dismissErrorToast();
      return;
    }

    if (activePrefixMenu != null && isPaneKeymapMode(activeKeymapMode)) {
      handleActivePrefixKey(key, activePrefixMenu);
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
