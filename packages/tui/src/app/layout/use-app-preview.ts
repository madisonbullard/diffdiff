import { logDiffdiffError } from "@diffdiff/core";
import { useEffect, useMemo } from "react";
import { hydratePreparedReviewFiles } from "../../diff/prepare-review-session.ts";
import {
  getUnifiedVirtualWindow,
  shouldVirtualizeUnifiedPreview,
} from "../../components/unified-diff-virtualization.ts";
import type { FileCardPreviewViewport } from "../../components/file-card.tsx";
import type { UiTheme } from "../../theme.ts";
import type { PreparedReviewSession } from "../../types.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { EMPTY_REVIEW_THREADS } from "../review/review-constants.ts";
import type { RenderSurfaceMetrics } from "../state/app-props.ts";
import {
  getEstimatedFileCardBodyHeight,
  getRenderFingerprintKey,
  mergeHydratedPreparedFile,
  needsSyntaxHydration,
  shouldHydrateFileCardBody,
  shouldRenderFileCardBody,
} from "./preview-helpers.ts";

export interface DiffdiffAppPreview {
  diffRenderSurface: RenderSurfaceMetrics;
  estimatedFileCardBodyHeights: number[];
  fileCardBodyVisibility: boolean[];
  fileCardPreviewViewports: (FileCardPreviewViewport | undefined)[];
  sessionRenderKey: string;
}

interface UsePreviewOptions {
  diffPaneWidth: number;
  diffView: "unified" | "split";
  reviewThreadsByPath: Map<string, import("@diffdiff/core").GitHubPullRequestReviewThread[]>;
  selectedFileHasReviewAnchors: boolean;
  state: DiffdiffAppState;
  theme: UiTheme;
}

export function useDiffdiffAppPreview({
  diffPaneWidth,
  diffView,
  reviewThreadsByPath,
  selectedFileHasReviewAnchors,
  state,
  theme,
}: UsePreviewOptions): DiffdiffAppPreview {
  const sessionRenderKey = useMemo(
    () => getRenderFingerprintKey(state.session.renderFingerprint),
    [state.session.renderFingerprint],
  );

  const fileCardPreviewViewports = useMemo<(FileCardPreviewViewport | undefined)[]>(() => {
    const scrollBox = state.scrollRef.current;
    if (scrollBox == null || state.diffViewportMetrics.height <= 0) {
      return state.session.files.map(() => undefined);
    }

    const contentTop = scrollBox.content.y;
    return state.session.files.map((_, index) => {
      const fileCard = state.fileCardRefs.current[index];
      if (fileCard == null) {
        return undefined;
      }

      const fileTop = fileCard.y - contentTop;
      return {
        bottom: state.diffViewportMetrics.scrollTop + state.diffViewportMetrics.height - fileTop,
        overscan: 6,
        top: state.diffViewportMetrics.scrollTop - fileTop,
      };
    });
  }, [
    state.diffViewportMetrics.height,
    state.diffViewportMetrics.scrollTop,
    state.fileCardRefs,
    state.scrollRef,
    state.session.files,
  ]);

  const estimatedFileCardBodyHeights = useMemo(
    () => state.session.files.map((file) => getEstimatedFileCardBodyHeight(file, diffView)),
    [diffView, state.session.files],
  );

  const fileCardBodyVisibility = useMemo(
    () =>
      state.session.files.map((file, index) => {
        if (state.collapsedPaths.has(file.path)) {
          return false;
        }

        return shouldRenderFileCardBody({
          estimatedBodyHeight: estimatedFileCardBodyHeights[index] ?? 1,
          index,
          isSelected: index === state.selectedFileIndex,
          previewViewport: fileCardPreviewViewports[index],
        });
      }),
    [
      estimatedFileCardBodyHeights,
      fileCardPreviewViewports,
      state.collapsedPaths,
      state.selectedFileIndex,
      state.session.files,
    ],
  );

  useEffect(() => {
    state.pendingSyntaxHydrationPathsRef.current.clear();
  }, [sessionRenderKey, state.pendingSyntaxHydrationPathsRef]);

  useEffect(() => {
    const candidateFiles: PreparedReviewSession["files"] = [];
    const pendingPaths = state.pendingSyntaxHydrationPathsRef.current;
    for (const [index, file] of state.session.files.entries()) {
      if (
        state.collapsedPaths.has(file.path) ||
        pendingPaths.has(file.path) ||
        !needsSyntaxHydration(file)
      ) {
        continue;
      }

      if (
        !shouldHydrateFileCardBody({
          estimatedBodyHeight: estimatedFileCardBodyHeights[index] ?? 1,
          isSelected: index === state.selectedFileIndex,
          previewViewport: fileCardPreviewViewports[index],
        })
      ) {
        continue;
      }

      candidateFiles.push(file);
    }

    if (candidateFiles.length === 0) {
      return;
    }

    const candidatePaths = candidateFiles.map((file) => file.path);
    for (const path of candidatePaths) {
      pendingPaths.add(path);
    }

    let cancelled = false;
    void hydratePreparedReviewFiles(candidateFiles, state.session.themeName, theme, undefined, {
      initialDiffView: "both",
    })
      .then((hydratedFiles) => {
        if (cancelled) {
          return;
        }

        const hydratedFilesByPath = new Map(hydratedFiles.map((file) => [file.path, file]));
        state.setSession((currentSession) => {
          if (getRenderFingerprintKey(currentSession.renderFingerprint) !== sessionRenderKey) {
            return currentSession;
          }

          let changed = false;
          const nextFiles = currentSession.files.map((file) => {
            const hydratedFile = hydratedFilesByPath.get(file.path);
            if (hydratedFile == null) {
              return file;
            }

            const nextFile = mergeHydratedPreparedFile(file, hydratedFile);
            changed ||= nextFile !== file;
            return nextFile;
          });

          return changed ? { ...currentSession, files: nextFiles } : currentSession;
        });
      })
      .catch((error) => {
        if (!cancelled) {
          logDiffdiffError("render", "deferred_syntax_hydration_failed", error, {
            paths: candidatePaths,
            themeName: state.session.themeName,
          });
        }
      })
      .finally(() => {
        for (const path of candidatePaths) {
          pendingPaths.delete(path);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [estimatedFileCardBodyHeights, fileCardPreviewViewports, sessionRenderKey, state, theme]);

  const diffRenderSurface = useMemo<RenderSurfaceMetrics>(() => {
    let collapsedFileCount = 0;
    let deferredPreviewCount = 0;
    let expandedFileCount = 0;
    let renderedPreviewFileCount = 0;
    let renderedUnifiedLineCount = 0;
    let renderedSplitRowCount = 0;
    let renderedThreadCount = 0;

    for (const [index, file] of state.session.files.entries()) {
      if (state.collapsedPaths.has(file.path)) {
        collapsedFileCount += 1;
        continue;
      }
      expandedFileCount += 1;
      if (!fileCardBodyVisibility[index]) {
        deferredPreviewCount += 1;
        continue;
      }

      const reviewThreads = reviewThreadsByPath.get(file.path) ?? EMPTY_REVIEW_THREADS;
      const previewViewport = fileCardPreviewViewports[index];
      const hasSelectedReviewAnchor =
        index === state.selectedFileIndex && selectedFileHasReviewAnchors;
      if (diffView === "split") {
        renderedPreviewFileCount += 1;
        renderedThreadCount += reviewThreads.length;
        renderedSplitRowCount += file.sideBySideRows.length;
        continue;
      }

      if (
        shouldVirtualizeUnifiedPreview({
          hasSelectedReviewAnchor,
          previewViewport,
          reviewThreadCount: reviewThreads.length,
        })
      ) {
        const virtualWindow = getUnifiedVirtualWindow({
          file,
          previewViewport: previewViewport!,
          terminalWidth: diffPaneWidth,
        });
        const renderedLineCount =
          virtualWindow == null
            ? file.unifiedLines.length
            : Math.max(virtualWindow.endIndex - virtualWindow.startIndex + 1, 0);
        if (renderedLineCount > 0) {
          renderedPreviewFileCount += 1;
        }
        renderedUnifiedLineCount += renderedLineCount;
        continue;
      }

      renderedPreviewFileCount += 1;
      renderedThreadCount += reviewThreads.length;
      renderedUnifiedLineCount += file.unifiedLines.length;
    }

    return {
      collapsedFileCount,
      deferredPreviewCount,
      expandedFileCount,
      fileCount: state.session.files.length,
      renderedPreviewFileCount,
      renderedSplitRowCount,
      renderedThreadCount,
      renderedUnifiedLineCount,
    };
  }, [
    diffPaneWidth,
    diffView,
    fileCardBodyVisibility,
    fileCardPreviewViewports,
    reviewThreadsByPath,
    selectedFileHasReviewAnchors,
    state.collapsedPaths,
    state.selectedFileIndex,
    state.session.files,
  ]);

  return {
    diffRenderSurface,
    estimatedFileCardBodyHeights,
    fileCardBodyVisibility,
    fileCardPreviewViewports,
    sessionRenderKey,
  };
}
