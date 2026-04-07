import { copyTextToClipboard } from "../../clipboard.ts";
import { copySessionReopenCommand } from "../../session-reopen-command.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { DiffdiffAppDerived } from "./use-app-models.ts";

interface CreateViewActionsOptions {
  derived: DiffdiffAppDerived;
  persistence: DiffdiffAppPersistence;
  props: Pick<DiffdiffAppProps, "openFileInEditor">;
  state: DiffdiffAppState;
}

export function createViewActions({
  derived,
  persistence,
  props,
  state,
}: CreateViewActionsOptions) {
  async function copyCurrentSessionReopenCommand(): Promise<void> {
    try {
      await copySessionReopenCommand({
        comparison: state.session.comparison,
        initialListMode: state.startupOptions.initialListMode,
        repositoryRootPath: state.session.repository.rootPath,
        verbose: state.startupOptions.verbose,
      });
      persistence.persistenceApi.showToast("Copied reopen command to clipboard");
    } catch (error) {
      persistence.persistenceApi.handleAppError(error, "Unable to copy the reopen command.", {
        action: "copy-reopen-command",
        comparison: state.session.comparison,
        initialListMode: state.startupOptions.initialListMode,
        repositoryRootPath: state.session.repository.rootPath,
        verbose: state.startupOptions.verbose,
      });
    }
  }

  async function copyPullRequestUrl(): Promise<void> {
    if (state.session.github == null) {
      state.setStatusMessage("Open a GitHub pull request first.");
      return;
    }

    const copied = await copyTextToClipboard(state.session.github.pullRequest.url);
    if (copied) {
      persistence.persistenceApi.showToast("Copied PR URL to clipboard");
      return;
    }

    persistence.persistenceApi.handleAppFailure("Unable to copy the PR URL.", {
      action: "copy-pr-url",
    });
  }

  async function openFocusedFileInEditor(): Promise<void> {
    const focusedFilePath =
      state.activePane === "tree"
        ? derived.selectedTreeNode?.kind === "file"
          ? derived.selectedTreeNode.path
          : undefined
        : derived.selectedFilePath;

    if (focusedFilePath == null) {
      state.setStatusMessage(
        state.activePane === "tree"
          ? "Select a file in the tree first."
          : "No file is focused right now.",
      );
      return;
    }

    state.renderer.suspend();

    try {
      await props.openFileInEditor(state.session.repository.rootPath, focusedFilePath);
      state.setStatusMessage(`Opened ${focusedFilePath} in the editor.`);
    } catch (error) {
      persistence.persistenceApi.handleAppError(
        error,
        "Unable to open the focused file in the editor.",
        {
          action: "open-file-in-editor",
          filePath: focusedFilePath,
          repositoryRootPath: state.session.repository.rootPath,
        },
      );
    } finally {
      state.renderer.resume();
    }
  }

  return {
    copyCurrentSessionReopenCommand,
    copyPullRequestUrl,
    openFocusedFileInEditor,
  };
}
