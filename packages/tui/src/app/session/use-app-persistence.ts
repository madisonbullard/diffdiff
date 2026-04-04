import {
  getDiffdiffLogSession,
  logDiffdiffError,
  logDiffdiffInfo,
  logDiffdiffWarn,
  saveDiffdiffPreferences,
  saveReviewCache,
  updateDiffdiffSessionActivity,
} from "@diffdiff/core";
import { useCallback, useMemo } from "react";
import type { DiffdiffAppProps, DiffdiffAppPersistenceApi } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";

export interface DiffdiffAppPersistence {
  persistenceApi: DiffdiffAppPersistenceApi;
  resolvedLogFilePath: string;
}

export function useDiffdiffAppPersistence(
  state: DiffdiffAppState,
  props: Pick<DiffdiffAppProps, "logFilePath" | "onExit">,
): DiffdiffAppPersistence {
  const flushPendingSessionActivity = useCallback(() => {
    const pendingActivity = state.pendingSessionActivityRef.current;
    state.pendingSessionActivityRef.current = null;
    return pendingActivity == null
      ? Promise.resolve()
      : updateDiffdiffSessionActivity(pendingActivity);
  }, [state.pendingSessionActivityRef]);

  const flushPendingReviewCache = useCallback(() => {
    const pendingCache = state.pendingReviewCacheRef.current;
    state.pendingReviewCacheRef.current = null;
    return pendingCache == null
      ? Promise.resolve()
      : saveReviewCache(pendingCache.key, pendingCache.state);
  }, [state.pendingReviewCacheRef]);

  const resolvedLogFilePath =
    props.logFilePath ??
    getDiffdiffLogSession()?.logFilePath ??
    "~/.diffdiff/logs/log-unknown.jsonl";

  const showToast = useCallback(
    (message: string) => {
      if (state.toastTimeoutRef.current != null) {
        clearTimeout(state.toastTimeoutRef.current);
      }
      state.setToastMessage(message);
      state.toastTimeoutRef.current = setTimeout(() => {
        state.toastTimeoutRef.current = null;
        state.setToastMessage(null);
      }, 5000);
    },
    [state.setToastMessage, state.toastTimeoutRef],
  );

  const dismissErrorToast = useCallback(() => {
    state.setErrorToastMessage((currentMessage) => {
      if (currentMessage != null) {
        logDiffdiffInfo("app", "error_toast_dismissed", {
          logFilePath: resolvedLogFilePath,
          message: currentMessage,
        });
      }

      return null;
    });
  }, [resolvedLogFilePath, state.setErrorToastMessage]);

  const showErrorToast = useCallback(
    (contextMessage?: string) => {
      const message =
        contextMessage == null
          ? `View error logs at ${resolvedLogFilePath}`
          : `${contextMessage}  View error logs at ${resolvedLogFilePath}`;
      state.setErrorToastMessage(message);
      logDiffdiffWarn("app", "error_toast_shown", {
        logFilePath: resolvedLogFilePath,
        message,
      });
    },
    [resolvedLogFilePath, state.setErrorToastMessage],
  );

  const handleAppError = useCallback(
    (error: unknown, fallbackMessage: string, context: Record<string, unknown>) => {
      const message = error instanceof Error ? error.message : fallbackMessage;
      logDiffdiffError("app", "ui_action_failed", error, {
        ...context,
        fallbackMessage,
        logFilePath: resolvedLogFilePath,
        message,
      });
      void updateDiffdiffSessionActivity({
        lastErrorMessage: message,
        statusMessage: message,
      });
      state.setStatusMessage(message);
      showErrorToast(message);
    },
    [resolvedLogFilePath, showErrorToast, state.setStatusMessage],
  );

  const handleAppFailure = useCallback(
    (message: string, context: Record<string, unknown>) => {
      logDiffdiffWarn("app", "ui_action_failed_without_exception", {
        ...context,
        logFilePath: resolvedLogFilePath,
        message,
      });
      void updateDiffdiffSessionActivity({
        lastErrorMessage: message,
        statusMessage: message,
      });
      state.setStatusMessage(message);
      showErrorToast(message);
    },
    [resolvedLogFilePath, showErrorToast, state.setStatusMessage],
  );

  const persistDiffdiffPreferences = useCallback(
    async (nextPreferences: import("@diffdiff/core").DiffdiffPreferences) => {
      try {
        await saveDiffdiffPreferences(nextPreferences);
      } catch (error) {
        handleAppError(error, "Unable to save diffdiff preferences.", {
          action: "save-preferences",
          preferences: nextPreferences,
        });
      }
    },
    [handleAppError],
  );

  const persistGitHubPreferences = useCallback(
    async (nextPreferences: import("@diffdiff/core").GitHubUserPreferences) => {
      state.setGitHubPreferences(nextPreferences);
      state.gitHubPreferencesRef.current = nextPreferences;
      await persistDiffdiffPreferences({
        github: nextPreferences,
        ui: {
          showKeyLegend: state.showKeyLegendRef.current,
        },
      });
    },
    [
      persistDiffdiffPreferences,
      state.gitHubPreferencesRef,
      state.setGitHubPreferences,
      state.showKeyLegendRef,
    ],
  );

  const updateCleanupSelection = useCallback(
    (
      updater: (currentSelection: typeof state.cleanupSelection) => typeof state.cleanupSelection,
    ) => {
      state.setCleanupSelection((currentSelection) => {
        const nextSelection = updater(currentSelection);
        void persistGitHubPreferences({
          ...state.gitHubPreferencesRef.current,
          cleanup: nextSelection,
        });
        return nextSelection;
      });
    },
    [
      persistGitHubPreferences,
      state.cleanupSelection,
      state.gitHubPreferencesRef,
      state.setCleanupSelection,
    ],
  );

  const persistenceApi = useMemo<DiffdiffAppPersistenceApi>(
    () => ({
      dismissErrorToast,
      exitApp: () => {
        if (state.reviewCacheTimeoutRef.current != null) {
          clearTimeout(state.reviewCacheTimeoutRef.current);
          state.reviewCacheTimeoutRef.current = null;
        }
        if (state.sessionActivityTimeoutRef.current != null) {
          clearTimeout(state.sessionActivityTimeoutRef.current);
          state.sessionActivityTimeoutRef.current = null;
        }
        void flushPendingReviewCache().finally(() => {
          void flushPendingSessionActivity().finally(() => {
            props.onExit();
          });
        });
      },
      handleAppError,
      handleAppFailure,
      persistDiffdiffPreferences,
      persistGitHubPreferences,
      scheduleReviewCacheSave: (key, stateValue, delayMs = 200) => {
        state.pendingReviewCacheRef.current = { key, state: stateValue };
        if (state.reviewCacheTimeoutRef.current != null) {
          clearTimeout(state.reviewCacheTimeoutRef.current);
        }
        state.reviewCacheTimeoutRef.current = setTimeout(() => {
          state.reviewCacheTimeoutRef.current = null;
          void flushPendingReviewCache();
        }, delayMs);
      },
      scheduleSessionActivity: (activity, delayMs = 120) => {
        state.pendingSessionActivityRef.current = {
          ...state.pendingSessionActivityRef.current,
          ...activity,
        };
        if (state.sessionActivityTimeoutRef.current != null) {
          clearTimeout(state.sessionActivityTimeoutRef.current);
        }
        state.sessionActivityTimeoutRef.current = setTimeout(() => {
          state.sessionActivityTimeoutRef.current = null;
          void flushPendingSessionActivity();
        }, delayMs);
      },
      showToast,
      updateCleanupSelection,
    }),
    [
      dismissErrorToast,
      flushPendingReviewCache,
      flushPendingSessionActivity,
      handleAppError,
      handleAppFailure,
      persistDiffdiffPreferences,
      persistGitHubPreferences,
      props.onExit,
      showToast,
      state.pendingReviewCacheRef,
      state.pendingSessionActivityRef,
      state.reviewCacheTimeoutRef,
      state.sessionActivityTimeoutRef,
      updateCleanupSelection,
    ],
  );

  return { persistenceApi, resolvedLogFilePath };
}
