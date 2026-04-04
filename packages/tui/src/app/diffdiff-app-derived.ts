import { sortDashboardPullRequests } from "@diffdiff/core";
import type { BoxRenderable } from "@opentui/core";
import { useMemo } from "react";
import { getReviewAnchors } from "../review-anchors.ts";
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
} from "../view-model.ts";
import { getTreeSummaryLabels } from "./diffdiff-app-helpers.ts";
import { useDiffdiffAppPreview } from "./diffdiff-app-preview.ts";
import {
  EMPTY_CONVERSATION_ITEMS,
  EMPTY_REVIEW_THREADS,
  getReviewComposerContext,
  type RenderSurfaceMetrics,
} from "./diffdiff-app-shared.ts";
import type { DiffdiffAppState } from "./diffdiff-app-state.ts";

export interface DiffdiffAppDerived {
  branchItems: ReturnType<typeof buildBranchListItems>;
  commitItems: ReturnType<typeof buildCommitListItems>;
  diffPaneWidth: number;
  diffRenderSurface: RenderSurfaceMetrics;
  diffView: "unified" | "split";
  estimatedFileCardBodyHeights: number[];
  fileCardBodyVisibility: boolean[];
  fileCardPreviewViewports: readonly (
    | import("../components/file-card.tsx").FileCardPreviewViewport
    | undefined
  )[];
  fileCardRootRefs: readonly ((node: BoxRenderable | null) => void)[];
  fileTreeNodeByPath: Map<string, import("../types.ts").FileTreeNode>;
  fileTreeNodePaths: Set<string>;
  fileTreeNodes: import("../types.ts").FileTreeNode[];
  filteredCommitItems: ReturnType<typeof filterCommitListItems>;
  filteredPullRequests: import("@diffdiff/core").GitHubDashboardPullRequest[];
  hasNextUnreviewedFile: boolean;
  hasSelectedReviewThread: boolean;
  hasThreadKeymap: boolean;
  openPrCount: number;
  pullRequestConversationItems: readonly import("@diffdiff/core").GitHubPullRequestConversationItem[];
  remoteBranchCount: number;
  reviewComposerContext: ReturnType<typeof getReviewComposerContext> | null;
  reviewRequestedPrCount: number;
  reviewThreadsByPath: Map<string, import("@diffdiff/core").GitHubPullRequestReviewThread[]>;
  selectedBranchItem?: ReturnType<typeof buildBranchListItems>[number];
  selectedCommitItem?: ReturnType<typeof filterCommitListItems>[number];
  selectedFileHasReviewAnchors: boolean;
  selectedFilePath?: string;
  selectedFileReviewThreads: readonly import("@diffdiff/core").GitHubPullRequestReviewThread[];
  selectedPullRequest?: import("@diffdiff/core").GitHubDashboardPullRequest;
  selectedPullRequestConversationItem?: import("@diffdiff/core").GitHubPullRequestConversationItem;
  selectedReviewAnchor?: import("../review-anchors.ts").SelectedReviewAnchor;
  selectedReviewAnchors: readonly import("../review-anchors.ts").SelectedReviewAnchor[];
  selectedReviewComment?: import("@diffdiff/core").GitHubPullRequestComment;
  selectedReviewThread?: import("@diffdiff/core").GitHubPullRequestReviewThread;
  selectedTreeNode?: import("../types.ts").FileTreeNode;
  sessionRenderKey: string;
  showMergeConfirmModal: boolean;
  showMergeModal: boolean;
  sidebarWidth: number;
  stickyFile?: import("../types.ts").PreparedReviewSession["files"][number];
  treeRowRefCallbacks: readonly ((node: BoxRenderable | null) => void)[];
  treeSummaryLabels: ReturnType<typeof getTreeSummaryLabels>;
  visibleTreeNodeIndexByPath: Map<string, number>;
  visibleTreeNodes: import("../types.ts").FileTreeNode[];
}

export function useDiffdiffAppDerived(
  state: DiffdiffAppState,
  theme: import("../theme.ts").UiTheme,
): DiffdiffAppDerived {
  const sidebarWidth = useMemo(
    () => getFileTreeSidebarWidth(state.terminalDimensions.width),
    [state.terminalDimensions.width],
  );
  const diffPaneWidth = useMemo(
    () => getDiffPaneWidth(state.terminalDimensions.width, sidebarWidth),
    [sidebarWidth, state.terminalDimensions.width],
  );
  const fileTreeNodes = useMemo(
    () => buildFileTreeNodes(state.session.files),
    [state.session.files],
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
      import("@diffdiff/core").GitHubPullRequestReviewThread[]
    >();
    for (const thread of state.session.github?.pullRequest.reviewThreads ?? EMPTY_REVIEW_THREADS) {
      const pathThreads = threadsByPath.get(thread.path);
      if (pathThreads == null) {
        threadsByPath.set(thread.path, [thread]);
      } else {
        pathThreads.push(thread);
      }
    }
    return threadsByPath;
  }, [state.session.github?.pullRequest.reviewThreads]);
  const pullRequestConversationItems =
    state.session.github?.pullRequest.conversationItems ?? EMPTY_CONVERSATION_ITEMS;
  const fileCardRootRefs = useMemo(
    () =>
      state.session.files.map((_, index) => (node: BoxRenderable | null) => {
        state.fileCardRefs.current[index] = node;
      }),
    [state.fileCardRefs, state.session.files],
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
        additions: state.session.files.reduce((sum, file) => sum + file.additions, 0),
        deletions: state.session.files.reduce((sum, file) => sum + file.deletions, 0),
        reviewedCount: state.reviewedPaths.size,
        sidebarWidth,
        totalFiles: state.session.files.length,
      }),
    [sidebarWidth, state.reviewedPaths.size, state.session.files],
  );
  const diffView = useMemo(
    () => resolveDiffView(state.diffViewPreference, diffPaneWidth),
    [diffPaneWidth, state.diffViewPreference],
  );
  const selectedFileHasReviewAnchors = useMemo(
    () => getReviewAnchors(state.session.files[state.selectedFileIndex], diffView).length > 0,
    [diffView, state.selectedFileIndex, state.session.files],
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
        localBranches: state.session.branches.local,
        remoteBranches: state.session.branches.remote,
        workingTreeSummary: state.session.workingTreeSummary,
      }),
    [
      state.branchListFilters,
      state.session.branches.local,
      state.session.branches.remote,
      state.session.workingTreeSummary,
    ],
  );
  const commitItems = useMemo(
    () => buildCommitListItems(state.session.commits),
    [state.session.commits],
  );
  const filteredCommitItems = useMemo(
    () => filterCommitListItems(commitItems, state.commitSearchQuery),
    [commitItems, state.commitSearchQuery],
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
    () => filterPullRequests(orderedPullRequests, state.pullRequestSearchQuery),
    [orderedPullRequests, state.pullRequestSearchQuery],
  );
  const stickyFile = state.session.files[state.activeFileIndex];
  const selectedBranchItem = branchItems[clampIndex(state.branchListIndex, branchItems.length)];
  const selectedCommitItem =
    filteredCommitItems[clampIndex(state.commitListIndex, filteredCommitItems.length)];
  const selectedPullRequest =
    filteredPullRequests[clampIndex(state.pullRequestListIndex, filteredPullRequests.length)];
  const selectedTreeNode =
    state.selectedTreePath === "" ? undefined : fileTreeNodeByPath.get(state.selectedTreePath);
  const selectedFilePath = state.session.files[state.selectedFileIndex]?.path;
  const selectedFileReviewThreads =
    selectedFilePath == null
      ? EMPTY_REVIEW_THREADS
      : (reviewThreadsByPath.get(selectedFilePath) ?? EMPTY_REVIEW_THREADS);
  const selectedReviewThread =
    selectedFilePath == null
      ? undefined
      : selectedFileReviewThreads[
          clampIndex(
            state.selectedReviewThreadIndexByFilePath[selectedFilePath] ?? 0,
            selectedFileReviewThreads.length,
          )
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
    () => getReviewAnchors(state.session.files[state.selectedFileIndex], diffView),
    [diffView, state.selectedFileIndex, state.session.files],
  );
  const selectedReviewAnchor =
    selectedReviewAnchors[
      clampIndex(state.selectedReviewAnchorIndex, selectedReviewAnchors.length)
    ];
  const hasSelectedReviewThread = selectedReviewThread != null && selectedReviewComment != null;
  const hasThreadKeymap = selectedReviewThread != null;
  const hasNextUnreviewedFile = useMemo(
    () =>
      state.session.files.some(
        (file, index) => index !== state.selectedFileIndex && !state.reviewedPaths.has(file.path),
      ),
    [state.reviewedPaths, state.selectedFileIndex, state.session.files],
  );
  const openPrCount = state.session.branches.remote.filter(
    (branch) => branch.pullRequest != null,
  ).length;
  const remoteBranchCount = state.session.branches.remote.length - openPrCount;
  const reviewRequestedPrCount = state.pullRequestList.filter(
    (pullRequest) => pullRequest.isReviewRequested,
  ).length;
  const showMergeModal = state.activeOverlay === "merge";
  const showMergeConfirmModal = showMergeModal && state.mergeConfirmOpen;

  return {
    branchItems,
    commitItems,
    diffPaneWidth,
    diffRenderSurface: preview.diffRenderSurface,
    diffView,
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
    openPrCount,
    pullRequestConversationItems,
    remoteBranchCount,
    reviewComposerContext:
      state.reviewComposerTarget == null
        ? null
        : getReviewComposerContext(state.reviewComposerTarget),
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
