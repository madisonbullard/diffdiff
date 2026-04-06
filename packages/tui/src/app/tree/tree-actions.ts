import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { clampIndex } from "../../view-model.ts";
import { getAncestorDirectoryPaths } from "../shared/collections.ts";
import type { FileFocusController } from "../shared/file-focus.ts";
import type { PendingInteraction } from "../state/app-props.ts";

interface CreateTreeActionsOptions {
  derived: DiffdiffAppDerived;
  fileFocus: FileFocusController;
  startInteraction: (
    kind: string,
    options?: Omit<PendingInteraction, "kind" | "startedAt" | "token">,
  ) => void;
  state: DiffdiffAppState;
}

export function createTreeActions({
  derived,
  fileFocus,
  startInteraction,
  state,
}: CreateTreeActionsOptions) {
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
    fileFocus.focusFile({
      activatePane: options?.openDiff ? "diff" : "preserve",
      reveal: "align-under-sticky-header",
      target: { path: node.path },
    });
    state.setStatusMessage(options?.openDiff ? `Opened ${node.path}.` : `Selected ${node.path}.`);
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

  function resolveCurrentTreeNode() {
    return (
      derived.selectedTreeNode ??
      derived.visibleTreeNodes.find((node) => node.kind === "file") ??
      derived.visibleTreeNodes[0]
    );
  }

  function collapseOrGoToParent(): void {
    const currentNode = resolveCurrentTreeNode();
    if (currentNode == null) return;

    if (currentNode.kind === "directory" && !state.collapsedDirectories.has(currentNode.path)) {
      setFileTreeDirectoryCollapsed(currentNode.path, true);
      return;
    }

    if (currentNode.parentPath != null) {
      const parentNode = derived.fileTreeNodeByPath.get(currentNode.parentPath);
      if (parentNode != null) {
        selectTreeNode(parentNode);
      }
    }
  }

  function expandOrEnterChild(): void {
    const currentNode = resolveCurrentTreeNode();
    if (currentNode == null) return;

    if (currentNode.kind === "directory") {
      if (state.collapsedDirectories.has(currentNode.path)) {
        setFileTreeDirectoryCollapsed(currentNode.path, false);
        return;
      }

      const childNode = derived.visibleTreeNodes.find(
        (node) => node.parentPath === currentNode.path,
      );
      if (childNode != null) {
        selectTreeNode(childNode);
      }
      return;
    }

    selectTreeNode(currentNode, { openDiff: true });
  }

  function toggleOrOpen(): void {
    const currentNode = resolveCurrentTreeNode();
    if (currentNode == null) return;

    if (currentNode.kind === "directory") {
      setFileTreeDirectoryCollapsed(
        currentNode.path,
        !state.collapsedDirectories.has(currentNode.path),
      );
    } else {
      selectTreeNode(currentNode, { openDiff: true });
    }
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
    collapseOrGoToParent,
    expandOrEnterChild,
    handleFileTreeMouseUp,
    moveTreeSelection,
    openSelectedTreeFile,
    selectTreeNode,
    setFileTreeDirectoryCollapsed,
    toggleActivePane,
    toggleOrOpen,
  };
}
