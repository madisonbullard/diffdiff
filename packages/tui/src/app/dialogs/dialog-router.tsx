import { BranchModal } from "../../components/branch-modal.tsx";
import { CommandPaletteModal } from "../../components/command-palette-modal.tsx";
import { DiagnosticsModal } from "../../components/diagnostics-modal.tsx";
import { KeysTab } from "../../components/keys-tab.tsx";
import { PullRequestListModal } from "../../components/pull-request-list-modal.tsx";
import type { UiTheme } from "../../theme.ts";
import type { PreparedReviewSession } from "../../types.ts";
import { ClearReviewedConfirmModal } from "../../review/clear-reviewed-confirm-modal.tsx";
import { PullRequestCommentsModal } from "../../review/comments-modal.tsx";
import { PullRequestChecksModal } from "../../review/checks-modal.tsx";
import { MergePullRequestModal } from "../../review/merge-pull-request-modal.tsx";
import { ReviewComposerModal } from "../../review/review-composer-modal.tsx";
import { SubmitReviewModal } from "../../review/submit-review-modal.tsx";
import { ReviewerPickerModal } from "../../review/reviewer-picker-modal.tsx";
import type { DiffdiffDialogModels } from "./dialog-models.ts";
import type { AppDialog } from "./stack.ts";
import { accessibleDialogTheme } from "../../components/dialog/tokens.ts";
import { useMemo } from "react";
import { canSubmitMerge } from "../../review/merge-eligibility.ts";

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
  theme: inputTheme,
}: DiffdiffAppDialogsProps) {
  const theme = useMemo(() => accessibleDialogTheme(inputTheme), [inputTheme]);
  if (activeDialog === "branch" || activeDialog === "list-filter") {
    return (
      <BranchModal
        facetsActive={activeDialog === "list-filter"}
        facetIndex={models.listFilter.selectedIndex}
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

  if (activeDialog === "reviewer-picker" && session.github != null) {
    return (
      <ReviewerPickerModal
        picker={models.reviewerPicker}
        requests={session.github.pullRequest.reviewRequests}
        theme={theme}
      />
    );
  }

  if (activeDialog === "clear-reviewed") {
    return (
      <ClearReviewedConfirmModal reviewedCount={models.clearReviewed.reviewedCount} theme={theme} />
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

  if (activeDialog === "checks" && session.github != null && models.checks != null) {
    return (
      <PullRequestChecksModal
        pullRequest={session.github.pullRequest}
        theme={theme}
        {...models.checks}
      />
    );
  }

  if (activeDialog === "submit-review") {
    return (
      <SubmitReviewModal
        field={models.reviewSubmission.field}
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
          confirming={models.merge.showConfirm}
          cleanupAfterMerge={models.merge.cleanupAfterMerge}
          autoMerge={models.merge.autoMerge}
          bodySurface={models.merge.bodySurface}
          bodyScrollRef={models.merge.bodyScrollRef}
          canSubmit={canSubmitMerge(
            session.github.pullRequest,
            models.merge.method,
            models.merge.autoMerge,
          )}
          field={models.merge.field}
          isSubmitting={models.merge.isSubmitting}
          method={models.merge.method}
          pullRequest={session.github.pullRequest}
          theme={theme}
          titleSurface={models.merge.titleSurface}
        />
      </>
    );
  }

  if (activeDialog === "help") {
    return (
      <KeysTab
        query={models.commandPalette.inputSurface}
        index={models.commandPalette.selectedIndex}
        leaderOnly={models.help.leaderOnly}
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
