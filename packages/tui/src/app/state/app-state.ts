import type {
  GitHubDashboardPullRequest,
  GitHubMergeMethod,
  GitHubRefCleanupCandidate,
  GitHubUserPreferences,
} from "@diffdiff/core";
import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { useRenderer, useTerminalDimensions } from "@opentui/react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AppDialogStackEntry } from "../dialogs/stack.ts";
import { createKeybindController } from "../keybind-controller.ts";
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
import type { ReviewComposerTarget } from "../review/review-composer.ts";

export interface ComparisonBrowserData {
  branches: PreparedReviewSession["branches"];
  commits: PreparedReviewSession["commits"];
  workingTreeSummary: PreparedReviewSession["workingTreeSummary"];
}

export interface DiffdiffAppState {
  activeFileIndex: number;
  activeOverlay: import("../dialogs/stack.ts").AppDialog | null;
  activePane: AppPane;
  activeListView: ListModalView;
  baseBranchLoadingMessage: string | null;
  branchListFilters: BranchListFilters;
  branchListIndex: number;
  cleanupCandidateIndex: number;
  cleanupCandidates: GitHubRefCleanupCandidate[];
  cleanupSelection: import("@diffdiff/core").GitHubCleanupPreferences;
  collapsedDirectories: Set<string>;
  collapsedPaths: Set<string>;
  commentCollapseStates: Record<string, boolean>;
  comparisonBrowserData: ComparisonBrowserData;
  commandIndex: number;
  commandQuery: string;
  commitListIndex: number;
  commitSearchActive: boolean;
  commitSearchQuery: string;
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
  latestSessionLoadIdRef: MutableRefObject<number>;
  leaderActive: boolean;
  loadingIndicatorFrame: number;
  modalPickerActive: boolean;
  mergeCommitMessage: string;
  mergeCommitTitle: string;
  mergeConfirmOpen: boolean;
  mergeMethod: GitHubMergeMethod | undefined;
  mergeModalField: MergeModalField;
  pendingInteractionRef: MutableRefObject<PendingInteraction | null>;
  pendingInteractionTokenRef: MutableRefObject<number>;
  pendingReviewCacheRef: MutableRefObject<{
    key: import("@diffdiff/core").ReviewCacheKey;
    state: import("@diffdiff/core").ReviewCacheState;
  } | null>;
  pendingSelectedFileScrollOffsetRef: MutableRefObject<number | null>;
  pendingSessionActivityRef: MutableRefObject<SessionActivityUpdate | null>;
  pendingSyntaxHydrationPathsRef: MutableRefObject<Set<string>>;
  pullRequestConversationIndex: number;
  pullRequestList: GitHubDashboardPullRequest[];
  pullRequestListIndex: number;
  pullRequestListLoadIdRef: MutableRefObject<number>;
  pullRequestSearchActive: boolean;
  pullRequestSearchQuery: string;
  refreshIndicatorLabel: string | null;
  renderer: ReturnType<typeof useRenderer>;
  reviewCacheTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  reviewedPaths: Set<string>;
  reviewComposerBody: string;
  reviewComposerTarget: ReviewComposerTarget | null;
  reviewSubmissionBody: string;
  reviewSubmissionEventIndex: number;
  selectedFileIndex: number;
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
  setActiveFileIndex: Dispatch<SetStateAction<number>>;
  setActivePane: Dispatch<SetStateAction<AppPane>>;
  setActiveListView: Dispatch<SetStateAction<ListModalView>>;
  setBaseBranchLoadingMessage: Dispatch<SetStateAction<string | null>>;
  setBranchListFilters: Dispatch<SetStateAction<BranchListFilters>>;
  setBranchListIndex: Dispatch<SetStateAction<number>>;
  setCleanupCandidateIndex: Dispatch<SetStateAction<number>>;
  setCleanupCandidates: Dispatch<SetStateAction<GitHubRefCleanupCandidate[]>>;
  setCleanupSelection: Dispatch<SetStateAction<import("@diffdiff/core").GitHubCleanupPreferences>>;
  setCollapsedDirectories: Dispatch<SetStateAction<Set<string>>>;
  setCollapsedPaths: Dispatch<SetStateAction<Set<string>>>;
  setCommentCollapseStates: Dispatch<SetStateAction<Record<string, boolean>>>;
  setComparisonBrowserData: Dispatch<SetStateAction<ComparisonBrowserData>>;
  setCommandIndex: Dispatch<SetStateAction<number>>;
  setCommandQuery: Dispatch<SetStateAction<string>>;
  setCommitListIndex: Dispatch<SetStateAction<number>>;
  setCommitSearchActive: Dispatch<SetStateAction<boolean>>;
  setCommitSearchQuery: Dispatch<SetStateAction<string>>;
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
  setLeaderActive: Dispatch<SetStateAction<boolean>>;
  setLoadingIndicatorFrame: Dispatch<SetStateAction<number>>;
  setModalPickerActive: Dispatch<SetStateAction<boolean>>;
  setMergeCommitMessage: Dispatch<SetStateAction<string>>;
  setMergeCommitTitle: Dispatch<SetStateAction<string>>;
  setMergeConfirmOpen: Dispatch<SetStateAction<boolean>>;
  setMergeMethod: Dispatch<SetStateAction<GitHubMergeMethod | undefined>>;
  setMergeModalField: Dispatch<SetStateAction<MergeModalField>>;
  setPullRequestConversationIndex: Dispatch<SetStateAction<number>>;
  setPullRequestList: Dispatch<SetStateAction<GitHubDashboardPullRequest[]>>;
  setPullRequestListIndex: Dispatch<SetStateAction<number>>;
  setPullRequestSearchActive: Dispatch<SetStateAction<boolean>>;
  setPullRequestSearchQuery: Dispatch<SetStateAction<string>>;
  setRefreshIndicatorLabel: Dispatch<SetStateAction<string | null>>;
  setReviewedPaths: Dispatch<SetStateAction<Set<string>>>;
  setReviewComposerBody: Dispatch<SetStateAction<string>>;
  setReviewComposerTarget: Dispatch<SetStateAction<ReviewComposerTarget | null>>;
  setReviewSubmissionBody: Dispatch<SetStateAction<string>>;
  setReviewSubmissionEventIndex: Dispatch<SetStateAction<number>>;
  setSelectedFileIndex: Dispatch<SetStateAction<number>>;
  setSelectedReviewAnchorIndex: Dispatch<SetStateAction<number>>;
  setSelectedReviewCommentIndexByThreadId: Dispatch<SetStateAction<Record<string, number>>>;
  setSelectedReviewThreadIndexByFilePath: Dispatch<SetStateAction<Record<string, number>>>;
  setSelectedTreePath: Dispatch<SetStateAction<string>>;
  setSession: Dispatch<SetStateAction<PreparedReviewSession>>;
  setStartupOptions: Dispatch<SetStateAction<LaunchOptions>>;
  setStatusMessage: Dispatch<SetStateAction<string>>;
  setToastMessage: Dispatch<SetStateAction<string | null>>;
}
