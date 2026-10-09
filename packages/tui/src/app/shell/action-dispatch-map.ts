import { clampIndex } from "../../view-model.ts";
import {
  getHunkReviewAnchors,
  getReviewAnchors,
  type SelectedReviewAnchor,
} from "../../review-anchors.ts";
import * as A from "../keymap/actions.ts";
import type { ActionDispatchMap } from "../keymap/action-dispatch.ts";
import type { FileFocusController } from "../shared/file-focus.ts";
import type { DiffdiffAppPersistenceApi } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { AppTextInputControllers } from "../text-input/input-controllers.ts";
import type { createReviewActions } from "../review/review-actions.ts";
import type { createTreeActions } from "../tree/tree-actions.ts";
import type { DiffdiffAppDerived } from "./use-app-models.ts";
import {
  buildModalActionDispatchMap,
  type BuildModalActionDispatchMapOptions,
} from "./modal-action-dispatch.ts";

interface BuildActionDispatchMapOptions extends BuildModalActionDispatchMapOptions {
  copyCurrentSessionReopenCommand: () => Promise<void>;
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
  openReviewerPicker: () => void;
  openHelp: () => void;
  openMergeModal: () => void;
  openPullRequestCommentsModal: () => void;
  openSubmitReviewModal: () => void;
  persistenceApi: DiffdiffAppPersistenceApi;
  refreshComparison: () => Promise<void> | void;
  textInputControllers: AppTextInputControllers;
  reviewActions: ReturnType<typeof createReviewActions>;
  treeActions: ReturnType<typeof createTreeActions>;
}

export function buildActionDispatchMap(options: BuildActionDispatchMapOptions): ActionDispatchMap {
  const {
    copyCurrentSessionReopenCommand,
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

  for (const [action, fraction] of [
    [A.SCROLL_PAGE_DOWN, 1],
    [A.SCROLL_PAGE_UP, -1],
    [A.SCROLL_HALF_PAGE_DOWN, 0.5],
    [A.SCROLL_HALF_PAGE_UP, -0.5],
  ] as const) {
    map.set(action, (count) => {
      if (options.activeKeymapMode === "checks") {
        state.checksDetailScrollRef.current?.scrollBy(fraction * (count ?? 1), "viewport");
      } else {
        state.diffScroll.scrollBy(fraction * (count ?? 1), true);
      }
    });
  }

  map.set(A.VIEW_DIFF_TOGGLE, () => {
    reviewActions.toggleDiffView();
  });

  map.set(A.VIEW_COPY_REOPEN_COMMAND, () => {
    void copyCurrentSessionReopenCommand();
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
  map.set(A.GITHUB_REQUEST_REVIEWERS, () => options.openReviewerPicker());

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
    const topIndex = state.diffScroll.fileAtViewport(0);
    const topPath = state.session.files[topIndex]?.path;
    fileFocus.focusFile({ activatePane: "preserve", reveal: false, target: { index: topIndex } });
    state.setStatusMessage(topPath != null ? `Jumped to top: ${topPath}.` : "Jumped to top.");
  });

  map.set(A.GOTO_WINDOW_CENTER, () => {
    const centerIndex = state.diffScroll.fileAtViewport(0.5);
    const centerPath = state.session.files[centerIndex]?.path;
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: false,
      target: { index: centerIndex },
    });
    state.setStatusMessage(
      centerPath != null ? `Jumped to center: ${centerPath}.` : "Jumped to center.",
    );
  });

  map.set(A.GOTO_WINDOW_BOTTOM, () => {
    const bottomIndex = state.diffScroll.fileAtViewport(1);
    const bottomPath = state.session.files[bottomIndex]?.path;
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: false,
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
      target: { index: lastIndex },
    });
    state.setStatusMessage(
      lastPath != null ? `Jumped to alternate file: ${lastPath}.` : "Jumped to alternate file.",
    );
  });

  map.set(A.GOTO_SELECTED_FILE_LINE, (count) => {
    jumpToSelectedFileLine(count, derived, state);
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
  let anchorIndex = state.selectedReviewAnchorIndex;
  let target: { fileIndex: number; anchorIndex: number; anchor: SelectedReviewAnchor } | undefined;
  for (let remaining = count; remaining > 0 && fileIndex >= 0 && fileIndex < files.length; ) {
    const file = files[fileIndex]!;
    const anchors = getReviewAnchors(file, derived.diffView);
    const indexes = new Map(anchors.map((anchor, index) => [anchor.key, index]));
    const hunks = getHunkReviewAnchors(file, derived.diffView).map((anchor) => ({
      fileIndex,
      anchor,
      anchorIndex: indexes.get(anchor.key)!,
    }));
    const next =
      direction > 0
        ? hunks.find((hunk) => hunk.anchorIndex > anchorIndex)
        : hunks.findLast((hunk) => hunk.anchorIndex < anchorIndex);
    if (next != null) {
      target = next;
      anchorIndex = next.anchorIndex;
      remaining -= 1;
    } else {
      fileIndex += direction;
      anchorIndex = direction > 0 ? -1 : Infinity;
    }
  }
  if (target == null) {
    state.setStatusMessage("No further hunks in this direction.");
    return;
  }
  if (target.fileIndex !== state.selectedFileIndex) {
    fileFocus.focusFile({
      activatePane: "preserve",
      reveal: false,
      target: { index: target.fileIndex },
    });
  }
  state.setCollapsedPaths((paths) => {
    if (!paths.has(target.anchor.path)) return paths;
    const next = new Set(paths);
    next.delete(target.anchor.path);
    return next;
  });
  state.setSelectedReviewAnchorIndex(target.anchorIndex);
  state.setShowSelectedReviewAnchor(true);
  state.setStatusMessage(`Jumped to hunk at ${target.anchor.path}:${target.anchor.line}.`);
}

function jumpToSelectedFileLine(
  count: number | null,
  derived: DiffdiffAppDerived,
  state: DiffdiffAppState,
): void {
  const selectedFile = state.session.files[state.selectedFileIndex];
  if (selectedFile == null) {
    state.setStatusMessage("No file is selected.");
    return;
  }

  const targetIndex =
    count == null ? 0 : derived.selectedReviewAnchors.findIndex((anchor) => anchor.line === count);
  const targetAnchor = targetIndex < 0 ? undefined : derived.selectedReviewAnchors[targetIndex];

  if (targetAnchor == null) {
    state.setStatusMessage(
      count == null
        ? `No diff lines are available in ${selectedFile.path}.`
        : `Line ${count} is not present in ${selectedFile.path}.`,
    );
    return;
  }

  if (state.collapsedPaths.has(selectedFile.path)) {
    state.setCollapsedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      nextPaths.delete(selectedFile.path);
      return nextPaths;
    });
  }

  state.setShowSelectedReviewAnchor(true);
  state.setSelectedReviewAnchorIndex(targetIndex);
  // State may be unchanged when this repeats a jump after manual scrolling.
  if (
    state.showSelectedReviewAnchor &&
    derived.selectedReviewAnchor?.key === targetAnchor.key &&
    state.selectedDiffRowRef.current != null
  ) {
    state.diffScroll.revealLine(state.selectedDiffRowRef.current);
  }
  state.setStatusMessage(
    count == null
      ? `Jumped to first diff line: ${targetAnchor.path}:${targetAnchor.line}.`
      : `Jumped to ${targetAnchor.path}:${targetAnchor.line}.`,
  );
}
