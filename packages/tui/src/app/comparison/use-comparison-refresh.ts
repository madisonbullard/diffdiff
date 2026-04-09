import { useCallback, useEffect } from "react";
import { probeReviewSessionFreshness } from "@madisonbullard/diffdiff-core";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import {
  LIVE_REFRESH_INTERVAL_MS,
  TERMINAL_BLUR_EVENT,
  TERMINAL_FOCUS_EVENT,
} from "../shared/constants.ts";
import { getRefreshIndicatorLabel } from "./refresh-indicator.ts";
import { useStableInterval } from "../shared/use-stable-interval.ts";

interface UseRefreshOptions {
  actions: {
    applyLoadedSession: (
      nextSession: import("../../types.ts").PreparedReviewSession,
      options?: {
        resetReviewState?: boolean;
        reviewCacheState?: import("@madisonbullard/diffdiff-core").ReviewCacheState;
      },
    ) => void;
    beginSessionLoad: () => number;
    isLatestSessionLoad: (loadId: number) => boolean;
    syncRemoteState: () => Promise<void>;
  };
  persistence: DiffdiffAppPersistence;
  props: Pick<DiffdiffAppProps, "loadSession" | "probeFreshness">;
  state: DiffdiffAppState;
}

export function useDiffdiffAppRefresh({ actions, persistence, props, state }: UseRefreshOptions) {
  const probeFreshness = props.probeFreshness ?? probeReviewSessionFreshness;

  const refreshGitState = useCallback(async () => {
    if (state.isReloading || state.isCheckingForUpdates) {
      return;
    }

    state.setIsReloading(true);
    state.setRefreshIndicatorLabel(null);
    state.setStatusMessage("Refreshing branches and GitHub data...");
    const sessionLoadId = actions.beginSessionLoad();

    try {
      await actions.syncRemoteState();
      const nextSession = await props.loadSession(state.startupOptions);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }

      actions.applyLoadedSession(nextSession);
      state.setStatusMessage("Refreshed branches and GitHub data.");
    } catch (error) {
      if (actions.isLatestSessionLoad(sessionLoadId)) {
        persistence.persistenceApi.handleAppError(error, "Unable to refresh git state.", {
          action: "refresh-git-state",
          startupOptions: state.startupOptions,
        });
      }
    } finally {
      state.setIsReloading(false);
    }
  }, [actions, persistence.persistenceApi, props, state]);

  const checkForUpdates = useCallback(async () => {
    if (state.isReloading || state.isCheckingForUpdates) {
      return;
    }

    state.setIsCheckingForUpdates(true);
    try {
      const freshness = await probeFreshness(state.session);

      if (
        state.session.comparison.mode === "working-tree" &&
        (freshness.hasComparisonUpdates || freshness.hasGitHubUpdates)
      ) {
        state.setIsReloading(true);
        state.setRefreshIndicatorLabel(null);
        state.setStatusMessage("Updating working tree view...");
        const sessionLoadId = actions.beginSessionLoad();

        try {
          const nextSession = await props.loadSession(state.startupOptions);
          if (!actions.isLatestSessionLoad(sessionLoadId)) {
            return;
          }

          actions.applyLoadedSession(nextSession);
          state.setStatusMessage("Updated working tree view.");
        } catch (error) {
          if (actions.isLatestSessionLoad(sessionLoadId)) {
            persistence.persistenceApi.handleAppError(
              error,
              "Unable to refresh the working tree view.",
              {
                action: "auto-refresh-working-tree-session",
                startupOptions: state.startupOptions,
              },
            );
          }
        } finally {
          state.setIsReloading(false);
        }

        return;
      }

      const nextRefreshIndicatorLabel = getRefreshIndicatorLabel(freshness);
      state.setRefreshIndicatorLabel(nextRefreshIndicatorLabel);
      if (
        nextRefreshIndicatorLabel != null &&
        nextRefreshIndicatorLabel !== state.refreshIndicatorLabel
      ) {
        state.setStatusMessage(`${nextRefreshIndicatorLabel}. Press Shift+R to refresh.`);
      } else if (state.refreshIndicatorLabel != null) {
        state.setStatusMessage("Current comparison is up to date.");
      }
    } catch (error) {
      persistence.persistenceApi.handleAppError(error, "Unable to refresh git state.", {
        action: "check-for-updates",
        comparison: state.session.comparison,
      });
    } finally {
      state.setIsCheckingForUpdates(false);
    }
  }, [actions, persistence.persistenceApi, probeFreshness, props, state]);

  const syncGitStateOnFocus = useCallback(async () => {
    if (state.isReloading || state.isCheckingForUpdates) {
      return;
    }

    try {
      await actions.syncRemoteState();
    } catch (error) {
      persistence.persistenceApi.handleAppError(error, "Unable to refresh git state.", {
        action: "sync-remotes-on-focus",
        startupOptions: state.startupOptions,
      });
      return;
    }
    await checkForUpdates();
  }, [
    actions,
    checkForUpdates,
    persistence.persistenceApi,
    state.isCheckingForUpdates,
    state.isReloading,
    state.startupOptions,
  ]);

  useEffect(() => {
    const handleBlur = () => {
      state.terminalFocusedRef.current = false;
    };

    const handleFocus = () => {
      state.terminalFocusedRef.current = true;
      void syncGitStateOnFocus();
    };

    state.renderer.on(TERMINAL_BLUR_EVENT, handleBlur);
    state.renderer.on(TERMINAL_FOCUS_EVENT, handleFocus);

    return () => {
      state.renderer.off(TERMINAL_BLUR_EVENT, handleBlur);
      state.renderer.off(TERMINAL_FOCUS_EVENT, handleFocus);
    };
  }, [checkForUpdates, state.renderer, state.terminalFocusedRef, syncGitStateOnFocus]);

  useStableInterval(() => {
    if (!state.terminalFocusedRef.current) {
      return;
    }

    void checkForUpdates();
  }, LIVE_REFRESH_INTERVAL_MS);

  return {
    checkForUpdates,
    refreshComparison: () => {
      void refreshGitState();
    },
  };
}
