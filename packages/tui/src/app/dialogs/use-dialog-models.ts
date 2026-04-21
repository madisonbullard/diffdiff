import { useMemo } from "react";
import type { AppCommand } from "../commands/registry.ts";
import type { CommandPaletteModels } from "../commands/command-palette-models.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { DiffdiffAppDerived } from "../shell/use-app-models.ts";
import type { AppInputSurfaces } from "../input/app-input-surfaces.ts";
import type { ReviewComposerModels } from "../review/review-composer-models.ts";
import type { SessionDiagnosticEvent } from "../diagnostics/session-events.ts";
import { createDiffdiffDialogModels, type DiffdiffDialogModels } from "./dialog-models.ts";

interface SessionDiagnostics {
  diagnosticErrorMessage: string | null;
  diagnosticEventIndex: number;
  diagnosticEvents: readonly SessionDiagnosticEvent[];
  isDiagnosticsLoading: boolean;
}

export function useDiffdiffDialogModels({
  canApplyCleanup,
  commandPalette,
  commands,
  derived,
  diagnostics,
  inputSurfaces,
  logFilePath,
  reviewComposerModels,
  state,
}: {
  canApplyCleanup: boolean;
  commandPalette: CommandPaletteModels;
  commands: readonly AppCommand[];
  derived: DiffdiffAppDerived;
  diagnostics: SessionDiagnostics;
  inputSurfaces: AppInputSurfaces;
  logFilePath: string;
  reviewComposerModels: ReviewComposerModels;
  state: DiffdiffAppState;
}): DiffdiffDialogModels {
  return useMemo(
    () =>
      createDiffdiffDialogModels({
        activeListView: state.activeListView,
        activePane: state.activePane,
        branchItems: derived.branchItems,
        branchListFilters: state.branchListFilters,
        branchListIndex: state.branchListIndex,
        canApplyCleanup,
        cleanupCandidateIndex: state.cleanupCandidateIndex,
        cleanupCandidates: state.cleanupCandidates,
        cleanupSelection: state.cleanupSelection,
        commandPalette,
        commitListIndex: state.commitListIndex,
        commitSearchActive: state.commitSearchActive,
        commitSearchSurface: inputSurfaces.commitSearch,
        diagnosticErrorMessage: diagnostics.diagnosticErrorMessage,
        diagnosticEventIndex: diagnostics.diagnosticEventIndex,
        diagnosticEvents: diagnostics.diagnosticEvents,
        diagnosticLogFilePath: logFilePath,
        draftPrCount: derived.draftPrCount,
        filteredCommitItems: derived.filteredCommitItems,
        filteredPullRequests: derived.filteredPullRequests,
        filterIndex: state.filterIndex,
        helpCommands: commands,
        isDiagnosticsLoading: diagnostics.isDiagnosticsLoading,
        isPullRequestListLoading: state.isPullRequestListLoading,
        isSubmittingReviewAction: state.isSubmittingReviewAction,
        localBranchCount: derived.localBranchCount,
        mergeBodyScrollRef: state.mergeBodyScrollRef,
        mergeBodySurface: inputSurfaces.mergeBody,
        mergeConfirmOpen: derived.showMergeConfirmModal,
        mergeMethod: state.mergeMethod,
        mergeModalField: state.mergeModalField,
        mergeTitleSurface: inputSurfaces.mergeTitle,
        openPrCount: derived.openPrCount,
        pullRequestConversationItemId:
          derived.selectedPullRequestConversationItem?.id == null
            ? undefined
            : String(derived.selectedPullRequestConversationItem.id),
        pullRequestListIndex: state.pullRequestListIndex,
        pullRequestSearchActive: state.pullRequestSearchActive,
        pullRequestSearchSurface: inputSurfaces.pullRequestSearch,
        remoteBranchCount: derived.remoteBranchCount,
        reviewComposerAutocompleteIndex: state.reviewComposer.autocompleteIndex,
        reviewComposerModels,
        reviewedCount: state.reviewedPaths.size,
        reviewRequestedPrCount: derived.reviewRequestedPrCount,
        reviewSubmissionEventIndex: state.reviewSubmissionEventIndex,
        reviewSubmissionSurface: inputSurfaces.reviewSubmission,
        session: derived.displaySession,
      }),
    [
      canApplyCleanup,
      commandPalette,
      commands,
      derived,
      diagnostics.diagnosticErrorMessage,
      diagnostics.diagnosticEventIndex,
      diagnostics.diagnosticEvents,
      diagnostics.isDiagnosticsLoading,
      inputSurfaces,
      logFilePath,
      reviewComposerModels,
      state.activeListView,
      state.activePane,
      state.branchListFilters,
      state.branchListIndex,
      state.cleanupCandidateIndex,
      state.cleanupCandidates,
      state.cleanupSelection,
      state.commitListIndex,
      state.commitSearchActive,
      state.filterIndex,
      state.isPullRequestListLoading,
      state.isSubmittingReviewAction,
      state.mergeBodyScrollRef,
      state.mergeMethod,
      state.mergeModalField,
      state.pullRequestListIndex,
      state.pullRequestSearchActive,
      state.reviewSubmissionEventIndex,
      state.reviewedPaths.size,
      state.reviewComposer.autocompleteIndex,
    ],
  );
}
