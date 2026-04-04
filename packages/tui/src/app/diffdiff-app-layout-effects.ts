import { useCallback, useEffect } from "react";
import { clampIndex, getTopIntersectingFileIndex } from "../view-model.ts";
import type { DiffdiffAppDerived } from "./diffdiff-app-derived.ts";
import type { DiffdiffAppState } from "./diffdiff-app-state.ts";
import {
  getAncestorDirectoryPaths,
  haveSamePaths,
  reconcileCollapsedDirectories,
  reconcileCollapsedPaths,
} from "./diffdiff-app-helpers.ts";
import { LOADING_INDICATOR_FRAMES } from "./diffdiff-app-shared.ts";

export function useDiffdiffAppLayoutEffects(state: DiffdiffAppState, derived: DiffdiffAppDerived) {
  useEffect(() => {
    state.fileCardRefs.current.length = state.session.files.length;
  }, [state.fileCardRefs, state.session.files.length]);

  useEffect(() => {
    state.treeRowRefs.current.length = derived.visibleTreeNodes.length;
  }, [derived.visibleTreeNodes.length, state.treeRowRefs]);

  useEffect(() => {
    if (state.baseBranchLoadingMessage == null) {
      state.setLoadingIndicatorFrame(0);
      return;
    }

    const intervalId = setInterval(() => {
      state.setLoadingIndicatorFrame(
        (currentFrame) => (currentFrame + 1) % LOADING_INDICATOR_FRAMES.length,
      );
    }, 80);

    return () => {
      clearInterval(intervalId);
    };
  }, [state.baseBranchLoadingMessage, state.setLoadingIndicatorFrame]);

  useEffect(() => {
    state.setCollapsedPaths((currentPaths) => {
      const nextPaths = reconcileCollapsedPaths(currentPaths, state.session.files);
      return haveSamePaths(currentPaths, nextPaths) ? currentPaths : nextPaths;
    });
  }, [state.session.files, state.setCollapsedPaths]);

  useEffect(() => {
    state.setCollapsedDirectories((currentPaths) => {
      const nextPaths = reconcileCollapsedDirectories(currentPaths, derived.fileTreeNodes);
      return haveSamePaths(currentPaths, nextPaths) ? currentPaths : nextPaths;
    });
  }, [derived.fileTreeNodes, state.setCollapsedDirectories]);

  useEffect(() => {
    if (derived.fileTreeNodes.length === 0) {
      state.setSelectedTreePath("");
      return;
    }

    const selectedFilePath = state.session.files[state.selectedFileIndex]?.path;
    state.setSelectedTreePath((currentPath) => {
      if (currentPath !== "" && derived.fileTreeNodePaths.has(currentPath)) {
        return currentPath;
      }

      if (selectedFilePath != null && derived.fileTreeNodePaths.has(selectedFilePath)) {
        return selectedFilePath;
      }

      return derived.fileTreeNodes[0]?.path ?? "";
    });
  }, [
    derived.fileTreeNodePaths,
    derived.fileTreeNodes,
    state.selectedFileIndex,
    state.session.files,
    state.setSelectedTreePath,
  ]);

  useEffect(() => {
    const selectedFilePath = state.session.files[state.selectedFileIndex]?.path;
    if (state.activePane !== "diff" || selectedFilePath == null) {
      return;
    }

    state.setCollapsedDirectories((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      let changed = false;
      for (const path of getAncestorDirectoryPaths(selectedFilePath)) {
        if (nextPaths.delete(path)) {
          changed = true;
        }
      }
      return changed ? nextPaths : currentPaths;
    });
    state.setSelectedTreePath(selectedFilePath);
  }, [
    state.activePane,
    state.selectedFileIndex,
    state.session.files,
    state.setCollapsedDirectories,
    state.setSelectedTreePath,
  ]);

  const getFileTopOffsets = useCallback((): number[] => {
    const scrollBox = state.scrollRef.current;
    if (scrollBox == null) {
      return [];
    }

    const contentTop = scrollBox.content.y;
    return state.session.files.map((_, index) => {
      const fileCard = state.fileCardRefs.current[index];
      return fileCard == null ? Number.POSITIVE_INFINITY : fileCard.y - contentTop;
    });
  }, [state.fileCardRefs, state.scrollRef, state.session.files]);

  const getTreeTopOffsets = useCallback((): number[] => {
    const scrollBox = state.treeScrollRef.current;
    if (scrollBox == null) {
      return [];
    }

    const contentTop = scrollBox.content.y;
    return derived.visibleTreeNodes.map((_, index) => {
      const row = state.treeRowRefs.current[index];
      return row == null ? Number.POSITIVE_INFINITY : row.y - contentTop;
    });
  }, [derived.visibleTreeNodes, state.treeRowRefs, state.treeScrollRef]);

  useEffect(() => {
    const scrollBox = state.scrollRef.current;
    const offset = getFileTopOffsets()[state.selectedFileIndex];
    if (scrollBox == null || offset == null || !Number.isFinite(offset)) {
      return;
    }

    const scrollOffset = state.pendingSelectedFileScrollOffsetRef.current;
    state.pendingSelectedFileScrollOffsetRef.current = 0;
    scrollBox.scrollTo({ x: 0, y: Math.max(offset + scrollOffset, 0) });
    state.setActiveFileIndex(state.selectedFileIndex);
  }, [
    getFileTopOffsets,
    state.pendingSelectedFileScrollOffsetRef,
    state.scrollRef,
    state.selectedFileIndex,
    state.setActiveFileIndex,
  ]);

  useEffect(() => {
    const selectedTreeIndex = derived.visibleTreeNodeIndexByPath.get(state.selectedTreePath) ?? -1;
    const offset = getTreeTopOffsets()[selectedTreeIndex];
    const scrollBox = state.treeScrollRef.current;
    if (scrollBox == null || offset == null || !Number.isFinite(offset)) {
      return;
    }

    scrollBox.scrollTo({ x: 0, y: Math.max(offset - 2, 0) });
  }, [
    derived.visibleTreeNodeIndexByPath,
    getTreeTopOffsets,
    state.selectedTreePath,
    state.treeScrollRef,
  ]);

  useEffect(() => {
    if (!derived.showMergeModal || state.mergeModalField !== "body") {
      return;
    }

    state.mergeBodyScrollRef.current?.scrollTo({ x: 0, y: Number.MAX_SAFE_INTEGER });
  }, [
    derived.showMergeModal,
    state.mergeBodyScrollRef,
    state.mergeCommitMessage,
    state.mergeModalField,
  ]);

  const syncActiveFileIndex = useCallback(() => {
    const scrollBox = state.scrollRef.current;
    if (scrollBox == null) {
      return;
    }

    const fileTopOffsets = getFileTopOffsets();
    const nextIndex = getTopIntersectingFileIndex(fileTopOffsets, scrollBox.scrollTop);
    const viewportHeight = scrollBox.viewport?.height ?? scrollBox.height ?? 0;

    state.setActiveFileIndex((currentIndex) =>
      currentIndex === nextIndex ? currentIndex : nextIndex,
    );
    state.setDiffViewportMetrics((currentMetrics) =>
      currentMetrics.scrollTop === scrollBox.scrollTop && currentMetrics.height === viewportHeight
        ? currentMetrics
        : { height: viewportHeight, scrollTop: scrollBox.scrollTop },
    );
  }, [getFileTopOffsets, state.scrollRef, state.setActiveFileIndex, state.setDiffViewportMetrics]);

  useEffect(() => {
    const scrollBox = state.scrollRef.current;
    if (scrollBox == null) {
      return;
    }

    syncActiveFileIndex();
    scrollBox.verticalScrollBar.on("change", syncActiveFileIndex);

    return () => {
      scrollBox.verticalScrollBar.off("change", syncActiveFileIndex);
    };
  }, [state.scrollRef, syncActiveFileIndex]);

  useEffect(() => {
    syncActiveFileIndex();
  }, [
    derived.diffView,
    state.collapsedPaths,
    state.session.files,
    syncActiveFileIndex,
    state.terminalDimensions.width,
  ]);

  useEffect(() => {
    state.setBranchListIndex((currentIndex) =>
      clampIndex(currentIndex, derived.branchItems.length),
    );
  }, [derived.branchItems.length, state.setBranchListIndex]);

  useEffect(() => {
    state.setCommitListIndex((currentIndex) =>
      clampIndex(currentIndex, derived.commitItems.length),
    );
  }, [derived.commitItems.length, state.setCommitListIndex]);

  useEffect(() => {
    state.setPullRequestListIndex((currentIndex) =>
      clampIndex(currentIndex, derived.filteredPullRequests.length),
    );
  }, [derived.filteredPullRequests.length, state.setPullRequestListIndex]);

  useEffect(() => {
    state.setSelectedReviewAnchorIndex((currentIndex) =>
      clampIndex(currentIndex, derived.selectedReviewAnchors.length),
    );
  }, [derived.selectedReviewAnchors.length, state.setSelectedReviewAnchorIndex]);

  useEffect(() => {
    if (derived.selectedFilePath == null || derived.selectedFileReviewThreads.length === 0) {
      return;
    }

    state.setSelectedReviewThreadIndexByFilePath((currentIndexes) => {
      const nextIndex = clampIndex(
        currentIndexes[derived.selectedFilePath!] ?? 0,
        derived.selectedFileReviewThreads.length,
      );
      return currentIndexes[derived.selectedFilePath!] === nextIndex
        ? currentIndexes
        : { ...currentIndexes, [derived.selectedFilePath!]: nextIndex };
    });
  }, [
    derived.selectedFilePath,
    derived.selectedFileReviewThreads.length,
    state.setSelectedReviewThreadIndexByFilePath,
  ]);

  useEffect(() => {
    if (derived.selectedReviewThread == null) {
      return;
    }

    state.setSelectedReviewCommentIndexByThreadId((currentIndexes) => {
      const nextIndex = clampIndex(
        currentIndexes[derived.selectedReviewThread!.id] ?? 0,
        derived.selectedReviewThread!.comments.length,
      );
      return currentIndexes[derived.selectedReviewThread!.id] === nextIndex
        ? currentIndexes
        : { ...currentIndexes, [derived.selectedReviewThread!.id]: nextIndex };
    });
  }, [derived.selectedReviewThread, state.setSelectedReviewCommentIndexByThreadId]);

  useEffect(() => {
    state.setPullRequestConversationIndex((currentIndex) =>
      clampIndex(currentIndex, derived.pullRequestConversationItems.length),
    );
  }, [derived.pullRequestConversationItems.length, state.setPullRequestConversationIndex]);

  useEffect(() => {
    state.setSelectedFileIndex((currentIndex) =>
      clampIndex(currentIndex, state.session.files.length),
    );
  }, [state.session.files.length, state.setSelectedFileIndex]);

  useEffect(() => {
    state.setActiveFileIndex((currentIndex) =>
      clampIndex(currentIndex, state.session.files.length),
    );
  }, [state.session.files.length, state.setActiveFileIndex]);

  return { getFileTopOffsets };
}
