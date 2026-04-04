import type { KeyboardInput } from "../../../commands.ts";
import { clampIndex } from "../../../view-model.ts";
import { closeDialog as closeAppDialog } from "../../dialogs/stack.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

export function createConversationKeyHandler({
  copySelectedPullRequestConversationItemUrl,
  openPullRequestConversationReplyComposer,
  state,
}: {
  copySelectedPullRequestConversationItemUrl: () => Promise<void>;
  openPullRequestConversationReplyComposer: () => void;
  state: DiffdiffAppState;
}) {
  return function handlePullRequestCommentsModalKey(key: KeyboardInput): void {
    if (key.name === "escape" || key.name === "q" || key.name === "t") {
      state.setDialogStack((currentStack) => closeAppDialog(currentStack, "comments", "dismiss"));
      state.setStatusMessage("Closed PR conversation.");
      return;
    }

    if (key.name === "j" || key.name === "down") {
      state.setPullRequestConversationIndex((currentIndex) =>
        clampIndex(
          currentIndex + 1,
          state.session.github?.pullRequest.conversationItems.length ?? 0,
        ),
      );
      return;
    }

    if (key.name === "k" || key.name === "up") {
      state.setPullRequestConversationIndex((currentIndex) =>
        clampIndex(
          currentIndex - 1,
          state.session.github?.pullRequest.conversationItems.length ?? 0,
        ),
      );
      return;
    }

    if (key.name === "r") {
      openPullRequestConversationReplyComposer();
      return;
    }

    if (key.name === "y") {
      void copySelectedPullRequestConversationItemUrl();
    }
  };
}
