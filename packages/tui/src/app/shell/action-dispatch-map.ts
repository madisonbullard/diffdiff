import { clampIndex } from "../../view-model.ts";
import * as A from "../keymap/actions.ts";
import type { ActionDispatchMap } from "../keymap/action-dispatch.ts";
import type { FileFocusController } from "../shared/file-focus.ts";
import type { DiffdiffAppPersistenceApi } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { createReviewActions } from "../review/review-actions.ts";
import type { createTreeActions } from "../tree/tree-actions.ts";
import type { DiffdiffAppDerived } from "./use-app-models.ts";
import {
  buildModalActionDispatchMap,
  type BuildModalActionDispatchMapOptions,
} from "./modal-action-dispatch.ts";

interface BuildActionDispatchMapOptions extends BuildModalActionDispatchMapOptions {
  copyPullRequestUrl: () => Promise<void>;
  fileFocus: FileFocusController;
  openBranchModal: () => void;
  openClearReviewedConfirmModal: () => void;
  openCommandModal: () => void;
  openCommentComposer: () => void;
  openDiagnostics: () => void;
  openFocusedFileInEditor: () => Promise<void>;
  openFocusedReviewThreadReplyComposer: () => void;
  openGitHubPullRequestList: () => void;
  openHelp: () => void;
  openMergeModal: () => void;
  openPullRequestCommentsModal: () => void;
  openSubmitReviewModal: () => void;
  persistenceApi: DiffdiffAppPersistenceApi;
  refreshComparison: () => Promise<void> | void;
  reviewActions: ReturnType<typeof createReviewActions>;
  treeActions: ReturnType<typeof createTreeActions>;
}

export function buildActionDispatchMap(options: BuildActionDispatchMapOptions): ActionDispatchMap {
  const {
    copyPullRequestUrl,
    fileFocus,
    openClearReviewedConfirmModal,
    openCommentComposer,
    openDiagnostics,
    openFocusedFileInEditor,
    openFocusedReviewThreadReplyComposer,
    openGitHubPullRequestList,
    openHelp,
    openMergeModal,
    openPullRequestCommentsModal,
    openSubmitReviewModal,
    persistenceApi,
    refreshComparison,
    reviewActions,
    state,
    treeActions,
    derived,
  } = options;

  const map = buildModalActionDispatchMap(options);

  map.set(A.SYSTEM_HELP, () => {
    openHelp();
  });

  map.set(A.SYSTEM_COMMAND_PALETTE, () => {
    options.openCommandModal();
  });

  map.set(A.SYSTEM_DIAGNOSTICS, () => {
    openDiagnostics();
  });

  map.set(A.SYSTEM_QUIT, () => {
    persistenceApi.exitApp();
  });

  map.set(A.COMPARISON_REFRESH, () => {
    void refreshComparison();
  });

  map.set(A.COMPARISON_LIST, () => {
    options.openBranchModal();
  });

  map.set(A.VIEW_PANE_TOGGLE, () => {
    treeActions.toggleActivePane();
  });

  map.set(A.VIEW_DIFF_TOGGLE, () => {
    reviewActions.toggleDiffView();
  });

  map.set(A.VIEW_OPEN_FILE_IN_EDITOR, () => {
    void openFocusedFileInEditor();
  });

  map.set(A.REVIEW_NEXT_FILE, (count) => {
    reviewActions.moveSelectedFile(count ?? 1);
  });

  map.set(A.REVIEW_PREVIOUS_FILE, (count) => {
    reviewActions.moveSelectedFile(-(count ?? 1));
  });

  map.set(A.REVIEW_FIRST_FILE, (count) => {
    const targetIndex = count == null ? 0 : clampIndex(count - 1, state.session.files.length);
    const targetPath = state.session.files[targetIndex]?.path;
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: "default",
      target: { index: targetIndex },
    });
    state.setStatusMessage(
      count != null && targetPath != null
        ? `Jumped to file ${count}: ${targetPath}.`
        : count != null
          ? `Jumped to file ${count}.`
          : "Jumped to the first file.",
    );
  });

  map.set(A.REVIEW_LAST_FILE, () => {
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: "default",
      target: { index: Math.max(state.session.files.length - 1, 0) },
    });
    state.setStatusMessage("Jumped to the last file.");
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

  map.set(A.REVIEW_CLEAR_REVIEWED, () => {
    openClearReviewedConfirmModal();
  });

  map.set(A.GITHUB_PULL_REQUEST_LIST, () => {
    openGitHubPullRequestList();
  });

  map.set(A.GITHUB_COMMENTS, () => {
    openPullRequestCommentsModal();
  });

  map.set(A.GITHUB_COPY_URL, () => {
    void copyPullRequestUrl();
  });

  map.set(A.GITHUB_FOCUS_PREVIOUS_THREAD, () => {
    reviewActions.moveSelectedReviewThread(-1);
  });

  map.set(A.GITHUB_FOCUS_NEXT_THREAD, () => {
    reviewActions.moveSelectedReviewThread(1);
  });

  map.set(A.GITHUB_FOCUS_PREVIOUS_COMMENT, () => {
    reviewActions.moveSelectedReviewComment(-1);
  });

  map.set(A.GITHUB_FOCUS_NEXT_COMMENT, () => {
    reviewActions.moveSelectedReviewComment(1);
  });

  map.set(A.GITHUB_ADD_COMMENT, () => {
    openCommentComposer();
  });

  map.set(A.GITHUB_REPLY_THREAD, () => {
    openFocusedReviewThreadReplyComposer();
  });

  map.set(A.GITHUB_TOGGLE_THREAD, () => {
    reviewActions.toggleFocusedReviewThreadCollapsed();
  });

  map.set(A.GITHUB_COPY_COMMENT_URL, () => {
    void reviewActions.copyFocusedReviewCommentUrl();
  });

  map.set(A.GITHUB_SUBMIT_REVIEW, () => {
    openSubmitReviewModal();
  });

  map.set(A.GITHUB_MERGE, () => {
    openMergeModal();
  });

  map.set(A.GOTO_FIRST_FILE, (count) => {
    map.get(A.REVIEW_FIRST_FILE)?.(count);
  });

  map.set(A.GOTO_LAST_FILE, () => {
    map.get(A.REVIEW_LAST_FILE)?.(null);
  });

  map.set(A.GOTO_WINDOW_TOP, () => {
    const topIndex = clampIndex(state.activeFileIndex, state.session.files.length);
    const topPath = state.session.files[topIndex]?.path;
    fileFocus.focusFile({ activatePane: "preserve", reveal: "none", target: { index: topIndex } });
    state.setStatusMessage(topPath != null ? `Jumped to top: ${topPath}.` : "Jumped to top.");
  });

  map.set(A.GOTO_WINDOW_CENTER, () => {
    const estimatedVisibleFiles = Math.max(Math.floor(state.diffViewportMetrics.height / 20), 1);
    const centerIndex = clampIndex(
      state.activeFileIndex + Math.floor(estimatedVisibleFiles / 2),
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
    const estimatedVisibleFiles = Math.max(Math.floor(state.diffViewportMetrics.height / 20), 1);
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
    moveToHunk(1, count ?? 1, derived, fileFocus, state);
  });

  map.set(A.GOTO_PREVIOUS_HUNK, (count) => {
    moveToHunk(-1, count ?? 1, derived, fileFocus, state);
  });

  map.set(A.GOTO_LAST_ACCESSED_FILE, () => {
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

  return map;
}

function moveToHunk(
  direction: 1 | -1,
  count: number,
  derived: DiffdiffAppDerived,
  fileFocus: FileFocusController,
  state: DiffdiffAppState,
): void {
  const files = state.session.files;
  if (files.length === 0) {
    state.setStatusMessage("No files are available.");
    return;
  }

  let fileIndex = state.selectedFileIndex;
  let remaining = count;

  function getHunkIndices(fIdx: number): number[] {
    const file = files[fIdx];
    if (file == null) {
      return [];
    }

    return file.unifiedLines.reduce<number[]>((acc, line, idx) => {
      if (line.kind === "hunk") {
        acc.push(idx);
      }
      return acc;
    }, []);
  }

  let hunkIndices = getHunkIndices(fileIndex);
  let anchorIndex = state.selectedReviewAnchorIndex;

  while (remaining > 0) {
    if (hunkIndices.length === 0) {
      const nextFileIndex = fileIndex + direction;
      if (nextFileIndex < 0 || nextFileIndex >= files.length) {
        break;
      }
      fileIndex = nextFileIndex;
      hunkIndices = getHunkIndices(fileIndex);
      anchorIndex = direction > 0 ? -1 : hunkIndices.length;
      continue;
    }

    if (direction > 0) {
      const nextHunk = hunkIndices.find((idx) => idx > anchorIndex);
      if (nextHunk != null) {
        anchorIndex = nextHunk;
        remaining -= 1;
      } else {
        const nextFileIndex = fileIndex + 1;
        if (nextFileIndex >= files.length) {
          break;
        }
        fileIndex = nextFileIndex;
        hunkIndices = getHunkIndices(fileIndex);
        anchorIndex = -1;
      }
    } else {
      const prevHunks = hunkIndices.filter((idx) => idx < anchorIndex);
      const prevHunk = prevHunks.length > 0 ? prevHunks[prevHunks.length - 1] : undefined;
      if (prevHunk != null) {
        anchorIndex = prevHunk;
        remaining -= 1;
      } else {
        const prevFileIndex = fileIndex - 1;
        if (prevFileIndex < 0) {
          break;
        }
        fileIndex = prevFileIndex;
        hunkIndices = getHunkIndices(fileIndex);
        anchorIndex = hunkIndices.length > 0 ? hunkIndices[hunkIndices.length - 1]! + 1 : 0;
      }
    }
  }

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
    return;
  }

  state.setSelectedReviewAnchorIndex(clampIndex(anchorIndex, derived.selectedReviewAnchors.length));
  const anchor = derived.selectedReviewAnchors[anchorIndex];
  state.setStatusMessage(
    anchor != null ? `Jumped to hunk at ${anchor.path}:${anchor.line}.` : "Jumped to hunk.",
  );
}
