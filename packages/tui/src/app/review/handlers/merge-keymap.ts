import type { KeyboardInput } from "../../../commands.ts";
import { closeDialog as closeAppDialog } from "../../dialogs/stack.ts";
import { getMergeMethod, getMergeMethodIndex } from "../../../review/formatting.ts";
import type { DiffdiffAppPersistence } from "../../session/use-app-persistence.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

export function createMergeKeyHandler({
  handleTextInputLeaderKey,
  openMergeConfirmModal,
  persistence,
  state,
  submitMergeFromModal,
}: {
  handleTextInputLeaderKey: (
    key: KeyboardInput,
    options?: { onLeaderDown?: () => void; onLeaderUp?: () => void },
  ) => boolean;
  openMergeConfirmModal: () => void;
  persistence: DiffdiffAppPersistence;
  state: DiffdiffAppState;
  submitMergeFromModal: () => Promise<void>;
}) {
  function handleMergeConfirmModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q") {
      state.setMergeConfirmOpen(false);
      state.setStatusMessage("Returned to the merge form.");
      return;
    }

    if (key.name === "return") {
      void submitMergeFromModal();
    }
  }

  return function handleMergeModalKey(key: KeyboardInput): void {
    if (state.mergeConfirmOpen) {
      handleMergeConfirmModalKey(key);
      return;
    }

    if (
      (state.mergeModalField === "title" || state.mergeModalField === "body") &&
      handleTextInputLeaderKey(key)
    ) {
      return;
    }

    if (key.name === "escape") {
      state.setMergeConfirmOpen(false);
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "merge", "dismiss"));
      state.setStatusMessage("Closed merge modal.");
      return;
    }

    if (key.name === "tab") {
      state.setMergeModalField((currentField) => {
        switch (currentField) {
          case "method":
            return "title";
          case "title":
            return "body";
          case "body":
            return "method";
        }
      });
      return;
    }

    if (state.mergeModalField === "method") {
      if (key.name === "j" || key.name === "down" || key.name === "k" || key.name === "up") {
        const delta = key.name === "j" || key.name === "down" ? 1 : -1;
        const nextMethod = getMergeMethod(getMergeMethodIndex(state.mergeMethod) + delta);
        state.setMergeMethod(nextMethod);
        void persistence.persistenceApi.persistGitHubPreferences({
          ...state.gitHubPreferencesRef.current,
          defaultMergeMethod: nextMethod,
        });
        state.setStatusMessage(`Default merge method set to ${nextMethod}.`);
      }
      if (key.name === "return") {
        openMergeConfirmModal();
      }
      return;
    }

    if (state.mergeModalField === "title") {
      if (key.name === "backspace") {
        state.setMergeCommitTitle((currentTitle) => currentTitle.slice(0, -1));
        return;
      }

      if (key.name === "return") {
        openMergeConfirmModal();
        return;
      }

      if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
        state.setMergeCommitTitle((currentTitle) => currentTitle + key.sequence);
      }
      return;
    }

    if (key.name === "backspace") {
      state.setMergeCommitMessage((currentBody) => currentBody.slice(0, -1));
      return;
    }

    if (key.name === "return" && key.shift) {
      state.setMergeCommitMessage((currentBody) => `${currentBody}\n`);
      return;
    }

    if (key.name === "return") {
      openMergeConfirmModal();
      return;
    }

    if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
      state.setMergeCommitMessage((currentBody) => currentBody + key.sequence);
    }
  };
}
