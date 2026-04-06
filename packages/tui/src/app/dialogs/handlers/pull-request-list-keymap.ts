import type { KeyboardInput } from "../../../commands.ts";
import { clampIndex } from "../../../view-model.ts";
import { closeDialog as closeAppDialog } from "../stack.ts";
import type { DiffdiffAppDerived } from "../../shell/use-app-models.ts";
import type { DiffdiffAppState } from "../../state/use-app-state.ts";

interface PullRequestListKeymapOptions {
  applyDashboardPullRequestSelection: (
    pullRequest: import("@diffdiff/core").GitHubDashboardPullRequest,
  ) => Promise<void>;
  derived: DiffdiffAppDerived;
  handleTextInputPrefixKeypress: (
    key: KeyboardInput,
    options?: { onPrefixDown?: () => void; onPrefixUp?: () => void },
  ) => boolean;
  refreshGitHubPullRequestList: () => Promise<void>;
  state: DiffdiffAppState;
}

export function createPullRequestListKeyHandler({
  applyDashboardPullRequestSelection,
  derived,
  handleTextInputPrefixKeypress,
  refreshGitHubPullRequestList,
  state,
}: PullRequestListKeymapOptions) {
  return function handlePullRequestListModalKey(key: KeyboardInput): void {
    if (state.pullRequestSearchActive) {
      if (
        handleTextInputPrefixKeypress(key, {
          onPrefixDown: () => {
            state.setPullRequestListIndex((currentIndex) =>
              clampIndex(currentIndex + 1, derived.filteredPullRequests.length),
            );
          },
          onPrefixUp: () => {
            state.setPullRequestListIndex((currentIndex) =>
              clampIndex(currentIndex - 1, derived.filteredPullRequests.length),
            );
          },
        })
      ) {
        return;
      }

      if (key.name === "escape") {
        state.setPullRequestSearchActive(false);
        state.setPullRequestSearchQuery("");
        state.setPullRequestListIndex(0);
        return;
      }

      if (key.name === "return") {
        state.setPullRequestSearchActive(false);
        return;
      }

      if (key.name === "backspace") {
        state.setPullRequestSearchQuery((query) => query.slice(0, -1));
        state.setPullRequestListIndex(0);
        return;
      }

      if (key.name === "down") {
        state.setPullRequestListIndex((currentIndex) =>
          clampIndex(currentIndex + 1, derived.filteredPullRequests.length),
        );
        return;
      }

      if (key.name === "up") {
        state.setPullRequestListIndex((currentIndex) =>
          clampIndex(currentIndex - 1, derived.filteredPullRequests.length),
        );
        return;
      }

      if (key.sequence != null && key.sequence.length === 1 && key.sequence >= " ") {
        state.setPullRequestSearchQuery((query) => query + key.sequence);
        state.setPullRequestListIndex(0);
      }

      return;
    }

    if (key.name === "escape" || key.name === "q") {
      state.setDialogStack((currentStack) =>
        closeAppDialog(currentStack, "pull-request-list", "dismiss"),
      );
      state.setPullRequestSearchActive(false);
      state.setPullRequestSearchQuery("");
      state.setStatusMessage("Closed pull request list.");
      return;
    }

    if (key.name === "f" && key.shift) {
      void refreshGitHubPullRequestList();
      return;
    }

    if (key.name === "j" || key.name === "down") {
      state.setPullRequestListIndex((currentIndex) =>
        clampIndex(currentIndex + 1, derived.filteredPullRequests.length),
      );
      return;
    }

    if (key.name === "k" || key.name === "up") {
      state.setPullRequestListIndex((currentIndex) =>
        clampIndex(currentIndex - 1, derived.filteredPullRequests.length),
      );
      return;
    }

    if (key.name === "home") {
      state.setPullRequestListIndex(0);
      return;
    }

    if (key.name === "end") {
      state.setPullRequestListIndex(Math.max(derived.filteredPullRequests.length - 1, 0));
      return;
    }

    if (key.sequence === "/") {
      state.setPullRequestSearchActive(true);
      return;
    }

    if (key.name === "return" && derived.selectedPullRequest != null) {
      void applyDashboardPullRequestSelection(derived.selectedPullRequest);
    }
  };
}
