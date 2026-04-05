import type { ReviewCacheState } from "@diffdiff/core";
import { useCallback } from "react";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { getMonotonicNow } from "../layout/preview-helpers.ts";
import {
  buildReviewedFiles,
  restoreCollapsedPaths,
  restoreReviewedPaths,
} from "../shared/collections.ts";
import type { PendingInteraction } from "../state/app-props.ts";
import type { PreparedReviewSession } from "../../types.ts";

interface ApplyLoadedSessionOptions {
  resetReviewState?: boolean;
  reviewCacheState?: ReviewCacheState;
}

interface UseSessionActionsOptions {
  getFileTopOffsets: () => number[];
  state: DiffdiffAppState;
  syncRemotes: (repositoryRootPath: string) => Promise<unknown>;
}

export function useSessionActions({
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

      if (
        scrollBox != null &&
        currentSelectedFilePath != null &&
        Number.isFinite(currentSelectedFileOffset) &&
        nextSession.files.some((file) => file.path === currentSelectedFilePath)
      ) {
        state.pendingSelectedFileScrollOffsetRef.current =
          scrollBox.scrollTop - currentSelectedFileOffset;
      }

      if (options.resetReviewState) {
        state.setReviewedPaths(restoreReviewedPaths(nextSession.files, options.reviewCacheState));
        state.setCollapsedPaths(restoreCollapsedPaths(nextSession.files, options.reviewCacheState));
        state.setCommentCollapseStates(options.reviewCacheState?.commentCollapseStates ?? {});
        state.setSelectedFileIndex(
          options.reviewCacheState?.selectedFilePath == null
            ? 0
            : Math.max(
                nextSession.files.findIndex(
                  (file) => file.path === options.reviewCacheState?.selectedFilePath,
                ),
                0,
              ),
        );
      } else {
        state.setReviewedPaths(
          restoreReviewedPaths(nextSession.files, {
            reviewedFiles: buildReviewedFiles(state.session.files, state.reviewedPaths),
          }),
        );
      }
      state.setComparisonBrowserData({
        branches: nextSession.branches,
        commits: nextSession.commits,
        workingTreeSummary: nextSession.workingTreeSummary,
      });
      state.setSession(nextSession);
    },
    [getFileTopOffsets, state],
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
