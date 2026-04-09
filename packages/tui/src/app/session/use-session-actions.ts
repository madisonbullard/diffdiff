import { getReviewedPathsFromGitHubViewedState } from "@madisonbullard/diffdiff-core";
import type { ReviewCacheState } from "@madisonbullard/diffdiff-core";
import { useCallback } from "react";
import {
  applyOptimisticViewedStateToChangedFiles,
  rebaseOptimisticGitHubOperations,
} from "../review/optimistic-github-overlay.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { getMonotonicNow } from "../layout/preview-helpers.ts";
import {
  buildReviewedFiles,
  getSessionReviewedPaths,
  reconcileCollapsedPaths,
  restoreCollapsedPaths,
} from "../shared/collections.ts";
import type { FileFocusController, FileFocusRevealMode } from "../shared/file-focus.ts";
import type { PendingInteraction } from "../state/app-props.ts";
import type { PreparedReviewSession } from "../../types.ts";

interface ApplyLoadedSessionOptions {
  resetReviewState?: boolean;
  reviewCacheState?: ReviewCacheState;
}

interface UseSessionActionsOptions {
  fileFocus: FileFocusController;
  getFileTopOffsets: () => number[];
  state: DiffdiffAppState;
  syncRemotes: (repositoryRootPath: string) => Promise<unknown>;
}

export function useSessionActions({
  fileFocus,
  getFileTopOffsets,
  state,
  syncRemotes,
}: UseSessionActionsOptions) {
  const startInteraction = useCallback(
    (kind: string, options: Omit<PendingInteraction, "kind" | "startedAt" | "token"> = {}) => {
      state.pendingInteractionTokenRef.current += 1;
      state.pendingInteractionRef.current = {
        details: options.details,
        expectedDiffView: options.expectedDiffView,
        expectedPane: options.expectedPane,
        expectedSelectedFilePath: options.expectedSelectedFilePath,
        expectedSelectedTreePath: options.expectedSelectedTreePath,
        kind,
        startedAt: getMonotonicNow(),
        token: state.pendingInteractionTokenRef.current,
      };
    },
    [state.pendingInteractionRef, state.pendingInteractionTokenRef],
  );

  const beginSessionLoad = useCallback(() => {
    const nextLoadId = state.latestSessionLoadIdRef.current + 1;
    state.latestSessionLoadIdRef.current = nextLoadId;
    return nextLoadId;
  }, [state.latestSessionLoadIdRef]);

  const isLatestSessionLoad = useCallback(
    (loadId: number) => loadId === state.latestSessionLoadIdRef.current,
    [state.latestSessionLoadIdRef],
  );

  const applyLoadedSession = useCallback(
    (nextSession: PreparedReviewSession, options: ApplyLoadedSessionOptions = {}) => {
      const scrollBox = state.scrollRef.current;
      const currentSelectedFilePath = state.session.files[state.selectedFileIndex]?.path;
      const currentSelectedFileOffset = getFileTopOffsets()[state.selectedFileIndex];
      const preservedRelativeOffset =
        scrollBox != null &&
        currentSelectedFilePath != null &&
        Number.isFinite(currentSelectedFileOffset)
          ? scrollBox.scrollTop - currentSelectedFileOffset
          : undefined;
      let nextFocusTarget: { index: number } | { path: string } = { index: 0 };
      let nextFocusReveal: FileFocusRevealMode = "default";
      let nextFocusRelativeOffset: number | undefined;
      const nextOptimisticGitHubOperations = options.resetReviewState
        ? []
        : rebaseOptimisticGitHubOperations(
            nextSession.github?.pullRequest,
            state.optimisticGitHubOperationsRef.current,
          );

      state.setOptimisticGitHubOperations(nextOptimisticGitHubOperations);

      if (options.resetReviewState) {
        state.setReviewedPaths(getSessionReviewedPaths(nextSession, options.reviewCacheState));
        state.setCollapsedPaths(restoreCollapsedPaths(nextSession.files, options.reviewCacheState));
        state.setCommentCollapseStates(options.reviewCacheState?.commentCollapseStates ?? {});
        if (options.reviewCacheState?.selectedFilePath != null) {
          nextFocusTarget = { path: options.reviewCacheState.selectedFilePath };
          if (
            options.reviewCacheState.selectedFilePath === currentSelectedFilePath &&
            preservedRelativeOffset != null &&
            nextSession.files.some(
              (file) => file.path === options.reviewCacheState?.selectedFilePath,
            )
          ) {
            nextFocusReveal = "preserve-relative-offset";
            nextFocusRelativeOffset = preservedRelativeOffset;
          }
        }
      } else {
        const nextReviewedPaths =
          nextSession.github != null
            ? getReviewedPathsFromGitHubViewedState(
                nextSession.files,
                applyOptimisticViewedStateToChangedFiles(
                  nextSession.github.pullRequest.changedFiles,
                  nextOptimisticGitHubOperations,
                ),
              )
            : getSessionReviewedPaths(nextSession, {
                reviewedFiles: buildReviewedFiles(state.session.files, state.reviewedPaths),
              });

        state.setReviewedPaths(nextReviewedPaths);
        state.setCollapsedPaths((currentPaths) => {
          const nextPaths = reconcileCollapsedPaths(currentPaths, nextSession.files);

          for (const path of state.reviewedPaths) {
            if (!nextReviewedPaths.has(path)) {
              nextPaths.delete(path);
            }
          }

          return nextPaths;
        });

        if (currentSelectedFilePath != null) {
          nextFocusTarget = { path: currentSelectedFilePath };
          if (
            preservedRelativeOffset != null &&
            nextSession.files.some((file) => file.path === currentSelectedFilePath)
          ) {
            nextFocusReveal = "preserve-relative-offset";
            nextFocusRelativeOffset = preservedRelativeOffset;
          }
        }
      }

      fileFocus.focusFile({
        activatePane: "preserve",
        fallback: "first-file",
        files: nextSession.files,
        relativeOffset: nextFocusRelativeOffset,
        reveal: nextFocusReveal,
        target: nextFocusTarget,
      });
      state.setComparisonBrowserData({
        branches: nextSession.branches,
        commits: nextSession.commits,
        workingTreeSummary: nextSession.workingTreeSummary,
      });
      state.setRefreshIndicatorLabel(null);
      state.setRefreshIndicatorStatusMessage(null);
      state.setSession(nextSession);
    },
    [fileFocus, getFileTopOffsets, state],
  );

  const applyComparisonBrowserData = useCallback(
    (nextData: Pick<PreparedReviewSession, "branches" | "commits" | "workingTreeSummary">) => {
      state.setComparisonBrowserData((currentData) => {
        if (
          currentData.branches === nextData.branches &&
          currentData.commits === nextData.commits &&
          currentData.workingTreeSummary === nextData.workingTreeSummary
        ) {
          return currentData;
        }

        return {
          branches: nextData.branches,
          commits: nextData.commits,
          workingTreeSummary: nextData.workingTreeSummary,
        };
      });
    },
    [state],
  );

  const syncRemoteState = useCallback(async () => {
    await syncRemotes(state.session.repository.rootPath);
  }, [state.session.repository.rootPath, syncRemotes]);

  return {
    applyComparisonBrowserData,
    applyLoadedSession,
    beginSessionLoad,
    isLatestSessionLoad,
    startInteraction,
    syncRemoteState,
  };
}
