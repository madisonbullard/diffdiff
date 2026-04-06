/**
 * Builds the action dispatch map that connects trie-resolved action IDs
 * to the imperative handler functions provided by review-actions, tree-actions,
 * and other action factories.
 *
 * This is the bridge between the keymap system and the app behavior. Every
 * action that can be triggered by a key binding is registered here with an
 * `ActionHandler` that receives the optional numeric count prefix.
 */

import type { ActionDispatchMap } from "../keymap/action-dispatch.ts";
import * as A from "../keymap/actions.ts";
import { clampIndex } from "../../view-model.ts";
import type { FileFocusController } from "../shared/file-focus.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { DiffdiffAppDerived } from "./use-app-models.ts";
import type { createReviewActions } from "../review/review-actions.ts";
import type { createTreeActions } from "../tree/tree-actions.ts";

interface BuildActionDispatchMapOptions {
  derived: DiffdiffAppDerived;
  fileFocus: FileFocusController;
  reviewActions: ReturnType<typeof createReviewActions>;
  state: DiffdiffAppState;
  treeActions: ReturnType<typeof createTreeActions>;
}

export function buildActionDispatchMap({
  derived,
  fileFocus,
  reviewActions,
  state,
  treeActions,
}: BuildActionDispatchMapOptions): ActionDispatchMap {
  const map: ActionDispatchMap = new Map();

  // -------------------------------------------------------------------------
  // Review / file navigation (diff pane)
  // -------------------------------------------------------------------------

  map.set(A.REVIEW_NEXT_FILE, (count) => {
    reviewActions.moveSelectedFile(count ?? 1);
  });

  map.set(A.REVIEW_PREVIOUS_FILE, (count) => {
    reviewActions.moveSelectedFile(-(count ?? 1));
  });

  map.set(A.REVIEW_FIRST_FILE, (count) => {
    // Delegates to goto.first-file so `home` gets free count support.
    map.get(A.GOTO_FIRST_FILE)?.(count);
  });

  map.set(A.REVIEW_LAST_FILE, (count) => {
    map.get(A.GOTO_LAST_FILE)?.(count);
  });

  map.set(A.REVIEW_NEXT_ANCHOR, (count) => {
    reviewActions.moveSelectedReviewAnchor(count ?? 1);
  });

  map.set(A.REVIEW_PREVIOUS_ANCHOR, (count) => {
    reviewActions.moveSelectedReviewAnchor(-(count ?? 1));
  });

  map.set(A.REVIEW_TOGGLE_REVIEWED, () => {
    reviewActions.toggleReviewed(state.selectedFileIndex);
  });

  map.set(A.REVIEW_TOGGLE_COLLAPSED, () => {
    reviewActions.toggleCollapsed(state.selectedFileIndex);
  });

  map.set(A.REVIEW_NEXT_UNREVIEWED, () => {
    reviewActions.jumpToNextUnreviewedFile();
  });

  // -------------------------------------------------------------------------
  // Goto actions (g prefix menu)
  // -------------------------------------------------------------------------

  map.set(A.GOTO_FIRST_FILE, (count) => {
    if (count != null) {
      // `5gg` → go to file 5 (1-indexed, like Helix goto_file_start)
      const targetIndex = clampIndex(count - 1, state.session.files.length);
      const targetPath = state.session.files[targetIndex]?.path;
      fileFocus.focusFile({
        activatePane: "preserve",
        reveal: "default",
        target: { index: targetIndex },
      });
      state.setStatusMessage(
        targetPath != null ? `Jumped to file ${count}: ${targetPath}.` : `Jumped to file ${count}.`,
      );
    } else {
      // `gg` → go to first file
      fileFocus.focusFile({ activatePane: "preserve", reveal: "default", target: { index: 0 } });
      state.setStatusMessage("Jumped to the first file.");
    }
  });

  map.set(A.GOTO_LAST_FILE, () => {
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: "default",
      target: { index: Math.max(state.session.files.length - 1, 0) },
    });
    state.setStatusMessage("Jumped to the last file.");
  });

  map.set(A.GOTO_WINDOW_TOP, () => {
    // Jump to the file at the top of the visible viewport.
    // activeFileIndex tracks which file's sticky header is visible.
    const topIndex = clampIndex(state.activeFileIndex, state.session.files.length);
    const topPath = state.session.files[topIndex]?.path;
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: "none",
      target: { index: topIndex },
    });
    state.setStatusMessage(topPath != null ? `Jumped to top: ${topPath}.` : "Jumped to top.");
  });

  map.set(A.GOTO_WINDOW_CENTER, () => {
    // Approximate the center of the visible viewport. The viewport shows
    // a range of files starting around activeFileIndex. We estimate the
    // center as halfway between activeFileIndex and the last file card
    // that fits in the viewport. Since file cards have variable height
    // and we don't have exact visibility info here, we approximate with
    // a reasonable heuristic: take the midpoint between activeFileIndex
    // and a few files further down (based on viewport height).
    const { height } = state.diffViewportMetrics;
    // Rough estimate: average file card is ~20 rows high, so viewport
    // can show about height/20 files. Center is half that offset.
    const estimatedVisibleFiles = Math.max(Math.floor(height / 20), 1);
    const centerOffset = Math.floor(estimatedVisibleFiles / 2);
    const centerIndex = clampIndex(
      state.activeFileIndex + centerOffset,
      state.session.files.length,
    );
    const centerPath = state.session.files[centerIndex]?.path;
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: "none",
      target: { index: centerIndex },
    });
    state.setStatusMessage(
      centerPath != null ? `Jumped to center: ${centerPath}.` : "Jumped to center.",
    );
  });

  map.set(A.GOTO_WINDOW_BOTTOM, () => {
    // Jump to the last file visible in the viewport.
    const { height } = state.diffViewportMetrics;
    const estimatedVisibleFiles = Math.max(Math.floor(height / 20), 1);
    const bottomIndex = clampIndex(
      state.activeFileIndex + estimatedVisibleFiles - 1,
      state.session.files.length,
    );
    const bottomPath = state.session.files[bottomIndex]?.path;
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: "none",
      target: { index: bottomIndex },
    });
    state.setStatusMessage(
      bottomPath != null ? `Jumped to bottom: ${bottomPath}.` : "Jumped to bottom.",
    );
  });

  map.set(A.GOTO_NEXT_HUNK, (count) => {
    moveToHunk(1, count ?? 1);
  });

  map.set(A.GOTO_PREVIOUS_HUNK, (count) => {
    moveToHunk(-1, count ?? 1);
  });

  map.set(A.GOTO_LAST_ACCESSED_FILE, () => {
    // Toggle between the current file and the previously selected file.
    // The lastAccessedFileIndex is tracked by the review actions when
    // file selection changes.
    const lastIndex = state.lastAccessedFileIndex;
    if (lastIndex == null || lastIndex === state.selectedFileIndex) {
      state.setStatusMessage("No alternate file to jump to.");
      return;
    }
    const lastPath = state.session.files[lastIndex]?.path;
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: "default",
      target: { index: lastIndex },
    });
    state.setStatusMessage(
      lastPath != null ? `Jumped to alternate file: ${lastPath}.` : "Jumped to alternate file.",
    );
  });

  // -------------------------------------------------------------------------
  // Tree pane navigation
  // -------------------------------------------------------------------------

  map.set(A.TREE_MOVE_DOWN, (count) => {
    treeActions.moveTreeSelection(count ?? 1);
  });

  map.set(A.TREE_MOVE_UP, (count) => {
    treeActions.moveTreeSelection(-(count ?? 1));
  });

  map.set(A.TREE_FIRST, () => {
    treeActions.moveTreeSelection(-Infinity);
  });

  map.set(A.TREE_LAST, () => {
    treeActions.moveTreeSelection(Infinity);
  });

  map.set(A.TREE_EXPAND_OR_CHILD, () => {
    treeActions.expandOrEnterChild();
  });

  map.set(A.TREE_COLLAPSE_OR_PARENT, () => {
    treeActions.collapseOrGoToParent();
  });

  map.set(A.TREE_TOGGLE_OR_OPEN, () => {
    treeActions.toggleOrOpen();
  });

  // -------------------------------------------------------------------------
  // Hunk navigation helpers
  // -------------------------------------------------------------------------

  /**
   * Move to the next or previous hunk boundary relative to the current
   * selected file and review anchor position.
   *
   * Hunks are identified by `kind === "hunk"` entries in the file's
   * `unifiedLines` array. The function scans forward/backward through
   * the current file's lines, crossing file boundaries when needed.
   */
  function moveToHunk(direction: 1 | -1, count: number): void {
    const files = state.session.files;
    if (files.length === 0) {
      state.setStatusMessage("No files are available.");
      return;
    }

    let fileIndex = state.selectedFileIndex;
    let remaining = count;

    // Collect hunk line indices for the current file.
    function getHunkIndices(fIdx: number): number[] {
      const file = files[fIdx];
      if (file == null) return [];
      return file.unifiedLines.reduce<number[]>((acc, line, idx) => {
        if (line.kind === "hunk") acc.push(idx);
        return acc;
      }, []);
    }

    // Start scanning from the current anchor position within the current file.
    let hunkIndices = getHunkIndices(fileIndex);
    let anchorIndex = state.selectedReviewAnchorIndex;

    // Find which hunk we're currently at or past in the current file.
    // We use the anchor's position relative to hunks as a reference.
    while (remaining > 0) {
      if (hunkIndices.length === 0) {
        // No hunks in this file — move to the next/previous file.
        const nextFileIndex = fileIndex + direction;
        if (nextFileIndex < 0 || nextFileIndex >= files.length) {
          // Hit the boundary of the file list.
          break;
        }
        fileIndex = nextFileIndex;
        hunkIndices = getHunkIndices(fileIndex);
        anchorIndex = direction > 0 ? -1 : hunkIndices.length;
        continue;
      }

      if (direction > 0) {
        // Find the next hunk after current anchor.
        const nextHunk = hunkIndices.find((idx) => idx > anchorIndex);
        if (nextHunk != null) {
          anchorIndex = nextHunk;
          remaining -= 1;
        } else {
          // No more hunks forward in this file — cross to next file.
          const nextFileIndex = fileIndex + 1;
          if (nextFileIndex >= files.length) break;
          fileIndex = nextFileIndex;
          hunkIndices = getHunkIndices(fileIndex);
          anchorIndex = -1;
        }
      } else {
        // Find the previous hunk before current anchor.
        const prevHunks = hunkIndices.filter((idx) => idx < anchorIndex);
        const prevHunk = prevHunks.length > 0 ? prevHunks[prevHunks.length - 1] : undefined;
        if (prevHunk != null) {
          anchorIndex = prevHunk;
          remaining -= 1;
        } else {
          // No more hunks backward in this file — cross to previous file.
          const prevFileIndex = fileIndex - 1;
          if (prevFileIndex < 0) break;
          fileIndex = prevFileIndex;
          hunkIndices = getHunkIndices(fileIndex);
          anchorIndex = hunkIndices.length > 0 ? hunkIndices[hunkIndices.length - 1]! + 1 : 0;
        }
      }
    }

    // Focus the target file if it changed.
    if (fileIndex !== state.selectedFileIndex) {
      const targetPath = files[fileIndex]?.path;
      fileFocus.focusFile({
        activatePane: "preserve",
        reveal: "align-under-sticky-header",
        target: { index: fileIndex },
      });
      state.setStatusMessage(
        targetPath != null ? `Jumped to hunk in ${targetPath}.` : "Jumped to hunk.",
      );
    } else {
      // Same file — update anchor to the hunk position.
      state.setSelectedReviewAnchorIndex(
        clampIndex(anchorIndex, derived.selectedReviewAnchors.length),
      );
      const anchor = derived.selectedReviewAnchors[anchorIndex];
      state.setStatusMessage(
        anchor != null ? `Jumped to hunk at ${anchor.path}:${anchor.line}.` : "Jumped to hunk.",
      );
    }
  }

  return map;
}
