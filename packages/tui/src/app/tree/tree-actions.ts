import type { KeyboardInput } from "../../commands.ts";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { clampIndex } from "../../view-model.ts";
import { getAncestorDirectoryPaths } from "../shared/collections.ts";
import type { PendingInteraction } from "../state/app-props.ts";
import { selectFileIndexWithPendingScrollOffset } from "../shared/file-selection.ts";
import { REVIEWED_NEXT_FILE_SCROLL_OFFSET } from "../shared/constants.ts";

interface CreateTreeActionsOptions {
  derived: DiffdiffAppDerived;
  startInteraction: (
    kind: string,
    options?: Omit<PendingInteraction, "kind" | "startedAt" | "token">,
  ) => void;
  state: DiffdiffAppState;
}

export function createTreeActions({ derived, startInteraction, state }: CreateTreeActionsOptions) {
  function toggleActivePane(): void {
    const nextPane = state.activePane === "diff" ? "tree" : "diff";
    startInteraction("pane_toggle", {
      details: { fromPane: state.activePane, toPane: nextPane },
      expectedPane: nextPane,
    });
    state.setActivePane(nextPane);
    state.setStatusMessage(nextPane === "tree" ? "File tree active." : "Diff view active.");
  }

  function expandFileTreeAncestors(path: string): void {
    state.setCollapsedDirectories((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      let changed = false;

      for (const ancestorPath of getAncestorDirectoryPaths(path)) {
        if (nextPaths.delete(ancestorPath)) {
          changed = true;
        }
      }

      return changed ? nextPaths : currentPaths;
    });
  }

  function setFileTreeDirectoryCollapsed(path: string, isCollapsed: boolean): void {
    state.setCollapsedDirectories((currentPaths) => {
      const nextPaths = new Set(currentPaths);

      if (isCollapsed) {
        if (nextPaths.has(path)) {
          return currentPaths;
        }

        nextPaths.add(path);
        state.setStatusMessage(`Collapsed ${path}/ in the file tree.`);
        return nextPaths;
      }

      if (!nextPaths.delete(path)) {
        return currentPaths;
      }

      state.setStatusMessage(`Expanded ${path}/ in the file tree.`);
      return nextPaths;
    });
  }

  function selectTreeNode(
    node: import("../../types.ts").FileTreeNode,
    options?: { openDiff?: boolean },
  ): void {
    startInteraction(node.kind === "directory" ? "tree_selection" : "file_selection", {
      details:
        node.kind === "directory"
          ? { path: node.path, trigger: options?.openDiff ? "tree-open" : "tree-navigation" }
          : {
              fromFilePath: derived.selectedFilePath,
              toFilePath: node.path,
              trigger: options?.openDiff ? "tree-open" : "tree-selection",
            },
      expectedPane: node.kind === "file" && options?.openDiff ? "diff" : undefined,
      expectedSelectedFilePath: node.kind === "file" ? node.path : undefined,
      expectedSelectedTreePath: node.path,
    });

    state.setSelectedTreePath(node.path);
    if (node.kind === "directory") {
      state.setStatusMessage(`Selected ${node.path}/ in the file tree.`);
      return;
    }

    expandFileTreeAncestors(node.path);
    selectFileIndexWithPendingScrollOffset(
      state.setSelectedFileIndex,
      state.pendingSelectedFileScrollOffsetRef,
      node.fileIndex,
      REVIEWED_NEXT_FILE_SCROLL_OFFSET,
    );
    state.setStatusMessage(options?.openDiff ? `Opened ${node.path}.` : `Selected ${node.path}.`);

    if (options?.openDiff) {
      state.setActivePane("diff");
    }
  }

  function openSelectedTreeFile(): void {
    if (derived.selectedTreeNode?.kind !== "file") {
      state.setStatusMessage("Select a file in the tree first.");
      return;
    }

    selectTreeNode(derived.selectedTreeNode, { openDiff: true });
  }

  function moveTreeSelection(delta: number): void {
    if (derived.visibleTreeNodes.length === 0) {
      return;
    }

    const currentIndex = derived.visibleTreeNodeIndexByPath.get(state.selectedTreePath) ?? -1;
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = clampIndex(startIndex + delta, derived.visibleTreeNodes.length);
    const nextNode = derived.visibleTreeNodes[nextIndex];
    if (nextNode != null) {
      selectTreeNode(nextNode);
    }
  }

  function handleTreePaneKey(key: KeyboardInput): boolean {
    if (key.name === "j" || key.name === "down") {
      moveTreeSelection(1);
      return true;
    }

    if (key.name === "k" || key.name === "up") {
      moveTreeSelection(-1);
      return true;
    }

    if (key.name === "home") {
      const firstNode = derived.visibleTreeNodes[0];
      if (firstNode != null) {
        selectTreeNode(firstNode);
      }
      return true;
    }

    if (key.name === "end") {
      const lastNode = derived.visibleTreeNodes[Math.max(derived.visibleTreeNodes.length - 1, 0)];
      if (lastNode != null) {
        selectTreeNode(lastNode);
      }
      return true;
    }

    const currentNode =
      derived.selectedTreeNode ??
      derived.visibleTreeNodes.find((node) => node.kind === "file") ??
      derived.visibleTreeNodes[0];
    if (currentNode == null) {
      return false;
    }

    if (key.name === "left" || key.name === "h") {
      if (currentNode.kind === "directory" && !state.collapsedDirectories.has(currentNode.path)) {
        setFileTreeDirectoryCollapsed(currentNode.path, true);
        return true;
      }

      if (currentNode.parentPath != null) {
        const parentNode = derived.fileTreeNodeByPath.get(currentNode.parentPath);
        if (parentNode != null) {
          selectTreeNode(parentNode);
        }
      }
      return true;
    }

    if (key.name === "right" || key.name === "l") {
      if (currentNode.kind === "directory") {
        if (state.collapsedDirectories.has(currentNode.path)) {
          setFileTreeDirectoryCollapsed(currentNode.path, false);
          return true;
        }

        const childNode = derived.visibleTreeNodes.find(
          (node) => node.parentPath === currentNode.path,
        );
        if (childNode != null) {
          selectTreeNode(childNode);
        }
        return true;
      }

      selectTreeNode(currentNode, { openDiff: true });
      return true;
    }

    if (key.name === "return") {
      if (currentNode.kind === "directory") {
        setFileTreeDirectoryCollapsed(
          currentNode.path,
          !state.collapsedDirectories.has(currentNode.path),
        );
      } else {
        selectTreeNode(currentNode, { openDiff: true });
      }
      return true;
    }

    return false;
  }

  function handleFileTreeMouseUp(node: import("../../types.ts").FileTreeNode): void {
    if (node.kind === "directory") {
      state.setActivePane("tree");
      state.setSelectedTreePath(node.path);
      setFileTreeDirectoryCollapsed(node.path, !state.collapsedDirectories.has(node.path));
      return;
    }

    selectTreeNode(node, { openDiff: true });
  }

  return {
    handleFileTreeMouseUp,
    handleTreePaneKey,
    moveTreeSelection,
    openSelectedTreeFile,
    selectTreeNode,
    setFileTreeDirectoryCollapsed,
    toggleActivePane,
  };
}
