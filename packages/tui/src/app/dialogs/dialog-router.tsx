import type {
  GitHubDashboardPullRequest,
  GitHubCleanupPreferences,
  GitHubMergeMethod,
  GitHubRefCleanupCandidate,
  ReviewComposerHistoryEntry,
} from "@madisonbullard/diffdiff-core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { BranchModal } from "../../components/branch-modal.tsx";
import { CommandPaletteModal } from "../../components/command-palette-modal.tsx";
import { DiagnosticsModal } from "../../components/diagnostics-modal.tsx";
import { HelpModal } from "../../components/help-modal.tsx";
import { ListFilterModal } from "../../components/list-filter-modal.tsx";
import { PullRequestListModal } from "../../components/pull-request-list-modal.tsx";
import { ClearReviewedConfirmModal } from "../../review/clear-reviewed-confirm-modal.tsx";
import type { AppDialog } from "./stack.ts";
import { PullRequestCommentsModal } from "../../review/comments-modal.tsx";
import { MergeConfirmModal } from "../../review/merge-confirm-modal.tsx";
import { MergePullRequestModal } from "../../review/merge-pull-request-modal.tsx";
import { PostMergeCleanupModal } from "../../review/post-merge-cleanup-modal.tsx";
import { ReviewComposerModal } from "../../review/review-composer-modal.tsx";
import { SubmitReviewModal } from "../../review/submit-review-modal.tsx";
import type { CommandDefinition } from "../../commands.ts";
import type { AppCommand } from "../commands/registry.ts";
import type {
  AppPane,
  BranchListFilters,
  BranchListItem,
  CommitListItem,
  ListModalView,
  PreparedReviewSession,
} from "../../types.ts";
import type { UiTheme } from "../../theme.ts";

interface DiffdiffAppDialogsProps {
  activeDialog: AppDialog | null;
  activeListView: ListModalView;
  activePane: AppPane;
  branchItems: readonly BranchListItem[];
  branchListFilters: BranchListFilters;
  branchListIndex: number;
  canApplyCleanup: boolean;
  cleanupCandidateIndex: number;
  cleanupCandidates: readonly GitHubRefCleanupCandidate[];
  cleanupSelection: GitHubCleanupPreferences;
  commandBindingLabels: ReadonlyMap<string, string | undefined>;
  commandIndex: number;
  commandQuery: string;
  commandQueryCursorOffset: number;
  commitListIndex: number;
  commitSearchActive: boolean;
  commitSearchQuery: string;
  commitSearchCursorOffset: number;
  diagnosticErrorMessage: string | null;
  diagnosticEventIndex: number;
  diagnosticEvents: readonly import("../diagnostics/session-events.ts").SessionDiagnosticEvent[];
  diagnosticLogFilePath: string;
  draftPrCount: number;
  filteredCommands: readonly CommandDefinition[];
  helpCommands: readonly AppCommand[];
  filteredCommitItems: readonly CommitListItem[];
  filterIndex: number;
  isDiagnosticsLoading: boolean;
  isSubmittingReviewAction: boolean;
  mergeBodyScrollRef: React.MutableRefObject<ScrollBoxRenderable | null>;
  mergeCommitMessage: string;
  mergeCommitMessageCursorOffset: number;
  mergeCommitTitle: string;
  mergeCommitTitleCursorOffset: number;
  mergeConfirmOpen: boolean;
  mergeMethod: GitHubMergeMethod | undefined;
  mergeModalField: "method" | "title" | "body";
  openPrCount: number;
  pullRequestListIndex: number;
  pullRequestSearchActive: boolean;
  pullRequestSearchQuery: string;
  pullRequestSearchCursorOffset: number;
  reviewRequestedPrCount: number;
  reviewedCount: number;
  filteredPullRequests: readonly GitHubDashboardPullRequest[];
  isPullRequestListLoading: boolean;
  localBranchCount: number;
  remoteBranchCount: number;
  reviewComposerBody: string;
  reviewComposerCursorOffset: number;
  reviewComposerAutocomplete: import("../../review/composer-autocomplete.ts").ReviewComposerAutocompleteState;
  reviewComposerAutocompleteIndex: number;
  reviewComposerContext: {
    snippet: string;
    subtitle: string;
    title: string;
  } | null;
  reviewComposerHistoryEntries: readonly ReviewComposerHistoryEntry[];
  reviewSubmissionBody: string;
  reviewSubmissionCursorOffset: number;
  reviewSubmissionEventIndex: number;
  selectedPullRequestConversationItemId?: string;
  session: PreparedReviewSession;
  terminalWidth: number;
  theme: UiTheme;
}

export function DiffdiffAppDialogs({
  activeDialog,
  activeListView,
  activePane,
  branchItems,
  branchListFilters,
  branchListIndex,
  canApplyCleanup,
  cleanupCandidateIndex,
  cleanupCandidates,
  cleanupSelection,
  commandBindingLabels,
  commandIndex,
  commandQuery,
  commandQueryCursorOffset,
  commitListIndex,
  commitSearchActive,
  commitSearchQuery,
  commitSearchCursorOffset,
  diagnosticErrorMessage,
  diagnosticEventIndex,
  diagnosticEvents,
  diagnosticLogFilePath,
  draftPrCount,
  filteredCommands,
  helpCommands,
  filteredCommitItems,
  filterIndex,
  isDiagnosticsLoading,
  isSubmittingReviewAction,
  localBranchCount,
  mergeBodyScrollRef,
  mergeCommitMessage,
  mergeCommitMessageCursorOffset,
  mergeCommitTitle,
  mergeCommitTitleCursorOffset,
  mergeConfirmOpen,
  mergeMethod,
  mergeModalField,
  openPrCount,
  pullRequestListIndex,
  pullRequestSearchActive,
  pullRequestSearchQuery,
  pullRequestSearchCursorOffset,
  reviewRequestedPrCount,
  reviewedCount,
  filteredPullRequests,
  isPullRequestListLoading,
  remoteBranchCount,
  reviewComposerBody,
  reviewComposerCursorOffset,
  reviewComposerAutocomplete,
  reviewComposerAutocompleteIndex,
  reviewComposerContext,
  reviewComposerHistoryEntries,
  reviewSubmissionBody,
  reviewSubmissionCursorOffset,
  reviewSubmissionEventIndex,
  selectedPullRequestConversationItemId,
  session,
  terminalWidth,
  theme,
}: DiffdiffAppDialogsProps) {
  if (activeDialog === "branch") {
    return (
      <BranchModal
        activeView={activeListView}
        base={session.comparison.base}
        branchItems={branchItems}
        branchIndex={branchListIndex}
        commitItems={filteredCommitItems}
        commitIndex={commitListIndex}
        commitSearchQuery={commitSearchQuery}
        commitSearchCursorOffset={commitSearchCursorOffset}
        commitSearchActive={commitSearchActive}
        comparisonMode={session.comparison.mode}
        filters={branchListFilters}
        head={session.comparison.head}
        localBranchCount={localBranchCount}
        openPrCount={openPrCount}
        remoteBranchCount={remoteBranchCount}
        theme={theme}
      />
    );
  }

  if (activeDialog === "command-palette") {
    return (
      <CommandPaletteModal
        commands={filteredCommands}
        commandBindingLabels={commandBindingLabels}
        query={commandQuery}
        queryCursorOffset={commandQueryCursorOffset}
        selectedIndex={commandIndex}
        theme={theme}
      />
    );
  }

  if (activeDialog === "pull-request-list") {
    return (
      <PullRequestListModal
        draftPrCount={draftPrCount}
        isLoading={isPullRequestListLoading}
        pullRequests={filteredPullRequests}
        reviewRequestedCount={reviewRequestedPrCount}
        searchActive={pullRequestSearchActive}
        searchQuery={pullRequestSearchQuery}
        searchCursorOffset={pullRequestSearchCursorOffset}
        selectedIndex={pullRequestListIndex}
        theme={theme}
      />
    );
  }

  if (activeDialog === "clear-reviewed") {
    return <ClearReviewedConfirmModal reviewedCount={reviewedCount} theme={theme} />;
  }

  if (activeDialog === "list-filter") {
    return (
      <ListFilterModal filters={branchListFilters} selectedIndex={filterIndex} theme={theme} />
    );
  }

  if (activeDialog === "comment-composer" && reviewComposerContext != null) {
    return (
      <ReviewComposerModal
        autocomplete={reviewComposerAutocomplete}
        autocompleteIndex={reviewComposerAutocompleteIndex}
        body={reviewComposerBody}
        bodyCursorOffset={reviewComposerCursorOffset}
        context={reviewComposerContext}
        historyEntryCount={reviewComposerHistoryEntries.length}
        isSubmitting={isSubmittingReviewAction}
        theme={theme}
      />
    );
  }

  if (activeDialog === "comments" && session.github != null) {
    return (
      <PullRequestCommentsModal
        pullRequest={session.github.pullRequest}
        selectedItemId={selectedPullRequestConversationItemId}
        theme={theme}
      />
    );
  }

  if (activeDialog === "submit-review") {
    return (
      <SubmitReviewModal
        body={reviewSubmissionBody}
        bodyCursorOffset={reviewSubmissionCursorOffset}
        eventIndex={reviewSubmissionEventIndex}
        isSubmitting={isSubmittingReviewAction}
        theme={theme}
      />
    );
  }

  if (activeDialog === "merge" && session.github != null) {
    return (
      <>
        <MergePullRequestModal
          body={mergeCommitMessage}
          bodyCursorOffset={mergeCommitMessageCursorOffset}
          bodyScrollRef={mergeBodyScrollRef}
          canSubmit={session.github.pullRequest.merge.canMerge && mergeMethod != null}
          field={mergeModalField}
          isSubmitting={isSubmittingReviewAction}
          method={mergeMethod}
          pullRequest={session.github.pullRequest}
          theme={theme}
          title={mergeCommitTitle}
          titleCursorOffset={mergeCommitTitleCursorOffset}
        />
        {mergeConfirmOpen ? <MergeConfirmModal method={mergeMethod} theme={theme} /> : null}
      </>
    );
  }

  if (activeDialog === "cleanup") {
    return (
      <PostMergeCleanupModal
        canApply={canApplyCleanup}
        candidates={cleanupCandidates}
        isSubmitting={isSubmittingReviewAction}
        selectedIndex={cleanupCandidateIndex}
        selection={cleanupSelection}
        theme={theme}
      />
    );
  }

  if (activeDialog === "help") {
    return (
      <HelpModal
        activePane={activePane}
        commands={helpCommands}
        commandBindingLabels={commandBindingLabels}
        theme={theme}
      />
    );
  }

  if (activeDialog === "diagnostics") {
    return (
      <DiagnosticsModal
        errorMessage={diagnosticErrorMessage}
        events={diagnosticEvents}
        isLoading={isDiagnosticsLoading}
        logFilePath={diagnosticLogFilePath}
        selectedIndex={diagnosticEventIndex}
        terminalWidth={terminalWidth}
        theme={theme}
      />
    );
  }

  return null;
}
