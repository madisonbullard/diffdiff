import { getDefaultGitHubPreferences } from "@diffdiff/core";
import type {
  GitHubDashboardPullRequest,
  GitHubMergeMethod,
  GitHubRefCleanupCandidate,
  GitHubUserPreferences,
} from "@diffdiff/core";
import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import { useRenderer, useTerminalDimensions } from "@opentui/react";
import { useMemo, useRef, useState } from "react";
import {
  getActiveDialogEntry,
  openDialog as openAppDialog,
  type AppDialogStackEntry,
} from "./dialog-stack.ts";
import { createKeybindController } from "./keybind-controller.ts";
import { reconcileCollapsedPaths, restoreReviewedPaths } from "./diffdiff-app-helpers.ts";
import type { DiffdiffAppProps } from "./diffdiff-app-shared.ts";
import type { DiffdiffAppState } from "./diffdiff-app-state-types.ts";
import {
  buildBranchListItems,
  DEFAULT_BRANCH_LIST_FILTERS,
  findInitialBranchListSelection,
} from "../view-model.ts";
import type {
  AppPane,
  BranchListFilters,
  DiffViewPreference,
  LaunchOptions,
  ListModalView,
} from "../types.ts";

export type { DiffdiffAppState } from "./diffdiff-app-state-types.ts";

export function useDiffdiffAppState({
  initialGitHubPreferences,
  initialOptions,
  initialReviewCache,
  initialSession,
  initialShowKeyLegend,
}: Pick<
  DiffdiffAppProps,
  | "initialGitHubPreferences"
  | "initialOptions"
  | "initialReviewCache"
  | "initialSession"
  | "initialShowKeyLegend"
>): DiffdiffAppState {
  const launchInPullRequestList = initialOptions.initialListMode === "pull-requests";
  const launchInBranchList =
    !launchInPullRequestList &&
    initialSession.comparison.mode === "working-tree" &&
    initialSession.files.length === 0;
  const initialBranchListFilters: BranchListFilters = launchInPullRequestList
    ? { workingTree: false, localBranch: false, openPr: true, remoteBranch: false }
    : DEFAULT_BRANCH_LIST_FILTERS;
  const initialBranchItems = buildBranchListItems({
    filters: initialBranchListFilters,
    localBranches: initialSession.branches.local,
    remoteBranches: initialSession.branches.remote,
    workingTreeSummary: initialSession.workingTreeSummary,
  });
  const [session, setSession] = useState(initialSession);
  const [startupOptions, setStartupOptions] = useState<LaunchOptions>({ ...initialOptions });
  const [selectedFileIndex, setSelectedFileIndex] = useState(() =>
    initialReviewCache?.selectedFilePath == null
      ? 0
      : Math.max(
          initialSession.files.findIndex(
            (file) => file.path === initialReviewCache.selectedFilePath,
          ),
          0,
        ),
  );
  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(() =>
    restoreReviewedPaths(initialSession.files, initialReviewCache),
  );
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => {
    const baseline = reconcileCollapsedPaths(new Set<string>(), initialSession.files);
    if (initialReviewCache != null) {
      const availablePaths = new Set(initialSession.files.map((file) => file.path));
      for (const path of initialReviewCache.collapsedPaths) {
        if (availablePaths.has(path)) baseline.add(path);
      }
    }
    return baseline;
  });
  const [statusMessage, setStatusMessage] = useState<string>(
    launchInPullRequestList
      ? "Opened pull request list."
      : launchInBranchList
        ? "Opened list modal."
        : "Ready.",
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorToastMessage, setErrorToastMessage] = useState<string | null>(null);
  const [baseBranchLoadingMessage, setBaseBranchLoadingMessage] = useState<string | null>(null);
  const [cleanupCandidateIndex, setCleanupCandidateIndex] = useState(0);
  const [cleanupCandidates, setCleanupCandidates] = useState<GitHubRefCleanupCandidate[]>([]);
  const [cleanupSelection, setCleanupSelection] = useState(
    () => initialGitHubPreferences?.cleanup ?? getDefaultGitHubPreferences().cleanup,
  );
  const [gitHubPreferences, setGitHubPreferences] = useState<GitHubUserPreferences>(
    () => initialGitHubPreferences ?? getDefaultGitHubPreferences(),
  );
  const gitHubPreferencesRef = useRef(initialGitHubPreferences ?? getDefaultGitHubPreferences());
  const showKeyLegendRef = useRef(initialShowKeyLegend ?? true);
  const latestSessionLoadIdRef = useRef(0);
  const [dialogStack, setDialogStack] = useState<readonly AppDialogStackEntry[]>(() =>
    launchInPullRequestList
      ? openAppDialog([], "pull-request-list", { clear: true })
      : launchInBranchList
        ? openAppDialog([], "branch", { clear: true })
        : [],
  );
  const activeOverlay = getActiveDialogEntry(dialogStack)?.dialog ?? null;
  const [commentCollapseStates, setCommentCollapseStates] = useState<Record<string, boolean>>(
    () => initialReviewCache?.commentCollapseStates ?? {},
  );
  const [showKeyLegend, setShowKeyLegend] = useState(() => initialShowKeyLegend ?? true);
  const [activeListView, setActiveListView] = useState<ListModalView>("branch");
  const [branchListFilters, setBranchListFilters] = useState<BranchListFilters>({
    ...initialBranchListFilters,
  });
  const [branchListIndex, setBranchListIndex] = useState(() =>
    findInitialBranchListSelection({
      comparison: initialSession.comparison,
      currentBranch: initialSession.repository.currentBranch,
      items: initialBranchItems,
    }),
  );
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [commitListIndex, setCommitListIndex] = useState(0);
  const [commitSearchQuery, setCommitSearchQuery] = useState("");
  const [commitSearchActive, setCommitSearchActive] = useState(false);
  const [filterIndex, setFilterIndex] = useState(0);
  const [isPullRequestListLoading, setIsPullRequestListLoading] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isSubmittingReviewAction, setIsSubmittingReviewAction] = useState(false);
  const [leaderActive, setLeaderActive] = useState(false);
  const [refreshIndicatorLabel, setRefreshIndicatorLabel] = useState<string | null>(null);
  const [diffViewPreference, setDiffViewPreference] = useState<DiffViewPreference>("unified");
  const [mergeCommitMessage, setMergeCommitMessage] = useState("");
  const [mergeCommitTitle, setMergeCommitTitle] = useState("");
  const [mergeMethod, setMergeMethod] = useState<GitHubMergeMethod | undefined>(
    initialGitHubPreferences?.defaultMergeMethod,
  );
  const [mergeModalField, setMergeModalField] = useState<
    import("./diffdiff-app-shared.ts").MergeModalField
  >(initialGitHubPreferences?.defaultMergeMethod == null ? "method" : "title");
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [reviewComposerTarget, setReviewComposerTarget] = useState<
    import("./diffdiff-app-shared.ts").ReviewComposerTarget | null
  >(null);
  const [reviewComposerBody, setReviewComposerBody] = useState("");
  const [pullRequestList, setPullRequestList] = useState<GitHubDashboardPullRequest[]>([]);
  const [pullRequestListIndex, setPullRequestListIndex] = useState(0);
  const [pullRequestSearchActive, setPullRequestSearchActive] = useState(false);
  const [pullRequestSearchQuery, setPullRequestSearchQuery] = useState("");
  const [pullRequestConversationIndex, setPullRequestConversationIndex] = useState(0);
  const [selectedReviewCommentIndexByThreadId, setSelectedReviewCommentIndexByThreadId] = useState<
    Record<string, number>
  >({});
  const [selectedReviewThreadIndexByFilePath, setSelectedReviewThreadIndexByFilePath] = useState<
    Record<string, number>
  >({});
  const [reviewSubmissionBody, setReviewSubmissionBody] = useState("");
  const [reviewSubmissionEventIndex, setReviewSubmissionEventIndex] = useState(0);
  const [selectedReviewAnchorIndex, setSelectedReviewAnchorIndex] = useState(0);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [activePane, setActivePane] = useState<AppPane>("diff");
  const [collapsedDirectories, setCollapsedDirectories] = useState<Set<string>>(new Set());
  const [diffViewportMetrics, setDiffViewportMetrics] = useState<
    import("./diffdiff-app-shared.ts").DiffViewportMetrics
  >({ height: 0, scrollTop: 0 });
  const [selectedTreePath, setSelectedTreePath] = useState(initialSession.files[0]?.path ?? "");
  const [loadingIndicatorFrame, setLoadingIndicatorFrame] = useState(0);
  const treeScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const treeRowRefs = useRef<(BoxRenderable | null)[]>([]);
  const mergeBodyScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const fileCardRefs = useRef<(BoxRenderable | null)[]>([]);
  const pendingSelectedFileScrollOffsetRef = useRef(0);
  const pendingInteractionRef = useRef<
    import("./diffdiff-app-shared.ts").PendingInteraction | null
  >(null);
  const pendingReviewCacheRef = useRef<{
    key: import("@diffdiff/core").ReviewCacheKey;
    state: import("@diffdiff/core").ReviewCacheState;
  } | null>(null);
  const pendingSessionActivityRef = useRef<
    import("./diffdiff-app-shared.ts").SessionActivityUpdate | null
  >(null);
  const pendingSyntaxHydrationPathsRef = useRef<Set<string>>(new Set());
  const pendingInteractionTokenRef = useRef(0);
  const initialRenderSurfaceLoggedRef = useRef(false);
  const reviewCacheTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionActivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalFocusedRef = useRef(true);
  const pullRequestListLoadIdRef = useRef(0);
  const renderer = useRenderer();
  const keybindController = useMemo(
    () =>
      createKeybindController({
        getFocusedRenderable: () => renderer.currentFocusedRenderable,
        onLeaderActiveChange: setLeaderActive,
        onStatusMessage: setStatusMessage,
      }),
    [renderer],
  );
  const terminalDimensions = useTerminalDimensions();

  return {
    activeFileIndex,
    activeOverlay,
    activePane,
    activeListView,
    baseBranchLoadingMessage,
    branchListFilters,
    branchListIndex,
    cleanupCandidateIndex,
    cleanupCandidates,
    cleanupSelection,
    collapsedDirectories,
    collapsedPaths,
    commentCollapseStates,
    commandIndex,
    commandQuery,
    commitListIndex,
    commitSearchActive,
    commitSearchQuery,
    dialogStack,
    diffViewportMetrics,
    diffViewPreference,
    errorToastMessage,
    fileCardRefs,
    filterIndex,
    gitHubPreferences,
    gitHubPreferencesRef,
    initialBranchListFilters,
    initialRenderSurfaceLoggedRef,
    isCheckingForUpdates,
    isPullRequestListLoading,
    isReloading,
    isSubmittingReviewAction,
    keybindController,
    latestSessionLoadIdRef,
    leaderActive,
    loadingIndicatorFrame,
    mergeBodyScrollRef,
    mergeCommitMessage,
    mergeCommitTitle,
    mergeConfirmOpen,
    mergeMethod,
    mergeModalField,
    pendingInteractionRef,
    pendingInteractionTokenRef,
    pendingReviewCacheRef,
    pendingSelectedFileScrollOffsetRef,
    pendingSessionActivityRef,
    pendingSyntaxHydrationPathsRef,
    pullRequestConversationIndex,
    pullRequestList,
    pullRequestListIndex,
    pullRequestListLoadIdRef,
    pullRequestSearchActive,
    pullRequestSearchQuery,
    refreshIndicatorLabel,
    renderer,
    reviewCacheTimeoutRef,
    reviewedPaths,
    reviewComposerBody,
    reviewComposerTarget,
    reviewSubmissionBody,
    reviewSubmissionEventIndex,
    scrollRef,
    selectedFileIndex,
    selectedReviewAnchorIndex,
    selectedReviewCommentIndexByThreadId,
    selectedReviewThreadIndexByFilePath,
    selectedTreePath,
    session,
    sessionActivityTimeoutRef,
    setActiveFileIndex,
    setActivePane,
    setActiveListView,
    setBaseBranchLoadingMessage,
    setBranchListFilters,
    setBranchListIndex,
    setCleanupCandidateIndex,
    setCleanupCandidates,
    setCleanupSelection,
    setCollapsedDirectories,
    setCollapsedPaths,
    setCommentCollapseStates,
    setCommandIndex,
    setCommandQuery,
    setCommitListIndex,
    setCommitSearchActive,
    setCommitSearchQuery,
    setDialogStack,
    setDiffViewPreference,
    setDiffViewportMetrics,
    setErrorToastMessage,
    setFilterIndex,
    setGitHubPreferences,
    setIsCheckingForUpdates,
    setIsPullRequestListLoading,
    setIsReloading,
    setIsSubmittingReviewAction,
    setLeaderActive,
    setLoadingIndicatorFrame,
    setMergeCommitMessage,
    setMergeCommitTitle,
    setMergeConfirmOpen,
    setMergeMethod,
    setMergeModalField,
    setPullRequestConversationIndex,
    setPullRequestList,
    setPullRequestListIndex,
    setPullRequestSearchActive,
    setPullRequestSearchQuery,
    setRefreshIndicatorLabel,
    setReviewedPaths,
    setReviewComposerBody,
    setReviewComposerTarget,
    setReviewSubmissionBody,
    setReviewSubmissionEventIndex,
    setSelectedFileIndex,
    setSelectedReviewAnchorIndex,
    setSelectedReviewCommentIndexByThreadId,
    setSelectedReviewThreadIndexByFilePath,
    setSelectedTreePath,
    setSession,
    setShowKeyLegend,
    setStartupOptions,
    setStatusMessage,
    setToastMessage,
    showKeyLegend,
    showKeyLegendRef,
    startupOptions,
    statusMessage,
    terminalDimensions,
    terminalFocusedRef,
    toastMessage,
    toastTimeoutRef,
    treeRowRefs,
    treeScrollRef,
  };
}
