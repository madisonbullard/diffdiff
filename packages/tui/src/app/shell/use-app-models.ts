import { sortDashboardPullRequests } from "@madisonbullard/diffdiff-core";
import type { BoxRenderable } from "@opentui/core";
import { useMemo } from "react";
import { getReviewAnchors } from "../../review-anchors.ts";
import {
  buildBranchListItems,
  buildCommitListItems,
  buildFileTreeNodes,
  clampIndex,
  filterCommitListItems,
  filterPullRequests,
  getDiffPaneWidth,
  getFileTreeSidebarWidth,
  getVisibleFileTreeNodes,
  resolveDiffView,
} from "../../view-model.ts";
import { getTreeSummaryLabels } from "../tree/tree-summary.ts";
import { useDiffdiffAppPreview } from "../layout/use-app-preview.ts";
import { EMPTY_CONVERSATION_ITEMS, EMPTY_REVIEW_THREADS } from "../review/review-constants.ts";
import {
  buildReviewComposerAutocompleteState,
  type ReviewComposerAutocompleteState,
} from "../../review/composer-autocomplete.ts";
import { getReviewComposerHistoryEntriesForBrowsing } from "../../review/composer-history.ts";
import { applyOptimisticGitHubSession } from "../review/optimistic-github-overlay.ts";
import type { RenderSurfaceMetrics } from "../state/app-props.ts";
import {
  getReviewComposerContext,
  getReviewComposerHistoryScope,
  type ReviewComposerHistoryScope,
} from "../review/review-composer.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";

export interface DiffdiffAppDerived {
  branchItems: ReturnType<typeof buildBranchListItems>;
  commitItems: ReturnType<typeof buildCommitListItems>;
  diffPaneWidth: number;
  diffRenderSurface: RenderSurfaceMetrics;
  draftPrCount: number;
  diffView: "unified" | "split";
  estimatedFileCardBodyHeights: number[];
  fileCardBodyVisibility: boolean[];
  fileCardPreviewViewports: readonly (
    | import("../../components/file-card.tsx").FileCardPreviewViewport
    | undefined
  )[];
  fileCardRootRefs: readonly ((node: BoxRenderable | null) => void)[];
  fileTreeNodeByPath: Map<string, import("../../types.ts").FileTreeNode>;
  fileTreeNodePaths: Set<string>;
  fileTreeNodes: import("../../types.ts").FileTreeNode[];
  filteredCommitItems: ReturnType<typeof filterCommitListItems>;
  filteredPullRequests: import("@madisonbullard/diffdiff-core").GitHubDashboardPullRequest[];
  displaySession: import("../../types.ts").PreparedReviewSession;
  hasNextUnreviewedFile: boolean;
  hasSelectedReviewThread: boolean;
  hasThreadKeymap: boolean;
  localBranchCount: number;
  openPrCount: number;
  pullRequestConversationItems: readonly import("@madisonbullard/diffdiff-core").GitHubPullRequestConversationItem[];
  remoteBranchCount: number;
  reviewComposerContext: ReturnType<typeof getReviewComposerContext> | null;
  reviewComposerAutocomplete: ReviewComposerAutocompleteState;
  reviewComposerHistoryEntries: readonly import("@madisonbullard/diffdiff-core").ReviewComposerHistoryEntry[];
  reviewComposerHistoryScope: ReviewComposerHistoryScope | null;
  reviewRequestedPrCount: number;
  reviewThreadsByPath: Map<
    string,
    import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread[]
  >;
  selectedBranchItem?: ReturnType<typeof buildBranchListItems>[number];
  selectedCommitItem?: ReturnType<typeof filterCommitListItems>[number];
  selectedFileHasReviewAnchors: boolean;
  selectedFilePath?: string;
  selectedFileReviewThreads: readonly import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread[];
  selectedPullRequest?: import("@madisonbullard/diffdiff-core").GitHubDashboardPullRequest;
  selectedPullRequestConversationItem?: import("@madisonbullard/diffdiff-core").GitHubPullRequestConversationItem;
  selectedReviewAnchor?: import("../../review-anchors.ts").SelectedReviewAnchor;
  selectedReviewAnchors: readonly import("../../review-anchors.ts").SelectedReviewAnchor[];
  selectedReviewComment?: import("@madisonbullard/diffdiff-core").GitHubPullRequestComment;
  selectedReviewThread?: import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread;
  selectedTreeNode?: import("../../types.ts").FileTreeNode;
  sessionRenderKey: string;
  showMergeConfirmModal: boolean;
  showMergeModal: boolean;
  sidebarWidth: number;
  stickyFile?: import("../../types.ts").PreparedReviewSession["files"][number];
  treeRowRefCallbacks: readonly ((node: BoxRenderable | null) => void)[];
  treeSummaryLabels: ReturnType<typeof getTreeSummaryLabels>;
  visibleTreeNodeIndexByPath: Map<string, number>;
  visibleTreeNodes: import("../../types.ts").FileTreeNode[];
}

export function useDiffdiffAppDerived(
  state: DiffdiffAppState,
  theme: import("../../theme.ts").UiTheme,
): DiffdiffAppDerived {
  const displaySession = useMemo(
    () => applyOptimisticGitHubSession(state.session, state.optimisticGitHubOperations),
    [state.optimisticGitHubOperations, state.session],
  );
  const sidebarWidth = useMemo(
    () => getFileTreeSidebarWidth(state.terminalDimensions.width),
    [state.terminalDimensions.width],
  );
  const diffPaneWidth = useMemo(
    () => getDiffPaneWidth(state.terminalDimensions.width, sidebarWidth),
    [sidebarWidth, state.terminalDimensions.width],
  );
  const fileTreeNodes = useMemo(
    () => buildFileTreeNodes(displaySession.files),
    [displaySession.files],
  );
  const fileTreeNodeByPath = useMemo(
    () => new Map(fileTreeNodes.map((node) => [node.path, node])),
    [fileTreeNodes],
  );
  const fileTreeNodePaths = useMemo(() => new Set(fileTreeNodeByPath.keys()), [fileTreeNodeByPath]);
  const visibleTreeNodes = useMemo(
    () => getVisibleFileTreeNodes(fileTreeNodes, state.collapsedDirectories),
    [fileTreeNodes, state.collapsedDirectories],
  );
  const visibleTreeNodeIndexByPath = useMemo(
    () => new Map(visibleTreeNodes.map((node, index) => [node.path, index])),
    [visibleTreeNodes],
  );
  const reviewThreadsByPath = useMemo(() => {
    const threadsByPath = new Map<
      string,
      import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread[]
    >();
    for (const thread of displaySession.github?.pullRequest.reviewThreads ?? EMPTY_REVIEW_THREADS) {
      const pathThreads = threadsByPath.get(thread.path);
      if (pathThreads == null) {
        threadsByPath.set(thread.path, [thread]);
      } else {
        pathThreads.push(thread);
      }
    }
    return threadsByPath;
  }, [displaySession.github?.pullRequest.reviewThreads]);
  const pullRequestConversationItems =
    displaySession.github?.pullRequest.conversationItems ?? EMPTY_CONVERSATION_ITEMS;
  const fileCardRootRefs = useMemo(
    () =>
      displaySession.files.map((_, index) => (node: BoxRenderable | null) => {
        state.fileCardRefs.current[index] = node;
      }),
    [displaySession.files, state.fileCardRefs],
  );
  const treeRowRefCallbacks = useMemo(
    () =>
      visibleTreeNodes.map((_, index) => (node: BoxRenderable | null) => {
        state.treeRowRefs.current[index] = node;
      }),
    [state.treeRowRefs, visibleTreeNodes],
  );
  const treeSummaryLabels = useMemo(
    () =>
      getTreeSummaryLabels({
        additions: displaySession.files.reduce((sum, file) => sum + file.additions, 0),
        deletions: displaySession.files.reduce((sum, file) => sum + file.deletions, 0),
        reviewedCount: state.reviewedPaths.size,
        sidebarWidth,
        totalFiles: displaySession.files.length,
      }),
    [displaySession.files, sidebarWidth, state.reviewedPaths.size],
  );
  const diffView = useMemo(
    () => resolveDiffView(state.diffViewPreference, diffPaneWidth),
    [diffPaneWidth, state.diffViewPreference],
  );
  const selectedFileHasReviewAnchors = useMemo(
    () => getReviewAnchors(displaySession.files[state.selectedFileIndex], diffView).length > 0,
    [diffView, displaySession.files, state.selectedFileIndex],
  );
  const preview = useDiffdiffAppPreview({
    diffPaneWidth,
    diffView,
    reviewThreadsByPath,
    selectedFileHasReviewAnchors,
    state,
    theme,
  });
  const branchItems = useMemo(
    () =>
      buildBranchListItems({
        filters: state.branchListFilters,
        localBranches: state.comparisonBrowserData.branches.local,
        remoteBranches: state.comparisonBrowserData.branches.remote,
        workingTreeSummary: state.comparisonBrowserData.workingTreeSummary,
      }),
    [
      state.branchListFilters,
      state.comparisonBrowserData.branches.local,
      state.comparisonBrowserData.branches.remote,
      state.comparisonBrowserData.workingTreeSummary,
    ],
  );
  const commitItems = useMemo(
    () => buildCommitListItems(state.comparisonBrowserData.commits),
    [state.comparisonBrowserData.commits],
  );
  const filteredCommitItems = useMemo(
    () => filterCommitListItems(commitItems, state.commitSearchInput.value),
    [commitItems, state.commitSearchInput.value],
  );
  const orderedPullRequests = useMemo(
    () =>
      sortDashboardPullRequests(
        state.pullRequestList,
        state.session.repository.currentForgeRepository,
      ),
    [state.pullRequestList, state.session.repository.currentForgeRepository],
  );
  const filteredPullRequests = useMemo(
    () => filterPullRequests(orderedPullRequests, state.pullRequestSearchInput.value),
    [orderedPullRequests, state.pullRequestSearchInput.value],
  );
  const stickyFile = displaySession.files[state.activeFileIndex];
  const selectedBranchItem = branchItems[clampIndex(state.branchListIndex, branchItems.length)];
  const selectedCommitItem =
    filteredCommitItems[clampIndex(state.commitListIndex, filteredCommitItems.length)];
  const selectedPullRequest =
    filteredPullRequests[clampIndex(state.pullRequestListIndex, filteredPullRequests.length)];
  const selectedTreeNode =
    state.selectedTreePath === "" ? undefined : fileTreeNodeByPath.get(state.selectedTreePath);
  const selectedFilePath = displaySession.files[state.selectedFileIndex]?.path;
  const selectedFileReviewThreads =
    selectedFilePath == null
      ? EMPTY_REVIEW_THREADS
      : (reviewThreadsByPath.get(selectedFilePath) ?? EMPTY_REVIEW_THREADS);
  const selectedReviewThreadIndex =
    selectedFilePath == null
      ? undefined
      : state.selectedReviewThreadIndexByFilePath[selectedFilePath];
  const selectedReviewThread =
    selectedFilePath == null || selectedReviewThreadIndex == null
      ? undefined
      : selectedFileReviewThreads[
          clampIndex(selectedReviewThreadIndex, selectedFileReviewThreads.length)
        ];
  const selectedReviewComment =
    selectedReviewThread == null
      ? undefined
      : selectedReviewThread.comments[
          clampIndex(
            state.selectedReviewCommentIndexByThreadId[selectedReviewThread.id] ?? 0,
            selectedReviewThread.comments.length,
          )
        ];
  const selectedPullRequestConversationItem =
    pullRequestConversationItems[
      clampIndex(state.pullRequestConversationIndex, pullRequestConversationItems.length)
    ];
  const selectedReviewAnchors = useMemo(
    () => getReviewAnchors(displaySession.files[state.selectedFileIndex], diffView),
    [diffView, displaySession.files, state.selectedFileIndex],
  );
  const selectedReviewAnchor =
    selectedReviewAnchors[
      clampIndex(state.selectedReviewAnchorIndex, selectedReviewAnchors.length)
    ];
  const hasSelectedReviewThread = selectedReviewThread != null && selectedReviewComment != null;
  const hasThreadKeymap = selectedReviewThread != null;
  const hasNextUnreviewedFile = useMemo(
    () =>
      displaySession.files.some(
        (file, index) => index !== state.selectedFileIndex && !state.reviewedPaths.has(file.path),
      ),
    [displaySession.files, state.reviewedPaths, state.selectedFileIndex],
  );
  const localBranchCount = state.comparisonBrowserData.branches.local.length;
  const openPrCount = state.comparisonBrowserData.branches.remote.filter(
    (branch) => branch.pullRequest != null,
  ).length;
  const remoteBranchCount = state.comparisonBrowserData.branches.remote.length - openPrCount;
  const draftPrCount = state.pullRequestList.filter((pullRequest) => pullRequest.isDraft).length;
  const reviewRequestedPrCount = state.pullRequestList.filter(
    (pullRequest) => pullRequest.isReviewRequested,
  ).length;
  const showMergeModal = state.activeOverlay === "merge";
  const showMergeConfirmModal = showMergeModal && state.mergeConfirmOpen;
  const reviewComposerHistoryScope =
    state.reviewComposer.target == null
      ? null
      : getReviewComposerHistoryScope(state.session, state.reviewComposer.target);
  const reviewComposerAutocomplete =
    state.reviewComposer.target == null
      ? { isVisible: false, options: [], query: "" }
      : buildReviewComposerAutocompleteState({
          body: state.reviewComposer.input.value,
          cursorOffset: state.reviewComposer.input.cursorOffset,
          dismissedTokenKey: state.reviewComposer.dismissedAutocompleteTokenKey,
          paths: state.session.files.map((file) => file.path),
          selectedPath: selectedFilePath,
        });
  const reviewComposerHistoryEntries =
    reviewComposerHistoryScope == null
      ? []
      : getReviewComposerHistoryEntriesForBrowsing(
          state.reviewComposer.history,
          reviewComposerHistoryScope,
        );

  return {
    branchItems,
    commitItems,
    displaySession,
    diffPaneWidth,
    diffRenderSurface: preview.diffRenderSurface,
    diffView,
    draftPrCount,
    estimatedFileCardBodyHeights: preview.estimatedFileCardBodyHeights,
    fileCardBodyVisibility: preview.fileCardBodyVisibility,
    fileCardPreviewViewports: preview.fileCardPreviewViewports,
    fileCardRootRefs,
    fileTreeNodeByPath,
    fileTreeNodePaths,
    fileTreeNodes,
    filteredCommitItems,
    filteredPullRequests,
    hasNextUnreviewedFile,
    hasSelectedReviewThread,
    hasThreadKeymap,
    localBranchCount,
    openPrCount,
    pullRequestConversationItems,
    remoteBranchCount,
    reviewComposerAutocomplete,
    reviewComposerContext:
      state.reviewComposer.target == null
        ? null
        : getReviewComposerContext(state.reviewComposer.target),
    reviewComposerHistoryEntries,
    reviewComposerHistoryScope,
    reviewRequestedPrCount,
    reviewThreadsByPath,
    selectedBranchItem,
    selectedCommitItem,
    selectedFileHasReviewAnchors,
    selectedFilePath,
    selectedFileReviewThreads,
    selectedPullRequest,
    selectedPullRequestConversationItem,
    selectedReviewAnchor,
    selectedReviewAnchors,
    selectedReviewComment,
    selectedReviewThread,
    selectedTreeNode,
    sessionRenderKey: preview.sessionRenderKey,
    showMergeConfirmModal,
    showMergeModal,
    sidebarWidth,
    stickyFile,
    treeRowRefCallbacks,
    treeSummaryLabels,
    visibleTreeNodeIndexByPath,
    visibleTreeNodes,
  };
}
