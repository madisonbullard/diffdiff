import { BranchModal } from "../../components/branch-modal.tsx";
import { CommandPaletteModal } from "../../components/command-palette-modal.tsx";
import { DiagnosticsModal } from "../../components/diagnostics-modal.tsx";
import { HelpModal } from "../../components/help-modal.tsx";
import { ListFilterModal } from "../../components/list-filter-modal.tsx";
import { PullRequestListModal } from "../../components/pull-request-list-modal.tsx";
import type { UiTheme } from "../../theme.ts";
import type { PreparedReviewSession } from "../../types.ts";
import { ClearReviewedConfirmModal } from "../../review/clear-reviewed-confirm-modal.tsx";
import { PullRequestCommentsModal } from "../../review/comments-modal.tsx";
import { MergeConfirmModal } from "../../review/merge-confirm-modal.tsx";
import { MergePullRequestModal } from "../../review/merge-pull-request-modal.tsx";
import { PostMergeCleanupModal } from "../../review/post-merge-cleanup-modal.tsx";
import { ReviewComposerModal } from "../../review/review-composer-modal.tsx";
import { SubmitReviewModal } from "../../review/submit-review-modal.tsx";
import type { DiffdiffDialogModels } from "./dialog-models.ts";
import type { AppDialog } from "./stack.ts";

interface DiffdiffAppDialogsProps {
  activeDialog: AppDialog | null;
  models: DiffdiffDialogModels;
  session: PreparedReviewSession;
  terminalWidth: number;
  theme: UiTheme;
}

export function DiffdiffAppDialogs({
  activeDialog,
  models,
  session,
  terminalWidth,
  theme,
}: DiffdiffAppDialogsProps) {
  if (activeDialog === "branch") {
    return (
      <BranchModal
        activeView={models.branch.activeView}
        base={models.branch.base}
        branchItems={models.branch.branchItems}
        branchIndex={models.branch.branchListIndex}
        commitItems={models.branch.commitItems}
        commitIndex={models.branch.commitListIndex}
        commitSearchActive={models.branch.commitSearchActive}
        commitSearchSurface={models.branch.commitSearchSurface}
        comparisonMode={models.branch.comparisonMode}
        filters={models.branch.branchListFilters}
        head={models.branch.head}
        localBranchCount={models.branch.localBranchCount}
        openPrCount={models.branch.openPrCount}
        remoteBranchCount={models.branch.remoteBranchCount}
        theme={theme}
      />
    );
  }

  if (activeDialog === "command-palette") {
    return (
      <CommandPaletteModal
        commands={models.commandPalette.filteredCommands}
        commandBindingLabels={models.commandPalette.commandBindingLabels}
        querySurface={models.commandPalette.inputSurface}
        selectedIndex={models.commandPalette.selectedIndex}
        theme={theme}
      />
    );
  }

  if (activeDialog === "pull-request-list") {
    return (
      <PullRequestListModal
        draftPrCount={models.pullRequestList.draftPrCount}
        isLoading={models.pullRequestList.isLoading}
        pullRequests={models.pullRequestList.pullRequests}
        reviewRequestedCount={models.pullRequestList.reviewRequestedPrCount}
        searchActive={models.pullRequestList.pullRequestSearchActive}
        searchSurface={models.pullRequestList.searchSurface}
        selectedIndex={models.pullRequestList.pullRequestListIndex}
        theme={theme}
      />
    );
  }

  if (activeDialog === "clear-reviewed") {
    return (
      <ClearReviewedConfirmModal reviewedCount={models.clearReviewed.reviewedCount} theme={theme} />
    );
  }

  if (activeDialog === "list-filter") {
    return (
      <ListFilterModal
        filters={models.listFilter.filters}
        selectedIndex={models.listFilter.selectedIndex}
        theme={theme}
      />
    );
  }

  if (activeDialog === "comment-composer" && models.reviewComposer.models.context != null) {
    return (
      <ReviewComposerModal
        autocomplete={models.reviewComposer.models.autocomplete}
        autocompleteIndex={models.reviewComposer.autocompleteIndex}
        bodySurface={models.reviewComposer.models.inputSurface}
        context={models.reviewComposer.models.context}
        historyEntryCount={models.reviewComposer.models.historyEntries.length}
        isSubmitting={models.reviewComposer.isSubmitting}
        theme={theme}
      />
    );
  }

  if (activeDialog === "comments" && session.github != null) {
    return (
      <PullRequestCommentsModal
        pullRequest={session.github.pullRequest}
        selectedItemId={models.pullRequestComments.selectedItemId}
        theme={theme}
      />
    );
  }

  if (activeDialog === "submit-review") {
    return (
      <SubmitReviewModal
        bodySurface={models.reviewSubmission.bodySurface}
        eventIndex={models.reviewSubmission.eventIndex}
        isSubmitting={models.reviewSubmission.isSubmitting}
        theme={theme}
      />
    );
  }

  if (activeDialog === "merge" && session.github != null) {
    return (
      <>
        <MergePullRequestModal
          bodySurface={models.merge.bodySurface}
          bodyScrollRef={models.merge.bodyScrollRef}
          canSubmit={session.github.pullRequest.merge.canMerge && models.merge.method != null}
          field={models.merge.field}
          isSubmitting={models.merge.isSubmitting}
          method={models.merge.method}
          pullRequest={session.github.pullRequest}
          theme={theme}
          titleSurface={models.merge.titleSurface}
        />
        {models.merge.showConfirm ? (
          <MergeConfirmModal method={models.merge.method} theme={theme} />
        ) : null}
      </>
    );
  }

  if (activeDialog === "cleanup") {
    return (
      <PostMergeCleanupModal
        canApply={models.cleanup.canApply}
        candidates={models.cleanup.candidates}
        isSubmitting={models.cleanup.isSubmitting}
        selectedIndex={models.cleanup.selectedIndex}
        selection={models.cleanup.selection}
        theme={theme}
      />
    );
  }

  if (activeDialog === "help") {
    return (
      <HelpModal
        activePane={models.help.activePane}
        commands={models.help.commands}
        commandBindingLabels={models.help.commandBindingLabels}
        theme={theme}
      />
    );
  }

  if (activeDialog === "diagnostics") {
    return (
      <DiagnosticsModal
        errorMessage={models.diagnostics.errorMessage}
        events={models.diagnostics.events}
        isLoading={models.diagnostics.isLoading}
        logFilePath={models.diagnostics.logFilePath}
        selectedIndex={models.diagnostics.selectedIndex}
        terminalWidth={terminalWidth}
        theme={theme}
      />
    );
  }

  return null;
}
