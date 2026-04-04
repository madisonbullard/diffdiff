import { useCallback } from "react";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { getMonotonicNow } from "../layout/preview-helpers.ts";
import { buildReviewedFiles, restoreReviewedPaths } from "../shared/collections.ts";
import type { PendingInteraction } from "../state/app-props.ts";
import type { PreparedReviewSession } from "../../types.ts";

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
    (nextSession: PreparedReviewSession) => {
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

      state.setReviewedPaths(
        restoreReviewedPaths(nextSession.files, {
          reviewedFiles: buildReviewedFiles(state.session.files, state.reviewedPaths),
        }),
      );
      state.setSession(nextSession);
    },
    [getFileTopOffsets, state],
  );

  const syncRemoteState = useCallback(async () => {
    await syncRemotes(state.session.repository.rootPath);
  }, [state.session.repository.rootPath, syncRemotes]);

  return {
    applyLoadedSession,
    beginSessionLoad,
    isLatestSessionLoad,
    startInteraction,
    syncRemoteState,
  };
}
