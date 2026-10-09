import { useMemo } from "react";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { UiTheme } from "../../theme.ts";
import { getRenderFingerprintKey } from "./preview-helpers.ts";
import { useSyntaxHydration } from "./use-syntax-hydration.ts";
import { getFilePreview } from "../../diff/preview-lines.ts";

export function useDiffdiffAppPreview({
  diffView,
  reviewThreadsByPath,
  state,
  theme,
}: {
  diffView: "unified" | "split";
  reviewThreadsByPath: Map<
    string,
    import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread[]
  >;
  state: DiffdiffAppState;
  theme: UiTheme;
}) {
  const sessionRenderKey = getRenderFingerprintKey(state.session.renderFingerprint);
  useSyntaxHydration(state, theme, sessionRenderKey);
  const diffRenderSurface = useMemo(() => {
    const expanded = state.session.files.filter((file) => !state.collapsedPaths.has(file.path));
    return {
      fileCount: state.session.files.length,
      collapsedFileCount: state.session.files.length - expanded.length,
      expandedFileCount: expanded.length,
      deferredPreviewCount: 0,
      renderedPreviewFileCount: expanded.length,
      renderedUnifiedLineCount:
        diffView === "unified"
          ? expanded.reduce((sum, file) => sum + getFilePreview(file).unifiedLines.length, 0)
          : 0,
      renderedSplitRowCount:
        diffView === "split"
          ? expanded.reduce((sum, file) => sum + getFilePreview(file).sideBySideRows.length, 0)
          : 0,
      renderedThreadCount: expanded.reduce(
        (sum, file) => sum + (reviewThreadsByPath.get(file.path)?.length ?? 0),
        0,
      ),
    };
  }, [state.session.files, state.collapsedPaths, diffView, reviewThreadsByPath]);
  return { diffRenderSurface, sessionRenderKey };
}
