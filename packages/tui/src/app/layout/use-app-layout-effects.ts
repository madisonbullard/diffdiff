import { useEffect, useLayoutEffect } from "react";
import { clampIndex } from "../../view-model.ts";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import {
  getAncestorDirectoryPaths,
  haveSamePaths,
  reconcileCollapsedDirectories,
  reconcileCollapsedPaths,
} from "../shared/collections.ts";
import { LOADING_INDICATOR_FRAMES } from "../shared/constants.ts";

export function useDiffdiffAppLayoutEffects(state: DiffdiffAppState, derived: DiffdiffAppDerived) {
  useLayoutEffect(() => {
    const scroll = state.scrollRef.current;
    if (scroll == null) return;
    return state.diffScroll.connect(scroll, state.renderer.root, state.setActiveFileIndex);
  }, [state.diffScroll, state.renderer, state.scrollRef, state.setActiveFileIndex]);

  useLayoutEffect(() => {
    if (state.showSelectedReviewAnchor && state.selectedDiffRowRef.current != null) {
      state.diffScroll.revealLine(state.selectedDiffRowRef.current);
    }
  }, [
    derived.selectedReviewAnchor?.key,
    state.collapsedPaths.has(derived.selectedFilePath ?? ""),
    state.showSelectedReviewAnchor,
    state.diffScroll,
    state.selectedDiffRowRef,
  ]);

  useLayoutEffect(() => {
    const index = derived.visibleTreeNodeIndexByPath.get(state.selectedTreePath);
    if (index != null) state.treeScrollRef.current?.scrollTo(Math.max(index - 2, 0));
  }, [derived.visibleTreeNodeIndexByPath, state.selectedTreePath, state.treeScrollRef]);

  useEffect(() => {
    if (state.baseBranchLoadingMessage == null) {
      state.setLoadingIndicatorFrame(0);
      return;
    }
    const id = setInterval(
      () =>
        state.setLoadingIndicatorFrame((frame) => (frame + 1) % LOADING_INDICATOR_FRAMES.length),
      80,
    );
    return () => clearInterval(id);
  }, [state.baseBranchLoadingMessage, state.setLoadingIndicatorFrame]);

  useEffect(() => {
    state.setCollapsedPaths((paths) => {
      const next = reconcileCollapsedPaths(paths, state.session.files);
      return haveSamePaths(paths, next) ? paths : next;
    });
  }, [state.session.files, state.setCollapsedPaths]);

  useEffect(() => {
    state.setCollapsedDirectories((paths) => {
      const next = reconcileCollapsedDirectories(paths, derived.fileTreeNodes);
      return haveSamePaths(paths, next) ? paths : next;
    });
  }, [derived.fileTreeNodes, state.setCollapsedDirectories]);

  useEffect(() => {
    const selectedFilePath = state.session.files[state.selectedFileIndex]?.path;
    state.setSelectedTreePath((path) => {
      if (path !== "" && derived.fileTreeNodePaths.has(path)) return path;
      return selectedFilePath ?? derived.fileTreeNodes[0]?.path ?? "";
    });
    if (state.activePane !== "diff" || selectedFilePath == null) return;
    state.setCollapsedDirectories((paths) => {
      const next = new Set(paths);
      for (const path of getAncestorDirectoryPaths(selectedFilePath)) next.delete(path);
      return haveSamePaths(paths, next) ? paths : next;
    });
    state.setSelectedTreePath(selectedFilePath);
  }, [
    derived.fileTreeNodePaths,
    derived.fileTreeNodes,
    state.activePane,
    state.selectedFileIndex,
    state.session.files,
    state.setCollapsedDirectories,
    state.setSelectedTreePath,
  ]);

  useEffect(() => {
    if (derived.showMergeModal && state.mergeModalField === "body") {
      state.mergeBodyScrollRef.current?.scrollTo({ x: 0, y: Number.MAX_SAFE_INTEGER });
    }
  }, [
    derived.showMergeModal,
    state.mergeBodyScrollRef,
    state.mergeCommitMessageInput.value,
    state.mergeModalField,
  ]);

  useEffect(() => {
    state.setBranchListIndex((index) => clampIndex(index, derived.branchItems.length));
  }, [derived.branchItems.length, state.setBranchListIndex]);
  useEffect(() => {
    state.setCommitListIndex((index) => clampIndex(index, derived.commitItems.length));
  }, [derived.commitItems.length, state.setCommitListIndex]);
  useEffect(() => {
    state.setPullRequestListIndex((index) =>
      clampIndex(index, derived.filteredPullRequests.length),
    );
  }, [derived.filteredPullRequests.length, state.setPullRequestListIndex]);
  useEffect(() => {
    state.setSelectedReviewAnchorIndex((index) =>
      clampIndex(index, derived.selectedReviewAnchors.length),
    );
  }, [derived.selectedReviewAnchors.length, state.setSelectedReviewAnchorIndex]);
  useEffect(() => {
    state.setSelectedFileIndex((index) => clampIndex(index, state.session.files.length));
    state.setActiveFileIndex((index) => clampIndex(index, state.session.files.length));
  }, [state.session.files.length, state.setSelectedFileIndex, state.setActiveFileIndex]);

  useEffect(() => {
    if (derived.selectedFilePath == null || derived.selectedFileReviewThreads.length === 0) return;
    state.setSelectedReviewThreadIndexByFilePath((indexes) => {
      const index = indexes[derived.selectedFilePath!];
      if (index == null) return indexes;
      const next = clampIndex(index, derived.selectedFileReviewThreads.length);
      return next === index ? indexes : { ...indexes, [derived.selectedFilePath!]: next };
    });
  }, [
    derived.selectedFilePath,
    derived.selectedFileReviewThreads.length,
    state.setSelectedReviewThreadIndexByFilePath,
  ]);
  useEffect(() => {
    if (derived.selectedReviewThread == null) return;
    state.setSelectedReviewCommentIndexByThreadId((indexes) => {
      const thread = derived.selectedReviewThread!;
      const next = clampIndex(indexes[thread.id] ?? 0, thread.comments.length);
      return indexes[thread.id] === next ? indexes : { ...indexes, [thread.id]: next };
    });
  }, [derived.selectedReviewThread, state.setSelectedReviewCommentIndexByThreadId]);
  useEffect(() => {
    state.setPullRequestConversationIndex((index) =>
      clampIndex(index, derived.pullRequestConversationItems.length),
    );
  }, [derived.pullRequestConversationItems.length, state.setPullRequestConversationIndex]);
}
