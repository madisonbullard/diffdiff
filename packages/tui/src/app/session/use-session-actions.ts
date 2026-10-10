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
import type { FileFocusController } from "../shared/file-focus.ts";
import type { PendingInteraction } from "../state/app-props.ts";
import type { PreparedReviewSession } from "../../types.ts";
import { PR_OVERVIEW_PATH } from "../review/pull-request-overview.ts";

interface ApplyLoadedSessionOptions {
  resetReviewState?: boolean;
  reviewCacheState?: ReviewCacheState;
}

interface UseSessionActionsOptions {
  fileFocus: FileFocusController;
  state: DiffdiffAppState;
  syncRemotes: (repositoryRootPath: string) => Promise<unknown>;
}

export function useSessionActions({ fileFocus, state, syncRemotes }: UseSessionActionsOptions) {
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
      const currentSelectedFilePath =
        state.selectedFileIndex === -1 && state.session.github != null
          ? PR_OVERVIEW_PATH
          : state.session.files[state.selectedFileIndex]?.path;
      const selectedItemSurvives =
        currentSelectedFilePath === PR_OVERVIEW_PATH
          ? nextSession.github != null
          : nextSession.files.some((file) => file.path === currentSelectedFilePath);
      const currentSelectedFileOffset = state.diffScroll.getFileTop(state.selectedFileIndex);
      const preservedRelativeOffset =
        scrollBox != null &&
        currentSelectedFilePath != null &&
        currentSelectedFileOffset != null &&
        Number.isFinite(currentSelectedFileOffset)
          ? scrollBox.scrollTop - currentSelectedFileOffset
          : undefined;
      let nextFocusTarget: { index: number } | { path: string } = {
        index: nextSession.github == null ? 0 : -1,
      };
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
            selectedItemSurvives
          ) {
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
          if (preservedRelativeOffset != null && selectedItemSurvives) {
            nextFocusRelativeOffset = preservedRelativeOffset;
          }
        }
      }

      state.diffScroll.setFiles(nextSession.files, nextSession.github != null);
      fileFocus.focusFile({
        hasOverview: nextSession.github != null,
        activatePane: "preserve",
        fallback: "first-file",
        files: nextSession.files,
        reveal: options.resetReviewState === true || !selectedItemSurvives,
        relativeOffset: nextFocusRelativeOffset,
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
    [fileFocus, state],
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
