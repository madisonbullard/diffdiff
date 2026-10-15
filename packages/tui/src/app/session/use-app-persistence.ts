import {
  getDiffdiffLogSession,
  logDiffdiffError,
  logDiffdiffInfo,
  logDiffdiffWarn,
  saveDiffdiffPreferences,
  loadDiffdiffPreferences,
  saveReviewCache,
  updateDiffdiffSessionActivity,
} from "@madisonbullard/diffdiff-core";
import { useCallback, useMemo, useRef } from "react";
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
  const preferenceWrites = useRef(Promise.resolve());
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
    (contextMessage?: string, owner = state.dialogStackRef.current.at(-1) ?? null) => {
      const message = contextMessage == null ? "An error occurred." : contextMessage;
      state.setErrorToastMessage(message);
      state.setErrorDialogOwner(owner);
      logDiffdiffWarn("app", "error_toast_shown", {
        logFilePath: resolvedLogFilePath,
        message,
      });
    },
    [resolvedLogFilePath, state.setErrorToastMessage],
  );

  const handleAppError = useCallback(
    (
      error: unknown,
      fallbackMessage: string,
      context: Record<string, unknown>,
      options?: {
        displayMessage?: string;
        dialogOwner?: import("../dialogs/stack.ts").AppDialogStackEntry | null;
      },
    ) => {
      const message = error instanceof Error ? error.message : fallbackMessage;
      const displayMessage = options?.displayMessage ?? message;
      logDiffdiffError("app", "ui_action_failed", error, {
        ...context,
        displayMessage,
        fallbackMessage,
        logFilePath: resolvedLogFilePath,
        message,
      });
      void updateDiffdiffSessionActivity({
        lastErrorMessage: message,
        statusMessage: displayMessage,
      });
      state.setStatusMessage(displayMessage);
      showErrorToast(displayMessage, options?.dialogOwner);
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
    async (nextPreferences: import("@madisonbullard/diffdiff-core").DiffdiffPreferences) => {
      preferenceWrites.current = preferenceWrites.current.then(async () => {
        try {
          const previous = await loadDiffdiffPreferences();
          await saveDiffdiffPreferences({
            ...nextPreferences,
            keys: nextPreferences.keys ?? previous.keys,
          });
        } catch (error) {
          handleAppError(error, "Unable to save diffdiff preferences.", {
            action: "save-preferences",
            preferences: nextPreferences,
          });
        }
      });
      await preferenceWrites.current;
    },
    [handleAppError],
  );

  const persistGitHubPreferences = useCallback(
    async (nextPreferences: import("@madisonbullard/diffdiff-core").GitHubUserPreferences) => {
      state.setGitHubPreferences(nextPreferences);
      state.gitHubPreferencesRef.current = nextPreferences;
      await persistDiffdiffPreferences({ github: nextPreferences });
    },
    [persistDiffdiffPreferences, state.gitHubPreferencesRef, state.setGitHubPreferences],
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
    ],
  );

  return { persistenceApi, resolvedLogFilePath };
}
