import type {
  GitHubDashboardPullRequest,
  GitHubMergeMethod,
  GitHubRefCleanupCandidate,
  GitHubUserPreferences,
} from "@madisonbullard/diffdiff-core";
import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { useRenderer, useTerminalDimensions } from "@opentui/react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AppDialogStackEntry } from "../dialogs/stack.ts";
import { createKeybindController } from "../keybind-controller.ts";
import type { KeymapPrefixId } from "../keymap/prefixes.ts";
import type { KeymapRuntime, ResolvedKeymaps, ReverseKeymaps } from "../keymap/index.ts";
import type { TextInputState } from "../text-input/input-state.ts";
import type {
  AppPane,
  BranchListFilters,
  DiffViewPreference,
  LaunchOptions,
  ListModalView,
  PreparedReviewSession,
} from "../../types.ts";
import type {
  DiffViewportMetrics,
  MergeModalField,
  PendingInteraction,
  SessionActivityUpdate,
} from "./app-props.ts";
import type { GitHubOptimisticOperation } from "../review/optimistic-github-overlay.ts";
import type { PendingFileFocusRequest } from "../shared/file-focus.ts";
import type { ReviewComposerUiState } from "../review/review-composer-state.ts";

export interface ComparisonBrowserData {
  branches: PreparedReviewSession["branches"];
  commits: PreparedReviewSession["commits"];
  workingTreeSummary: PreparedReviewSession["workingTreeSummary"];
}

export interface DiffdiffAppState {
  activeFileIndex: number;
  /** The fully resolved (defaults + user overrides) keymaps. */
  resolvedKeymaps: ResolvedKeymaps;
  /** Reverse lookup data derived from the resolved keymaps for UI labels. */
  reverseKeymaps: ReverseKeymaps;
  /** The keymap runtime that tracks pending sequences. */
  keymapRuntime: KeymapRuntime;
  activeOverlay: import("../dialogs/stack.ts").AppDialog | null;
  activePane: AppPane;
  activeListView: ListModalView;
  baseBranchLoadingMessage: string | null;
  branchListFilters: BranchListFilters;
  branchListIndex: number;
  cleanupCandidateIndex: number;
  cleanupCandidates: GitHubRefCleanupCandidate[];
  cleanupSelection: import("@madisonbullard/diffdiff-core").GitHubCleanupPreferences;
  collapsedDirectories: Set<string>;
  collapsedPaths: Set<string>;
  commentCollapseStates: Record<string, boolean>;
  comparisonBrowserData: ComparisonBrowserData;
  commandIndex: number;
  commandInput: TextInputState;
  commitListIndex: number;
  commitSearchActive: boolean;
  commitSearchInput: TextInputState;
  dialogStack: readonly AppDialogStackEntry[];
  diffViewportMetrics: DiffViewportMetrics;
  diffViewPreference: DiffViewPreference;
  errorToastMessage: string | null;
  filterIndex: number;
  gitHubPreferences: GitHubUserPreferences;
  gitHubPreferencesRef: MutableRefObject<GitHubUserPreferences>;
  initialBranchListFilters: BranchListFilters;
  initialRenderSurfaceLoggedRef: MutableRefObject<boolean>;
  isCheckingForUpdates: boolean;
  isPullRequestListLoading: boolean;
  isReloading: boolean;
  isSubmittingReviewAction: boolean;
  keybindController: ReturnType<typeof createKeybindController>;
  /** The previously selected file index for alternate-file navigation (`ga`). */
  lastAccessedFileIndex: number | null;
  latestSessionLoadIdRef: MutableRefObject<number>;
  activePrefix: KeymapPrefixId | null;
  loadingIndicatorFrame: number;
  mergeCommitMessageInput: TextInputState;
  mergeCommitTitleInput: TextInputState;
  mergeConfirmOpen: boolean;
  mergeMethod: GitHubMergeMethod | undefined;
  mergeModalField: MergeModalField;
  optimisticGitHubOperations: GitHubOptimisticOperation[];
  optimisticGitHubOperationIdRef: MutableRefObject<number>;
  optimisticGitHubOperationsRef: MutableRefObject<GitHubOptimisticOperation[]>;
  pendingInteractionRef: MutableRefObject<PendingInteraction | null>;
  pendingInteractionTokenRef: MutableRefObject<number>;
  pendingReviewCacheRef: MutableRefObject<{
    key: import("@madisonbullard/diffdiff-core").ReviewCacheKey;
    state: import("@madisonbullard/diffdiff-core").ReviewCacheState;
  } | null>;
  pendingFileFocusRequestRef: MutableRefObject<PendingFileFocusRequest | null>;
  pendingSelectedDiffAnchorKeyRef: MutableRefObject<string | null>;
  pendingSessionActivityRef: MutableRefObject<SessionActivityUpdate | null>;
  pendingSyntaxHydrationPathsRef: MutableRefObject<Set<string>>;
  pullRequestConversationIndex: number;
  pullRequestList: GitHubDashboardPullRequest[];
  pullRequestListIndex: number;
  pullRequestListLoadIdRef: MutableRefObject<number>;
  pullRequestSearchActive: boolean;
  pullRequestSearchInput: TextInputState;
  refreshIndicatorLabel: string | null;
  refreshIndicatorStatusMessage: string | null;
  renderer: ReturnType<typeof useRenderer>;
  reviewCacheTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  reviewedPaths: Set<string>;
  reviewComposer: ReviewComposerUiState;
  reviewSubmissionInput: TextInputState;
  reviewSubmissionEventIndex: number;
  selectedFileIndex: number;
  showSelectedReviewAnchor: boolean;
  selectedReviewAnchorIndex: number;
  selectedReviewCommentIndexByThreadId: Record<string, number>;
  selectedReviewThreadIndexByFilePath: Record<string, number>;
  selectedTreePath: string;
  session: PreparedReviewSession;
  sessionActivityTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  startupOptions: LaunchOptions;
  statusMessage: string;
  terminalDimensions: ReturnType<typeof useTerminalDimensions>;
  terminalFocusedRef: MutableRefObject<boolean>;
  toastMessage: string | null;
  toastTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  treeRowRefs: MutableRefObject<(BoxRenderable | null)[]>;
  treeScrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  scrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  mergeBodyScrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  fileCardRefs: MutableRefObject<(BoxRenderable | null)[]>;
  selectedDiffRowRef: MutableRefObject<BoxRenderable | null>;
  setActiveFileIndex: Dispatch<SetStateAction<number>>;
  setActivePane: Dispatch<SetStateAction<AppPane>>;
  setActiveListView: Dispatch<SetStateAction<ListModalView>>;
  setBaseBranchLoadingMessage: Dispatch<SetStateAction<string | null>>;
  setBranchListFilters: Dispatch<SetStateAction<BranchListFilters>>;
  setBranchListIndex: Dispatch<SetStateAction<number>>;
  setCleanupCandidateIndex: Dispatch<SetStateAction<number>>;
  setCleanupCandidates: Dispatch<SetStateAction<GitHubRefCleanupCandidate[]>>;
  setCleanupSelection: Dispatch<
    SetStateAction<import("@madisonbullard/diffdiff-core").GitHubCleanupPreferences>
  >;
  setCollapsedDirectories: Dispatch<SetStateAction<Set<string>>>;
  setCollapsedPaths: Dispatch<SetStateAction<Set<string>>>;
  setCommentCollapseStates: Dispatch<SetStateAction<Record<string, boolean>>>;
  setComparisonBrowserData: Dispatch<SetStateAction<ComparisonBrowserData>>;
  setCommandIndex: Dispatch<SetStateAction<number>>;
  setCommandInput: Dispatch<SetStateAction<TextInputState>>;
  setCommitListIndex: Dispatch<SetStateAction<number>>;
  setCommitSearchActive: Dispatch<SetStateAction<boolean>>;
  setCommitSearchInput: Dispatch<SetStateAction<TextInputState>>;
  setDialogStack: Dispatch<SetStateAction<readonly AppDialogStackEntry[]>>;
  setDiffViewPreference: Dispatch<SetStateAction<DiffViewPreference>>;
  setDiffViewportMetrics: Dispatch<SetStateAction<DiffViewportMetrics>>;
  setErrorToastMessage: Dispatch<SetStateAction<string | null>>;
  setFilterIndex: Dispatch<SetStateAction<number>>;
  setGitHubPreferences: Dispatch<SetStateAction<GitHubUserPreferences>>;
  setIsCheckingForUpdates: Dispatch<SetStateAction<boolean>>;
  setIsPullRequestListLoading: Dispatch<SetStateAction<boolean>>;
  setIsReloading: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingReviewAction: Dispatch<SetStateAction<boolean>>;
  setActivePrefix: Dispatch<SetStateAction<KeymapPrefixId | null>>;
  setLastAccessedFileIndex: Dispatch<SetStateAction<number | null>>;
  setLoadingIndicatorFrame: Dispatch<SetStateAction<number>>;
  setMergeCommitMessageInput: Dispatch<SetStateAction<TextInputState>>;
  setMergeCommitTitleInput: Dispatch<SetStateAction<TextInputState>>;
  setMergeConfirmOpen: Dispatch<SetStateAction<boolean>>;
  setMergeMethod: Dispatch<SetStateAction<GitHubMergeMethod | undefined>>;
  setMergeModalField: Dispatch<SetStateAction<MergeModalField>>;
  setOptimisticGitHubOperations: Dispatch<SetStateAction<GitHubOptimisticOperation[]>>;
  setPullRequestConversationIndex: Dispatch<SetStateAction<number>>;
  setPullRequestList: Dispatch<SetStateAction<GitHubDashboardPullRequest[]>>;
  setPullRequestListIndex: Dispatch<SetStateAction<number>>;
  setPullRequestSearchActive: Dispatch<SetStateAction<boolean>>;
  setPullRequestSearchInput: Dispatch<SetStateAction<TextInputState>>;
  setRefreshIndicatorLabel: Dispatch<SetStateAction<string | null>>;
  setRefreshIndicatorStatusMessage: Dispatch<SetStateAction<string | null>>;
  setReviewedPaths: Dispatch<SetStateAction<Set<string>>>;
  setReviewComposer: Dispatch<SetStateAction<ReviewComposerUiState>>;
  setReviewSubmissionInput: Dispatch<SetStateAction<TextInputState>>;
  setReviewSubmissionEventIndex: Dispatch<SetStateAction<number>>;
  setSelectedFileIndex: Dispatch<SetStateAction<number>>;
  setShowSelectedReviewAnchor: Dispatch<SetStateAction<boolean>>;
  setSelectedReviewAnchorIndex: Dispatch<SetStateAction<number>>;
  setSelectedReviewCommentIndexByThreadId: Dispatch<SetStateAction<Record<string, number>>>;
  setSelectedReviewThreadIndexByFilePath: Dispatch<SetStateAction<Record<string, number>>>;
  setSelectedTreePath: Dispatch<SetStateAction<string>>;
  setSession: Dispatch<SetStateAction<PreparedReviewSession>>;
  setStartupOptions: Dispatch<SetStateAction<LaunchOptions>>;
  setStatusMessage: Dispatch<SetStateAction<string>>;
  setToastMessage: Dispatch<SetStateAction<string | null>>;
}
