import type { KeyboardInput } from "../../../commands.ts";
import { clampIndex } from "../../../view-model.ts";
import { closeDialog as closeAppDialog } from "../../dialogs/stack.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

export function createSubmitReviewKeyHandler({
  handleTextInputLeaderKey,
  state,
  submitReviewFromModal,
}: {
  handleTextInputLeaderKey: (
    key: KeyboardInput,
    options?: { onLeaderDown?: () => void; onLeaderUp?: () => void },
  ) => boolean;
  state: DiffdiffAppState;
  submitReviewFromModal: () => Promise<void>;
}) {
  return function handleSubmitReviewModalKey(key: KeyboardInput): void {
    if (
      handleTextInputLeaderKey(key, {
        onLeaderDown: () => {
          state.setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex + 1, 3));
        },
        onLeaderUp: () => {
          state.setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex - 1, 3));
        },
      })
    ) {
      return;
    }

    if (key.name === "escape") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "submit-review", "dismiss"),
      );
      state.setReviewSubmissionBody("");
      state.setStatusMessage("Closed submit review modal.");
      return;
    }

    if (key.name === "down") {
      state.setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex + 1, 3));
      return;
    }

    if (key.name === "up") {
      state.setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex - 1, 3));
      return;
    }

    if (key.name === "backspace") {
      state.setReviewSubmissionBody((currentBody) => currentBody.slice(0, -1));
      return;
    }

    if (key.name === "return" && key.shift) {
      state.setReviewSubmissionBody((currentBody) => `${currentBody}\n`);
      return;
    }

    if (key.name === "return") {
      void submitReviewFromModal();
      return;
    }

    if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
      state.setReviewSubmissionBody((currentBody) => currentBody + key.sequence);
    }
  };
}
