import type {
  GitHubCleanupPreferences,
  GitHubDashboardPullRequest,
  GitHubMergeMethod,
  GitHubRefCleanupCandidate,
} from "@madisonbullard/diffdiff-core";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { MutableRefObject } from "react";
import type { TextInputSurface } from "../../text-input-surface.ts";
import type {
  AppPane,
  BranchListFilters,
  BranchListItem,
  CommitListItem,
  ListModalView,
  PreparedReviewSession,
} from "../../types.ts";
import type { AppCommand } from "../commands/registry.ts";
import type { CommandPaletteModels } from "../commands/command-palette-models.ts";
import type { SessionDiagnosticEvent } from "../diagnostics/session-events.ts";
import type { ReviewComposerModels } from "../review/review-composer-models.ts";

export interface BranchDialogModels {
  activeView: ListModalView;
  base: string;
  branchItems: readonly BranchListItem[];
  branchListFilters: BranchListFilters;
  branchListIndex: number;
  commitItems: readonly CommitListItem[];
  commitListIndex: number;
  commitSearchActive: boolean;
  commitSearchSurface: TextInputSurface;
  comparisonMode: PreparedReviewSession["comparison"]["mode"];
  head: string;
  localBranchCount: number;
  openPrCount: number;
  remoteBranchCount: number;
}

export interface PullRequestListDialogModels {
  draftPrCount: number;
  isLoading: boolean;
  pullRequestListIndex: number;
  pullRequestSearchActive: boolean;
  pullRequests: readonly GitHubDashboardPullRequest[];
  reviewRequestedPrCount: number;
  searchSurface: TextInputSurface;
}

export interface ReviewComposerDialogModels {
  autocompleteIndex: number;
  isSubmitting: boolean;
  models: ReviewComposerModels;
}

export interface ReviewSubmissionDialogModels {
  bodySurface: TextInputSurface;
  eventIndex: number;
  isSubmitting: boolean;
}

export interface MergeDialogModels {
  bodyScrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  bodySurface: TextInputSurface;
  field: "method" | "title" | "body";
  isSubmitting: boolean;
  method: GitHubMergeMethod | undefined;
  showConfirm: boolean;
  titleSurface: TextInputSurface;
}

export interface CleanupDialogModels {
  canApply: boolean;
  candidates: readonly GitHubRefCleanupCandidate[];
  isSubmitting: boolean;
  selectedIndex: number;
  selection: GitHubCleanupPreferences;
}

export interface HelpDialogModels {
  activePane: AppPane;
  commandBindingLabels: ReadonlyMap<string, string | undefined>;
  commands: readonly AppCommand[];
}

export interface DiagnosticsDialogModels {
  errorMessage: string | null;
  events: readonly SessionDiagnosticEvent[];
  isLoading: boolean;
  logFilePath: string;
  selectedIndex: number;
}

export interface DiffdiffDialogModels {
  branch: BranchDialogModels;
  cleanup: CleanupDialogModels;
  clearReviewed: { reviewedCount: number };
  commandPalette: CommandPaletteModels;
  diagnostics: DiagnosticsDialogModels;
  help: HelpDialogModels;
  listFilter: { filters: BranchListFilters; selectedIndex: number };
  merge: MergeDialogModels;
  pullRequestComments: { selectedItemId?: string };
  pullRequestList: PullRequestListDialogModels;
  reviewComposer: ReviewComposerDialogModels;
  reviewSubmission: ReviewSubmissionDialogModels;
}

export function createDiffdiffDialogModels({
  activeListView,
  activePane,
  branchItems,
  branchListFilters,
  branchListIndex,
  canApplyCleanup,
  cleanupCandidateIndex,
  cleanupCandidates,
  cleanupSelection,
  commandPalette,
  commitListIndex,
  commitSearchActive,
  commitSearchSurface,
  diagnosticErrorMessage,
  diagnosticEventIndex,
  diagnosticEvents,
  diagnosticLogFilePath,
  draftPrCount,
  filteredCommitItems,
  filteredPullRequests,
  filterIndex,
  helpCommands,
  isDiagnosticsLoading,
  isPullRequestListLoading,
  isSubmittingReviewAction,
  localBranchCount,
  mergeBodyScrollRef,
  mergeBodySurface,
  mergeConfirmOpen,
  mergeMethod,
  mergeModalField,
  mergeTitleSurface,
  openPrCount,
  pullRequestConversationItemId,
  pullRequestListIndex,
  pullRequestSearchActive,
  pullRequestSearchSurface,
  remoteBranchCount,
  reviewComposerAutocompleteIndex,
  reviewComposerModels,
  reviewedCount,
  reviewRequestedPrCount,
  reviewSubmissionEventIndex,
  reviewSubmissionSurface,
  session,
}: {
  activeListView: ListModalView;
  activePane: AppPane;
  branchItems: readonly BranchListItem[];
  branchListFilters: BranchListFilters;
  branchListIndex: number;
  canApplyCleanup: boolean;
  cleanupCandidateIndex: number;
  cleanupCandidates: readonly GitHubRefCleanupCandidate[];
  cleanupSelection: GitHubCleanupPreferences;
  commandPalette: CommandPaletteModels;
  commitListIndex: number;
  commitSearchActive: boolean;
  commitSearchSurface: TextInputSurface;
  diagnosticErrorMessage: string | null;
  diagnosticEventIndex: number;
  diagnosticEvents: readonly SessionDiagnosticEvent[];
  diagnosticLogFilePath: string;
  draftPrCount: number;
  filteredCommitItems: readonly CommitListItem[];
  filteredPullRequests: readonly GitHubDashboardPullRequest[];
  filterIndex: number;
  helpCommands: readonly AppCommand[];
  isDiagnosticsLoading: boolean;
  isPullRequestListLoading: boolean;
  isSubmittingReviewAction: boolean;
  localBranchCount: number;
  mergeBodyScrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  mergeBodySurface: TextInputSurface;
  mergeConfirmOpen: boolean;
  mergeMethod: GitHubMergeMethod | undefined;
  mergeModalField: "method" | "title" | "body";
  mergeTitleSurface: TextInputSurface;
  openPrCount: number;
  pullRequestConversationItemId?: string;
  pullRequestListIndex: number;
  pullRequestSearchActive: boolean;
  pullRequestSearchSurface: TextInputSurface;
  remoteBranchCount: number;
  reviewComposerAutocompleteIndex: number;
  reviewComposerModels: ReviewComposerModels;
  reviewedCount: number;
  reviewRequestedPrCount: number;
  reviewSubmissionEventIndex: number;
  reviewSubmissionSurface: TextInputSurface;
  session: PreparedReviewSession;
}): DiffdiffDialogModels {
  return {
    branch: {
      activeView: activeListView,
      base: session.comparison.base,
      branchItems,
      branchListFilters,
      branchListIndex,
      commitItems: filteredCommitItems,
      commitListIndex,
      commitSearchActive,
      commitSearchSurface,
      comparisonMode: session.comparison.mode,
      head: session.comparison.head,
      localBranchCount,
      openPrCount,
      remoteBranchCount,
    },
    cleanup: {
      canApply: canApplyCleanup,
      candidates: cleanupCandidates,
      isSubmitting: isSubmittingReviewAction,
      selectedIndex: cleanupCandidateIndex,
      selection: cleanupSelection,
    },
    clearReviewed: {
      reviewedCount,
    },
    commandPalette,
    diagnostics: {
      errorMessage: diagnosticErrorMessage,
      events: diagnosticEvents,
      isLoading: isDiagnosticsLoading,
      logFilePath: diagnosticLogFilePath,
      selectedIndex: diagnosticEventIndex,
    },
    help: {
      activePane,
      commandBindingLabels: commandPalette.commandBindingLabels,
      commands: helpCommands,
    },
    listFilter: {
      filters: branchListFilters,
      selectedIndex: filterIndex,
    },
    merge: {
      bodyScrollRef: mergeBodyScrollRef,
      bodySurface: mergeBodySurface,
      field: mergeModalField,
      isSubmitting: isSubmittingReviewAction,
      method: mergeMethod,
      showConfirm: mergeConfirmOpen,
      titleSurface: mergeTitleSurface,
    },
    pullRequestComments: {
      selectedItemId: pullRequestConversationItemId,
    },
    pullRequestList: {
      draftPrCount,
      isLoading: isPullRequestListLoading,
      pullRequestListIndex,
      pullRequestSearchActive,
      pullRequests: filteredPullRequests,
      reviewRequestedPrCount,
      searchSurface: pullRequestSearchSurface,
    },
    reviewComposer: {
      autocompleteIndex: reviewComposerAutocompleteIndex,
      isSubmitting: isSubmittingReviewAction,
      models: reviewComposerModels,
    },
    reviewSubmission: {
      bodySurface: reviewSubmissionSurface,
      eventIndex: reviewSubmissionEventIndex,
      isSubmitting: isSubmittingReviewAction,
    },
  };
}
