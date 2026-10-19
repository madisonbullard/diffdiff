import { getDefaultGitHubPreferences } from "@madisonbullard/diffdiff-core";
import { createWriteGuard } from "../review/write-guard.ts";
import { useSynchronousState } from "./use-synchronous-state.ts";
import type { PullRequestMenuAction } from "../../review/merge-eligibility.ts";
import type {
  GitHubDashboardPullRequest,
  GitHubUserPreferences,
} from "@madisonbullard/diffdiff-core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { DiffScrollController, type DiffLineTarget } from "../layout/diff-scroll.ts";
import { useRenderer, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildReverseKeymaps,
  createKeymapRuntime,
  getDefaultKeymaps,
  mergeUserKeymaps,
} from "../keymap/index.ts";
import type { KeymapPrefixId } from "../keymap/prefixes.ts";
import type { UserKeymapConfig } from "../keymap/index.ts";
import {
  getActiveDialogEntry,
  openDialog as openAppDialog,
  type AppDialogStackEntry,
} from "../dialogs/stack.ts";
import { createKeybindController } from "../keybind-controller.ts";
import { getSessionReviewedPaths, restoreCollapsedPaths } from "../shared/collections.ts";
import type { DiffdiffAppProps, MergeModalField, SessionActivityUpdate } from "./app-props.ts";
import type { ComparisonBrowserData, DiffdiffAppState } from "./app-state.ts";
import {
  createReviewComposerState,
  loadReviewComposerHistoryEntries,
} from "../review/review-composer-state.ts";
import { createTextInputState } from "../text-input/input-state.ts";
import { createReviewerPickerState } from "../review/reviewer-picker-state.ts";
import { PR_OVERVIEW_PATH } from "../review/pull-request-overview.ts";
import {
  buildBranchListItems,
  DEFAULT_BRANCH_LIST_FILTERS,
  findInitialBranchListSelection,
} from "../../view-model.ts";
import type { GitHubOptimisticOperation } from "../review/optimistic-github-overlay.ts";
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
  loadReviewComposerHistory,
  initialUserKeymapConfig,
}: Pick<
  DiffdiffAppProps,
  | "initialGitHubPreferences"
  | "initialOptions"
  | "initialReviewCache"
  | "initialSession"
  | "loadReviewComposerHistory"
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
  const [checksIndex, setChecksIndex] = useState(0);
  const checksDetailScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const [reviewerPicker, setReviewerPicker] = useState(createReviewerPickerState);
  const reviewerPickerAsyncRef = useRef({ loadId: 0, submitting: false });
  const [startupOptions, setStartupOptions] = useState<LaunchOptions>({ ...initialOptions });
  const [selectedFileIndex, setSelectedFileIndex] = useState(() =>
    initialReviewCache?.selectedFilePath == null
      ? initialSession.github == null
        ? 0
        : -1
      : initialSession.github != null && initialReviewCache.selectedFilePath === PR_OVERVIEW_PATH
        ? -1
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
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorToastMessage, setErrorToastMessage] = useState<string | null>(null);
  const [errorDialogOwner, setErrorDialogOwner] = useState<AppDialogStackEntry | null>(null);
  const [baseBranchLoadingMessage, setBaseBranchLoadingMessage] = useState<string | null>(null);
  const [gitHubPreferences, setGitHubPreferences] = useState<GitHubUserPreferences>(
    () => initialGitHubPreferences ?? getDefaultGitHubPreferences(),
  );
  const gitHubPreferencesRef = useRef(initialGitHubPreferences ?? getDefaultGitHubPreferences());
  const latestSessionLoadIdRef = useRef(0);
  const [dialogStack, setDialogStack, dialogStackRef] = useSynchronousState<
    readonly AppDialogStackEntry[]
  >(() =>
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
  const [commandInput, setCommandInput] = useState(() => createTextInputState());
  const [commandIndex, setCommandIndex] = useState(0);
  const [inspectorDetailFocused, setInspectorDetailFocused] = useState(false);
  useEffect(() => setInspectorDetailFocused(false), [activeOverlay]);
  const [helpLeaderOnly, setHelpLeaderOnly] = useState(false);
  const [commitListIndex, setCommitListIndex] = useState(0);
  const [commitSearchInput, setCommitSearchInput] = useState(() => createTextInputState());
  const [commitSearchActive, setCommitSearchActive] = useState(false);
  const [filterIndex, setFilterIndex] = useState(0);
  const [isPullRequestListLoading, setIsPullRequestListLoading] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isSubmittingReviewAction, setIsSubmittingReviewAction] = useState(false);
  const [writeGuard] = useState(createWriteGuard);
  const [lastAccessedFileIndex, setLastAccessedFileIndex] = useState<number | null>(null);
  const [activePrefix, setActivePrefix] = useState<KeymapPrefixId | null>(null);
  const [refreshIndicatorLabel, setRefreshIndicatorLabel] = useState<string | null>(null);
  const [refreshIndicatorStatusMessage, setRefreshIndicatorStatusMessage] = useState<string | null>(
    null,
  );
  const [diffViewPreference, setDiffViewPreference] = useState<DiffViewPreference>("unified");
  const [mergeCommitMessageInput, setMergeCommitMessageInput] = useState(() =>
    createTextInputState(),
  );
  const [mergeCommitTitleInput, setMergeCommitTitleInput] = useState(() => createTextInputState());
  const [mergeMethod, setMergeMethod] = useState<PullRequestMenuAction | undefined>(
    initialGitHubPreferences?.defaultMergeMethod,
  );
  const [mergeAutoMerge, setMergeAutoMerge] = useState(false);
  const [mergeModalField, setMergeModalField] = useState<MergeModalField>(
    initialGitHubPreferences?.defaultMergeMethod == null ? "method" : "title",
  );
  const [optimisticGitHubOperations, setOptimisticGitHubOperations] = useState<
    GitHubOptimisticOperation[]
  >([]);
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [reviewComposer, setReviewComposer] = useState(createReviewComposerState);
  const [pullRequestList, setPullRequestList] = useState<GitHubDashboardPullRequest[]>([]);
  const [pullRequestListIndex, setPullRequestListIndex] = useState(0);
  const [pullRequestSearchActive, setPullRequestSearchActive] = useState(true);
  const [pullRequestSearchInput, setPullRequestSearchInput] = useState(() =>
    createTextInputState(),
  );
  const [pullRequestConversationIndex, setPullRequestConversationIndex] = useState(0);
  const [selectedReviewCommentIndexByThreadId, setSelectedReviewCommentIndexByThreadId] = useState<
    Record<string, number>
  >({});
  const [selectedReviewThreadIndexByFilePath, setSelectedReviewThreadIndexByFilePath] = useState<
    Record<string, number>
  >({});
  const [reviewSubmissionInput, setReviewSubmissionInput] = useState(() => createTextInputState());
  const [reviewSubmissionEventIndex, setReviewSubmissionEventIndex] = useState(0);
  const formDraftsRef = useRef(new Map<string, import("../review/form-drafts.ts").FormDrafts>());
  const [reviewSubmissionField, setReviewSubmissionField] = useState<"event" | "body">("event");
  const [showSelectedReviewAnchor, setShowSelectedReviewAnchor] = useState(false);
  const [selectedReviewAnchorIndex, setSelectedReviewAnchorIndex] = useState(0);
  const [selectedReviewRange, setSelectedReviewRange] = useState<
    import("../../review-anchors.ts").ReviewRangeSelection | null
  >(null);
  const [activeFileIndex, setActiveFileIndex] = useState(selectedFileIndex);
  const [activePane, setActivePane] = useState<AppPane>("diff");
  const [collapsedDirectories, setCollapsedDirectories] = useState<Set<string>>(new Set());
  const [diffScroll] = useState(() => {
    const scroll = new DiffScrollController();
    scroll.setFiles(initialSession.files, initialSession.github != null);
    const path =
      selectedFileIndex === -1 ? PR_OVERVIEW_PATH : initialSession.files[selectedFileIndex]?.path;
    if (path != null) scroll.revealFile(path);
    return scroll;
  });
  const [selectedTreePath, setSelectedTreePath] = useState(
    selectedFileIndex === -1
      ? PR_OVERVIEW_PATH
      : (initialSession.files[selectedFileIndex]?.path ?? ""),
  );
  const [loadingIndicatorFrame, setLoadingIndicatorFrame] = useState(0);
  const treeScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const mergeBodyScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const pendingInteractionRef = useRef<import("./app-props.ts").PendingInteraction | null>(null);
  const pendingReviewCacheRef = useRef<{
    key: import("@madisonbullard/diffdiff-core").ReviewCacheKey;
    state: import("@madisonbullard/diffdiff-core").ReviewCacheState;
  } | null>(null);
  const pendingSessionActivityRef = useRef<SessionActivityUpdate | null>(null);
  const pendingInteractionTokenRef = useRef(0);
  const optimisticGitHubOperationIdRef = useRef(0);
  const optimisticGitHubOperationsRef = useRef<GitHubOptimisticOperation[]>([]);
  const initialRenderSurfaceLoggedRef = useRef(false);
  const reviewCacheTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionActivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalFocusedRef = useRef(true);
  const pullRequestListLoadIdRef = useRef(0);
  const selectedDiffRowRef = useRef<DiffLineTarget | null>(null);
  const renderer = useRenderer();
  optimisticGitHubOperationsRef.current = optimisticGitHubOperations;
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

  useEffect(() => {
    setChecksIndex(0);
    setDialogStack((stack) => stack.filter((entry) => entry.dialog !== "checks"));
  }, [session.github?.pullRequest.url]);

  useEffect(() => {
    reviewerPickerAsyncRef.current.loadId += 1;
    reviewerPickerAsyncRef.current.submitting = false;
    setReviewerPicker(createReviewerPickerState());
    setDialogStack((stack) => stack.filter((entry) => entry.dialog !== "reviewer-picker"));
    return () => {
      reviewerPickerAsyncRef.current.loadId += 1;
    };
  }, [session.github?.pullRequest.url]);

  useEffect(() => {
    if (loadReviewComposerHistory == null) {
      return;
    }

    let cancelled = false;
    void loadReviewComposerHistory()
      .then((history) => {
        if (cancelled) {
          return;
        }

        setReviewComposer((currentReviewComposer) =>
          loadReviewComposerHistoryEntries(currentReviewComposer, history),
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [loadReviewComposerHistory]);

  return {
    reviewerPicker,
    checksIndex,
    setChecksIndex,
    checksDetailScrollRef,
    setReviewerPicker,
    reviewerPickerAsyncRef,
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
    collapsedDirectories,
    collapsedPaths,
    commentCollapseStates,
    comparisonBrowserData,
    commandIndex,
    inspectorDetailFocused,
    setInspectorDetailFocused,
    helpLeaderOnly,
    setHelpLeaderOnly,
    commandInput,
    commitListIndex,
    commitSearchActive,
    commitSearchInput,
    dialogStack,
    dialogStackRef,
    diffScroll,
    diffViewPreference,
    errorToastMessage,
    errorDialogOwner,
    setErrorDialogOwner,
    filterIndex,
    gitHubPreferences,
    gitHubPreferencesRef,
    initialBranchListFilters,
    initialRenderSurfaceLoggedRef,
    isCheckingForUpdates,
    isPullRequestListLoading,
    isReloading,
    isSubmittingReviewAction,
    writeGuard,
    keybindController,
    lastAccessedFileIndex,
    latestSessionLoadIdRef,
    activePrefix,
    loadingIndicatorFrame,
    mergeBodyScrollRef,
    mergeCommitMessageInput,
    mergeCommitTitleInput,
    mergeConfirmOpen,
    mergeMethod,
    mergeAutoMerge,
    mergeModalField,
    optimisticGitHubOperations,
    optimisticGitHubOperationIdRef,
    optimisticGitHubOperationsRef,
    pendingInteractionRef,
    pendingInteractionTokenRef,
    pendingReviewCacheRef,
    pendingSessionActivityRef,
    pullRequestConversationIndex,
    pullRequestList,
    pullRequestListIndex,
    pullRequestListLoadIdRef,
    pullRequestSearchActive,
    pullRequestSearchInput,
    refreshIndicatorLabel,
    refreshIndicatorStatusMessage,
    renderer,
    reviewCacheTimeoutRef,
    reviewedPaths,
    reviewComposer,
    reviewSubmissionInput,
    reviewSubmissionEventIndex,
    formDraftsRef,
    reviewSubmissionField,
    setReviewSubmissionField,
    scrollRef,
    selectedFileIndex,
    selectedDiffRowRef,
    showSelectedReviewAnchor,
    selectedReviewAnchorIndex,
    selectedReviewRange,
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
    setCollapsedDirectories,
    setCollapsedPaths,
    setCommentCollapseStates,
    setComparisonBrowserData,
    setCommandIndex,
    setCommandInput,
    setCommitListIndex,
    setCommitSearchActive,
    setCommitSearchInput,
    setDialogStack,
    setDiffViewPreference,
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
    setMergeCommitMessageInput,
    setMergeCommitTitleInput,
    setMergeConfirmOpen,
    setMergeMethod,
    setMergeAutoMerge,
    setMergeModalField,
    setOptimisticGitHubOperations,
    setPullRequestConversationIndex,
    setPullRequestList,
    setPullRequestListIndex,
    setPullRequestSearchActive,
    setPullRequestSearchInput,
    setRefreshIndicatorLabel,
    setRefreshIndicatorStatusMessage,
    setReviewedPaths,
    setReviewComposer,
    setReviewSubmissionInput,
    setReviewSubmissionEventIndex,
    setSelectedFileIndex,
    setShowSelectedReviewAnchor,
    setSelectedReviewAnchorIndex,
    setSelectedReviewRange,
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
    treeScrollRef,
  };
}
