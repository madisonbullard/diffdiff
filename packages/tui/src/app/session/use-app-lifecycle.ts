import {
  logDiffdiffInfo,
  logDiffdiffVerbose,
  logDiffdiffWarn,
  updateDiffdiffSessionActivity,
} from "@diffdiff/core";
import { useEffect } from "react";
import { getStartupTraceNow, summarizeStartupInstrumentation } from "../../startup-tracing.ts";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import { buildSessionReviewCacheState } from "../shared/collections.ts";
import type { DiffdiffAppPersistence } from "./use-app-persistence.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import { GITHUB_DIALOGS } from "../shared/constants.ts";
import { EMPTY_REVIEW_THREADS } from "../review/review-constants.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";

interface UseLifecycleOptions {
  activeKeymapModeSuspendsGlobalKeybinds: boolean;
  derived: DiffdiffAppDerived;
  persistence: DiffdiffAppPersistence;
  prefetchComparisonBrowserData: () => Promise<void>;
  refreshGitHubPullRequestList: (options?: { announce?: boolean }) => Promise<void>;
  state: DiffdiffAppState;
  startupInstrumentation?: DiffdiffAppProps["startupInstrumentation"];
}

export function useDiffdiffAppLifecycle({
  activeKeymapModeSuspendsGlobalKeybinds,
  derived,
  persistence,
  prefetchComparisonBrowserData,
  refreshGitHubPullRequestList,
  startupInstrumentation,
  state,
}: UseLifecycleOptions) {
  useEffect(() => {
    void prefetchComparisonBrowserData();
    void refreshGitHubPullRequestList({ announce: false });
    // Startup prefetch should only run once for the initial session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeKeymapModeSuspendsGlobalKeybinds) {
      return;
    }

    return state.keybindController.suspendGlobalKeybinds();
  }, [activeKeymapModeSuspendsGlobalKeybinds, state.keybindController]);

  useEffect(() => {
    return () => {
      state.keybindController.dispose();

      if (state.reviewCacheTimeoutRef.current != null) {
        clearTimeout(state.reviewCacheTimeoutRef.current);
      }

      if (state.sessionActivityTimeoutRef.current != null) {
        clearTimeout(state.sessionActivityTimeoutRef.current);
      }
    };
  }, [state.keybindController, state.reviewCacheTimeoutRef, state.sessionActivityTimeoutRef]);

  useEffect(() => {
    return () => {
      if (state.toastTimeoutRef.current != null) {
        clearTimeout(state.toastTimeoutRef.current);
      }
    };
  }, [state.toastTimeoutRef]);

  useEffect(() => {
    if (state.session.github == null) {
      state.setCleanupCandidates([]);
      state.setMergeConfirmOpen(false);
      state.setReviewComposerTarget(null);
      state.setReviewComposerBody("");
      state.setDialogStack((currentStack) => {
        const nextStack = currentStack.filter((entry) => !GITHUB_DIALOGS.has(entry.dialog));
        return nextStack.length === currentStack.length ? currentStack : nextStack;
      });
    }
  }, [
    state.session.github,
    state.setCleanupCandidates,
    state.setDialogStack,
    state.setMergeConfirmOpen,
    state.setReviewComposerBody,
    state.setReviewComposerTarget,
  ]);

  useEffect(() => {
    logDiffdiffInfo("app", "app_loaded", {
      comparison: state.session.comparison,
      logFilePath: persistence.resolvedLogFilePath,
      repository: {
        name: state.session.repository.name,
        rootPath: state.session.repository.rootPath,
      },
      startup:
        startupInstrumentation == null
          ? undefined
          : summarizeStartupInstrumentation(startupInstrumentation, getStartupTraceNow()),
    });
  }, [
    persistence.resolvedLogFilePath,
    startupInstrumentation,
    state.session.comparison,
    state.session.repository.name,
    state.session.repository.rootPath,
  ]);

  useEffect(() => {
    if (state.initialRenderSurfaceLoggedRef.current) {
      return;
    }

    state.initialRenderSurfaceLoggedRef.current = true;
    logDiffdiffInfo("app", "initial_render_surface_profile", {
      diffView: derived.diffView,
      renderSurface: derived.diffRenderSurface,
      selectedFilePath: derived.selectedFilePath,
      visibleTreeNodeCount: derived.visibleTreeNodes.length,
    });
  }, [
    derived.diffRenderSurface,
    derived.diffView,
    derived.selectedFilePath,
    derived.visibleTreeNodes.length,
    state.initialRenderSurfaceLoggedRef,
  ]);

  useEffect(() => {
    logDiffdiffInfo("app", "session_updated", {
      comparison: state.session.comparison,
      fileCount: state.session.files.length,
      hasGitHubReview: state.session.github != null,
      warningCount: state.session.warnings.length,
    });
    void updateDiffdiffSessionActivity({
      comparison: state.session.comparison,
      currentBranch: state.session.repository.currentBranch,
      repoPath: state.startupOptions.repoPath ?? state.session.repository.rootPath,
      repositoryName: state.session.repository.name,
      repositoryRootPath: state.session.repository.rootPath,
    });
  }, [state.session, state.startupOptions.repoPath]);

  useEffect(() => {
    logDiffdiffVerbose("app", "selection_updated", {
      activeFileIndex: state.activeFileIndex,
      activePane: state.activePane,
      diffView: derived.diffView,
      selectedFileIndex: state.selectedFileIndex,
      selectedFilePath: derived.selectedFilePath,
    });
    persistence.persistenceApi.scheduleSessionActivity({
      selectedFilePath: derived.selectedFilePath,
    });
  }, [
    derived.diffView,
    derived.selectedFilePath,
    persistence.persistenceApi,
    state.activeFileIndex,
    state.activePane,
    state.selectedFileIndex,
  ]);

  useEffect(() => {
    const selectedFile = state.session.files[state.selectedFileIndex];
    if (selectedFile == null) {
      return;
    }

    logDiffdiffVerbose("app", "selected_file_profile", {
      diffView: derived.diffView,
      isCollapsed: state.collapsedPaths.has(selectedFile.path),
      patchBytes: Buffer.byteLength(selectedFile.patch, "utf8"),
      path: selectedFile.path,
      reviewThreadCount: (
        derived.reviewThreadsByPath.get(selectedFile.path) ?? EMPTY_REVIEW_THREADS
      ).length,
      splitRowCount: selectedFile.sideBySideRows.length,
      unifiedLineCount: selectedFile.unifiedLines.length,
    });
  }, [
    derived.diffView,
    derived.reviewThreadsByPath,
    state.collapsedPaths,
    state.selectedFileIndex,
    state.session.files,
  ]);

  useEffect(() => {
    persistence.persistenceApi.scheduleReviewCacheSave(
      {
        repositoryRootPath: state.session.repository.rootPath,
        base: state.session.comparison.base,
        head: state.session.comparison.head,
      },
      buildSessionReviewCacheState(state.session, state.reviewedPaths, {
        collapsedPaths: [...state.collapsedPaths],
        commentCollapseStates: state.commentCollapseStates,
        selectedFilePath: state.session.files[state.selectedFileIndex]?.path,
      }),
    );
  }, [
    persistence.persistenceApi,
    state.collapsedPaths,
    state.commentCollapseStates,
    state.reviewedPaths,
    state.selectedFileIndex,
    state.session.comparison.base,
    state.session.comparison.head,
    state.session.files,
    state.session.repository.rootPath,
  ]);

  useEffect(() => {
    logDiffdiffVerbose("app", "overlay_updated", { activeOverlay: state.activeOverlay });
    persistence.persistenceApi.scheduleSessionActivity({
      activeOverlay: state.activeOverlay ?? undefined,
    });
  }, [persistence.persistenceApi, state.activeOverlay]);

  useEffect(() => {
    logDiffdiffVerbose("app", "status_message_updated", { message: state.statusMessage });
    persistence.persistenceApi.scheduleSessionActivity({ statusMessage: state.statusMessage });
  }, [persistence.persistenceApi, state.statusMessage]);

  useEffect(() => {
    if (state.toastMessage != null) {
      logDiffdiffInfo("app", "toast_shown", { kind: "success", message: state.toastMessage });
    }
  }, [state.toastMessage]);

  useEffect(() => {
    if (state.errorToastMessage != null) {
      logDiffdiffWarn("app", "toast_shown", { kind: "error", message: state.errorToastMessage });
    }
  }, [state.errorToastMessage]);

  useEffect(() => {
    const pendingInteraction = state.pendingInteractionRef.current;
    if (pendingInteraction == null) {
      return;
    }

    if (
      (pendingInteraction.expectedPane != null &&
        pendingInteraction.expectedPane !== state.activePane) ||
      (pendingInteraction.expectedDiffView != null &&
        pendingInteraction.expectedDiffView !== derived.diffView) ||
      (pendingInteraction.expectedSelectedFilePath != null &&
        pendingInteraction.expectedSelectedFilePath !== derived.selectedFilePath) ||
      (pendingInteraction.expectedSelectedTreePath != null &&
        pendingInteraction.expectedSelectedTreePath !== state.selectedTreePath)
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (state.pendingInteractionRef.current?.token !== pendingInteraction.token) {
        return;
      }

      logDiffdiffInfo("perf", "interaction_completed", {
        activePane: state.activePane,
        diffView: derived.diffView,
        durationMs: Math.round((performance.now() - pendingInteraction.startedAt) * 100) / 100,
        interaction: pendingInteraction.kind,
        renderSurface: derived.diffRenderSurface,
        selectedFilePath: derived.selectedFilePath,
        selectedTreePath: state.selectedTreePath,
        visibleTreeNodeCount: derived.visibleTreeNodes.length,
        ...pendingInteraction.details,
      });
      state.pendingInteractionRef.current = null;
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    derived.diffRenderSurface,
    derived.diffView,
    derived.selectedFilePath,
    derived.visibleTreeNodes.length,
    state.activePane,
    state.pendingInteractionRef,
    state.selectedTreePath,
  ]);
}
