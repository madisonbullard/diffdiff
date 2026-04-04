import { useKeyboard } from "@opentui/react";
import { useCallback, useRef } from "react";
import { matchCommandKeybind, type KeyboardInput } from "../commands.ts";
import { COMMAND_LIST_KEYBIND, LEADER_KEYBIND } from "./helpers.ts";
import { closeDialog as closeAppDialog } from "./dialog-stack.ts";
import type { KeymapMode } from "./keymap-mode.ts";
import type { DiffdiffAppDerived } from "./diffdiff-app-derived.ts";
import type { DiffdiffAppState } from "./diffdiff-app-state.ts";
import type { AppCommand } from "./command-registry.ts";

interface UseMainKeyboardOptions {
  activeKeymapMode: KeymapMode;
  commandActions: {
    clearLeaderMode: (status?: string) => void;
    enterLeaderMode: (options?: { preserveFocus?: boolean }) => void;
    runCommand: (command: AppCommand) => void;
    runCommandByValue: (value: string) => void;
  };
  derived: DiffdiffAppDerived;
  dismissErrorToast: () => void;
  findCommandByKey: (key: KeyboardInput, leader?: boolean) => AppCommand | undefined;
  handleBranchModalKey: (key: KeyboardInput) => void;
  handleCleanupModalKey: (key: KeyboardInput) => void;
  handleCommandModalKey: (key: KeyboardInput) => void;
  handleCommentComposerKey: (key: KeyboardInput) => void;
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
  handleBranchModalKey,
  handleCleanupModalKey,
  handleCommandModalKey,
  handleCommentComposerKey,
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

  function handleLeaderModeKey(key: KeyboardInput): void {
    if (key.name === "escape") {
      commandActions.clearLeaderMode("Canceled leader key.");
      return;
    }

    const command = findCommandByKey(key, true);
    if (command != null) {
      commandActions.runCommand(command);
      return;
    }

    commandActions.clearLeaderMode(`No command is bound to leader ${key.name}.`);
  }

  function handleMainPaneKey(key: KeyboardInput, globalKeybindsSuspended: boolean): void {
    if (globalKeybindsSuspended) {
      return;
    }

    if (matchCommandKeybind(LEADER_KEYBIND, key)) {
      commandActions.enterLeaderMode();
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
      case "leader":
        handleLeaderModeKey(key);
        return;
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
    const leaderModeActive = state.keybindController.isLeaderActive();
    const globalKeybindsSuspended = state.keybindController.globalKeybindsSuspended();

    if (
      isPaneKeymapMode(activeKeymapMode) &&
      state.errorToastMessage != null &&
      (key.name === "escape" || key.name === "x")
    ) {
      dismissErrorToast();
      return;
    }

    if (leaderModeActive && isPaneKeymapMode(activeKeymapMode)) {
      handleLeaderModeKey(key);
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
