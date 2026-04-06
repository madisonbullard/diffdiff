import type { KeyboardInput } from "../../../commands.ts";
import { closeDialog as closeAppDialog } from "../../dialogs/stack.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

export function createCommentComposerKeyHandler({
  handleTextInputPrefixKeypress,
  state,
  submitCommentComposer,
}: {
  handleTextInputPrefixKeypress: (
    key: KeyboardInput,
    options?: { onPrefixDown?: () => void; onPrefixUp?: () => void },
  ) => boolean;
  state: DiffdiffAppState;
  submitCommentComposer: () => Promise<void>;
}) {
  return function handleCommentComposerKey(key: KeyboardInput): void {
    if (handleTextInputPrefixKeypress(key)) {
      return;
    }

    if (key.name === "escape") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "comment-composer", "dismiss"),
      );
      state.setReviewComposerTarget(null);
      state.setReviewComposerBody("");
      state.setStatusMessage("Closed comment composer.");
      return;
    }

    if (key.name === "backspace") {
      state.setReviewComposerBody((currentBody) => currentBody.slice(0, -1));
      return;
    }

    if (key.name === "return" && key.shift) {
      state.setReviewComposerBody((currentBody) => `${currentBody}\n`);
      return;
    }

    if (key.name === "return") {
      void submitCommentComposer();
      return;
    }

    if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
      state.setReviewComposerBody((currentBody) => currentBody + key.sequence);
    }
  };
}
