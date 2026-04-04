import type { KeyboardInput } from "../../../commands.ts";
import { clampIndex } from "../../../view-model.ts";
import { closeDialog as closeAppDialog } from "../../dialogs/stack.ts";
import type { DiffdiffAppPersistence } from "../../session/use-app-persistence.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

export function createCleanupKeyHandler({
  applyCleanupSelection,
  persistence,
  state,
}: {
  applyCleanupSelection: () => Promise<void>;
  persistence: DiffdiffAppPersistence;
  state: DiffdiffAppState;
}) {
  return function handleCleanupModalKey(key: KeyboardInput): void {
    const entryCount = 2;

    if (key.name === "escape") {
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "cleanup", "dismiss"));
      state.setCleanupCandidates([]);
      state.setStatusMessage("Skipped post-merge cleanup.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      state.setCleanupCandidateIndex((currentIndex) => clampIndex(currentIndex + 1, entryCount));
      return;
    }

    if (key.name === "k" || key.name === "up") {
      state.setCleanupCandidateIndex((currentIndex) => clampIndex(currentIndex - 1, entryCount));
      return;
    }

    if (key.name === "space") {
      const nextKey = state.cleanupCandidateIndex === 0 ? "removeLocal" : "removeRemote";
      const hasCandidate = state.cleanupCandidates.some((candidate) =>
        nextKey === "removeLocal"
          ? candidate.kind === "local-branch"
          : candidate.kind === "remote-tracking",
      );
      if (!hasCandidate) {
        return;
      }

      persistence.persistenceApi.updateCleanupSelection((currentSelection) => ({
        ...currentSelection,
        [nextKey]: !currentSelection[nextKey],
      }));
      return;
    }

    if (key.name === "return") {
      void applyCleanupSelection();
    }
  };
}
