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
  buildReverseKeymaps,
  createKeymapRuntime,
  getDefaultKeymaps,
  mergeUserKeymaps,
} from "../keymap/index.ts";
import type { UserKeymapConfig } from "../keymap/index.ts";
import {
  getActiveDialogEntry,
  openDialog as openAppDialog,
  type AppDialogStackEntry,
} from "../dialogs/stack.ts";
import { createKeybindController } from "../keybind-controller.ts";
import { getSessionReviewedPaths, restoreCollapsedPaths } from "../shared/collections.ts";
import type {
  DiffdiffAppProps,
  DiffViewportMetrics,
  MergeModalField,
  SessionActivityUpdate,
} from "./app-props.ts";
import type { ComparisonBrowserData, DiffdiffAppState } from "./app-state.ts";
import type { ReviewComposerTarget } from "../review/review-composer.ts";
import {
  buildBranchListItems,
  DEFAULT_BRANCH_LIST_FILTERS,
  findInitialBranchListSelection,
} from "../../view-model.ts";
import type { PendingFileFocusRequest } from "../shared/file-focus.ts";
import type {
  AppPane,
  BranchListFilters,
  DiffViewPreference,
  LaunchOptions,
  ListModalView,
  PreparedReviewSession,
} from "../../types.ts";

export type { DiffdiffAppState } from "./app-state.ts";

function getComparisonBrowserData(session: PreparedReviewSession): ComparisonBrowserData {
  return {
    branches: session.branches,
    commits: session.commits,
    workingTreeSummary: session.workingTreeSummary,
  };
}

export function useDiffdiffAppState({
  initialGitHubPreferences,
  initialOptions,
  initialReviewCache,
  initialSession,
  initialUserKeymapConfig,
}: Pick<
  DiffdiffAppProps,
  | "initialGitHubPreferences"
  | "initialOptions"
  | "initialReviewCache"
  | "initialSession"
  | "initialUserKeymapConfig"
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
    getSessionReviewedPaths(initialSession, initialReviewCache),
  );
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() =>
    restoreCollapsedPaths(initialSession.files, initialReviewCache),
  );
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
  const [comparisonBrowserData, setComparisonBrowserData] = useState<ComparisonBrowserData>(() =>
    getComparisonBrowserData(initialSession),
  );
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
  const [lastAccessedFileIndex, setLastAccessedFileIndex] = useState<number | null>(null);
  const [activePrefix, setActivePrefix] = useState<
    import("../../commands.ts").CommandKeybindPrefix | null
  >(null);
  const [refreshIndicatorLabel, setRefreshIndicatorLabel] = useState<string | null>(null);
  const [diffViewPreference, setDiffViewPreference] = useState<DiffViewPreference>("unified");
  const [mergeCommitMessage, setMergeCommitMessage] = useState("");
  const [mergeCommitTitle, setMergeCommitTitle] = useState("");
  const [mergeMethod, setMergeMethod] = useState<GitHubMergeMethod | undefined>(
    initialGitHubPreferences?.defaultMergeMethod,
  );
  const [mergeModalField, setMergeModalField] = useState<MergeModalField>(
    initialGitHubPreferences?.defaultMergeMethod == null ? "method" : "title",
  );
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [reviewComposerTarget, setReviewComposerTarget] = useState<ReviewComposerTarget | null>(
    null,
  );
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
  const [diffViewportMetrics, setDiffViewportMetrics] = useState<DiffViewportMetrics>({
    height: 0,
    scrollTop: 0,
  });
  const [selectedTreePath, setSelectedTreePath] = useState(initialSession.files[0]?.path ?? "");
  const [loadingIndicatorFrame, setLoadingIndicatorFrame] = useState(0);
  const treeScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const treeRowRefs = useRef<(BoxRenderable | null)[]>([]);
  const mergeBodyScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const fileCardRefs = useRef<(BoxRenderable | null)[]>([]);
  const pendingFileFocusRequestRef = useRef<PendingFileFocusRequest | null>(null);
  const pendingInteractionRef = useRef<import("./app-props.ts").PendingInteraction | null>(null);
  const pendingReviewCacheRef = useRef<{
    key: import("@diffdiff/core").ReviewCacheKey;
    state: import("@diffdiff/core").ReviewCacheState;
  } | null>(null);
  const pendingSessionActivityRef = useRef<SessionActivityUpdate | null>(null);
  const pendingSyntaxHydrationPathsRef = useRef<Set<string>>(new Set());
  const pendingInteractionTokenRef = useRef(0);
  const initialRenderSurfaceLoggedRef = useRef(false);
  const reviewCacheTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionActivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalFocusedRef = useRef(true);
  const pullRequestListLoadIdRef = useRef(0);
  const renderer = useRenderer();
  const resolvedKeymaps = useMemo(
    () =>
      mergeUserKeymaps(
        getDefaultKeymaps(),
        initialUserKeymapConfig as UserKeymapConfig | undefined,
      ),
    [initialUserKeymapConfig],
  );
  const reverseKeymaps = useMemo(() => buildReverseKeymaps(resolvedKeymaps), [resolvedKeymaps]);
  const keymapRuntime = useMemo(() => createKeymapRuntime(resolvedKeymaps), [resolvedKeymaps]);
  const keybindController = useMemo(
    () =>
      createKeybindController({
        getFocusedRenderable: () => renderer.currentFocusedRenderable,
        onActivePrefixChange: setActivePrefix,
        onStatusMessage: setStatusMessage,
      }),
    [renderer],
  );
  const terminalDimensions = useTerminalDimensions();

  return {
    activeFileIndex,
    resolvedKeymaps,
    reverseKeymaps,
    keymapRuntime,
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
    comparisonBrowserData,
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
    lastAccessedFileIndex,
    latestSessionLoadIdRef,
    activePrefix,
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
    pendingFileFocusRequestRef,
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
    setComparisonBrowserData,
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
    setActivePrefix,
    setLastAccessedFileIndex,
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
    setStartupOptions,
    setStatusMessage,
    setToastMessage,
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
