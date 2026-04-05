import { copyTextToClipboard } from "../../clipboard.ts";
import {
  getCommentCollapsed,
  getReviewThreadCollapseKey,
  getReviewThreadDefaultCollapsed,
  toggleCommentCollapseState,
} from "../../review/collapse-state.ts";
import { formatThreadAnchor } from "../../review/threads.tsx";
import {
  getDiffViewLabel,
  MIN_SIDE_BY_SIDE_DIFF_WIDTH,
  clampIndex,
  resolveDiffView,
} from "../../view-model.ts";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { PendingInteraction } from "../state/app-props.ts";
import { REVIEWED_NEXT_FILE_SCROLL_OFFSET } from "../shared/constants.ts";
import { selectFileIndexWithPendingScrollOffset } from "../shared/file-selection.ts";
import { haveSamePaths } from "../shared/collections.ts";

interface CreateReviewActionsOptions {
  derived: DiffdiffAppDerived;
  startInteraction: (
    kind: string,
    options?: Omit<PendingInteraction, "kind" | "startedAt" | "token">,
  ) => void;
  state: DiffdiffAppState;
}

export function createReviewActions({
  derived,
  startInteraction,
  state,
}: CreateReviewActionsOptions) {
  function moveSelectedFile(delta: number): void {
    const nextIndex = clampIndex(state.selectedFileIndex + delta, state.session.files.length);
    if (nextIndex === state.selectedFileIndex) {
      return;
    }

    const nextFilePath = state.session.files[nextIndex]?.path;
    if (nextFilePath != null) {
      startInteraction("file_selection", {
        details: {
          delta,
          fromFilePath: derived.selectedFilePath,
          toFilePath: nextFilePath,
          trigger: "diff-navigation",
        },
        expectedSelectedFilePath: nextFilePath,
      });
    }

    state.setSelectedFileIndex(nextIndex);
    state.setStatusMessage(`Selected ${nextFilePath ?? "file"}.`);
  }

  function jumpToNextUnreviewedFile(): void {
    if (state.session.files.length === 0) {
      state.setStatusMessage("No files are available to review.");
      return;
    }

    for (let offset = 1; offset <= state.session.files.length; offset += 1) {
      const candidateIndex = (state.selectedFileIndex + offset) % state.session.files.length;
      const candidate = state.session.files[candidateIndex];
      if (candidate == null || state.reviewedPaths.has(candidate.path)) {
        continue;
      }

      startInteraction("file_selection", {
        details: {
          fromFilePath: derived.selectedFilePath,
          toFilePath: candidate.path,
          trigger: "next-unreviewed-file",
        },
        expectedSelectedFilePath: candidate.path,
      });
      selectFileIndexWithPendingScrollOffset(
        state.setSelectedFileIndex,
        state.pendingSelectedFileScrollOffsetRef,
        candidateIndex,
        REVIEWED_NEXT_FILE_SCROLL_OFFSET,
      );
      state.setActivePane("diff");
      state.setStatusMessage(`Jumped to next unreviewed file: ${candidate.path}.`);
      return;
    }

    state.setStatusMessage("All files are already reviewed.");
  }

  function moveSelectedReviewThread(delta: number): void {
    if (derived.selectedFilePath == null || derived.selectedFileReviewThreads.length === 0) {
      state.setStatusMessage("No review threads are available in the selected file.");
      return;
    }

    state.setSelectedReviewThreadIndexByFilePath((currentIndexes) => {
      const nextIndex = clampIndex(
        (currentIndexes[derived.selectedFilePath!] ?? 0) + delta,
        derived.selectedFileReviewThreads.length,
      );
      const nextThread = derived.selectedFileReviewThreads[nextIndex];
      if (nextThread != null) {
        state.setStatusMessage(`Focused thread ${formatThreadAnchor(nextThread)}.`);
      }

      return {
        ...currentIndexes,
        [derived.selectedFilePath!]: nextIndex,
      };
    });
  }

  function moveSelectedReviewComment(delta: number): void {
    if (derived.selectedReviewThread == null) {
      state.setStatusMessage("No focused review thread is available in the selected file.");
      return;
    }

    state.setSelectedReviewCommentIndexByThreadId((currentIndexes) => {
      const nextIndex = clampIndex(
        (currentIndexes[derived.selectedReviewThread!.id] ?? 0) + delta,
        derived.selectedReviewThread!.comments.length,
      );
      const nextComment = derived.selectedReviewThread!.comments[nextIndex];
      if (nextComment != null) {
        state.setStatusMessage(`Focused comment from ${nextComment.author.login}.`);
      }

      return {
        ...currentIndexes,
        [derived.selectedReviewThread!.id]: nextIndex,
      };
    });
  }

  function moveSelectedReviewAnchor(delta: number): void {
    if (derived.selectedReviewAnchors.length === 0) {
      state.setStatusMessage("No commentable lines are available in the selected file.");
      return;
    }

    state.setSelectedReviewAnchorIndex((currentIndex) => {
      const nextIndex = clampIndex(currentIndex + delta, derived.selectedReviewAnchors.length);
      const nextAnchor = derived.selectedReviewAnchors[nextIndex];
      if (nextAnchor != null) {
        state.setStatusMessage(`Focused ${nextAnchor.path}:${nextAnchor.line}.`);
      }
      return nextIndex;
    });
  }

  async function copyFocusedReviewCommentUrl(): Promise<void> {
    if (derived.selectedReviewComment == null) {
      state.setStatusMessage("No focused review comment is available.");
      return;
    }

    const copied = await copyTextToClipboard(derived.selectedReviewComment.url);
    state.setStatusMessage(
      copied
        ? "Copied focused comment URL to clipboard."
        : "Unable to copy the focused comment URL.",
    );
  }

  async function copySelectedPullRequestConversationItemUrl(): Promise<void> {
    if (derived.selectedPullRequestConversationItem == null) {
      state.setStatusMessage("No focused PR conversation item is available.");
      return;
    }

    const copied = await copyTextToClipboard(derived.selectedPullRequestConversationItem.url);
    state.setStatusMessage(
      copied
        ? "Copied PR conversation URL to clipboard."
        : "Unable to copy the PR conversation URL.",
    );
  }

  function toggleFocusedReviewThreadCollapsed(): void {
    if (derived.selectedReviewThread == null) {
      state.setStatusMessage("No focused review thread is available in the selected file.");
      return;
    }

    toggleReviewThreadCollapsed(derived.selectedReviewThread);
  }

  function toggleReviewed(fileIndex: number): void {
    const file = state.session.files[fileIndex];
    if (file == null) {
      return;
    }

    if (state.reviewedPaths.has(file.path)) {
      state.setReviewedPaths((currentPaths) => {
        const nextPaths = new Set(currentPaths);
        nextPaths.delete(file.path);
        return nextPaths;
      });
      state.setStatusMessage(`Marked ${file.path} as not reviewed.`);
      return;
    }

    state.setReviewedPaths((currentPaths) => new Set(currentPaths).add(file.path));
    state.setCollapsedPaths((currentPaths) => new Set(currentPaths).add(file.path));

    const files = state.session.files;
    let nextIndex: number | null = null;
    for (let index = 1; index < files.length; index += 1) {
      const candidateIndex = (fileIndex + index) % files.length;
      const candidatePath = files[candidateIndex]?.path;
      if (candidatePath != null && !state.reviewedPaths.has(candidatePath)) {
        nextIndex = candidateIndex;
        break;
      }
    }

    if (nextIndex != null) {
      const nextFilePath = files[nextIndex]?.path;
      if (nextFilePath != null) {
        startInteraction("file_selection", {
          details: {
            fromFilePath: file.path,
            toFilePath: nextFilePath,
            trigger: "reviewed-next-file",
          },
          expectedSelectedFilePath: nextFilePath,
        });
      }

      selectFileIndexWithPendingScrollOffset(
        state.setSelectedFileIndex,
        state.pendingSelectedFileScrollOffsetRef,
        nextIndex,
        REVIEWED_NEXT_FILE_SCROLL_OFFSET,
      );
      state.setStatusMessage(
        `Reviewed ${file.path}. Jumped to ${files[nextIndex]?.path ?? "next file"}.`,
      );
      return;
    }

    state.setStatusMessage(`Reviewed ${file.path}. All files reviewed!`);
  }

  function markAllReviewed(): void {
    if (state.session.files.length === 0) {
      state.setStatusMessage("No files are available to review.");
      return;
    }

    const allPaths = new Set(state.session.files.map((file) => file.path));
    if (haveSamePaths(state.reviewedPaths, allPaths)) {
      state.setStatusMessage("All files are already reviewed.");
      return;
    }

    state.setReviewedPaths(allPaths);
    state.setCollapsedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      for (const path of allPaths) {
        nextPaths.add(path);
      }
      return nextPaths;
    });
    state.setStatusMessage(`Reviewed all ${state.session.files.length} files.`);
  }

  function clearReviewed(): void {
    if (state.reviewedPaths.size === 0) {
      state.setStatusMessage("No files are marked reviewed.");
      return;
    }

    state.setReviewedPaths(new Set());
    state.setStatusMessage(`Cleared review marks from ${state.reviewedPaths.size} files.`);
  }

  function toggleCollapsed(fileIndex: number): void {
    const file = state.session.files[fileIndex];
    if (file == null) {
      return;
    }

    startInteraction("file_collapse_toggle", {
      details: { filePath: file.path, isCollapsed: !state.collapsedPaths.has(file.path) },
      expectedSelectedFilePath: file.path,
    });

    state.setCollapsedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      if (nextPaths.has(file.path)) {
        nextPaths.delete(file.path);
        state.setStatusMessage(`Expanded ${file.path}.`);
      } else {
        nextPaths.add(file.path);
        state.setStatusMessage(`Collapsed ${file.path}.`);
      }
      return nextPaths;
    });
  }

  function toggleReviewThreadCollapsed(
    thread: import("@diffdiff/core").GitHubPullRequestReviewThread,
  ): void {
    const collapseKey = getReviewThreadCollapseKey(thread);
    const defaultCollapsed = getReviewThreadDefaultCollapsed(thread);
    const nextCollapsed = !getCommentCollapsed(
      state.commentCollapseStates,
      collapseKey,
      defaultCollapsed,
    );

    state.setCommentCollapseStates((currentStates) =>
      toggleCommentCollapseState(currentStates, collapseKey, defaultCollapsed),
    );
    state.setStatusMessage(
      nextCollapsed ? "Collapsed comment thread." : "Expanded comment thread.",
    );
  }

  function toggleDiffView(): void {
    const nextPreference = state.diffViewPreference === "unified" ? "side-by-side" : "unified";
    const nextView = resolveDiffView(nextPreference, derived.diffPaneWidth);

    startInteraction("diff_view_toggle", {
      details: { fromView: derived.diffView, preferredView: nextPreference, toView: nextView },
      expectedDiffView: nextView,
    });

    state.setDiffViewPreference(nextPreference);

    if (nextPreference === "side-by-side" && nextView !== "split") {
      state.setStatusMessage(
        `Need at least ${MIN_SIDE_BY_SIDE_DIFF_WIDTH} columns in the diff pane for side-by-side diffs; showing unified.`,
      );
    } else {
      state.setStatusMessage(`Showing ${getDiffViewLabel(nextView)} diffs.`);
    }
  }

  return {
    clearReviewed,
    copyFocusedReviewCommentUrl,
    copySelectedPullRequestConversationItemUrl,
    jumpToNextUnreviewedFile,
    markAllReviewed,
    moveSelectedFile,
    moveSelectedReviewAnchor,
    moveSelectedReviewComment,
    moveSelectedReviewThread,
    toggleCollapsed,
    toggleDiffView,
    toggleFocusedReviewThreadCollapsed,
    toggleReviewed,
    toggleReviewThreadCollapsed,
  };
}
