import type {
  GitHubDashboardPullRequest,
  GitHubCleanupPreferences,
  GitHubMergeMethod,
  GitHubRefCleanupCandidate,
} from "@diffdiff/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { BranchModal } from "../components/branch-modal.tsx";
import { CommandPaletteModal } from "../components/command-palette-modal.tsx";
import { HelpModal } from "../components/help-modal.tsx";
import { ListFilterModal } from "../components/list-filter-modal.tsx";
import { PullRequestListModal } from "../components/pull-request-list-modal.tsx";
import type { AppDialog } from "./dialog-stack.ts";
import { PullRequestCommentsModal } from "../review/comments-modal.tsx";
import { MergeConfirmModal } from "../review/merge-confirm-modal.tsx";
import { MergePullRequestModal } from "../review/merge-pull-request-modal.tsx";
import { PostMergeCleanupModal } from "../review/post-merge-cleanup-modal.tsx";
import { ReviewComposerModal } from "../review/review-composer-modal.tsx";
import { SubmitReviewModal } from "../review/submit-review-modal.tsx";
import type { CommandDefinition } from "../commands.ts";
import type {
  BranchListFilters,
  BranchListItem,
  CommitListItem,
  ListModalView,
  PreparedReviewSession,
} from "../types.ts";
import type { UiTheme } from "../theme.ts";

interface DiffdiffAppDialogsProps {
  activeDialog: AppDialog | null;
  activeListView: ListModalView;
  branchItems: readonly BranchListItem[];
  branchListFilters: BranchListFilters;
  branchListIndex: number;
  canApplyCleanup: boolean;
  cleanupCandidateIndex: number;
  cleanupCandidates: readonly GitHubRefCleanupCandidate[];
  cleanupSelection: GitHubCleanupPreferences;
  commandIndex: number;
  commandQuery: string;
  commitListIndex: number;
  commitSearchActive: boolean;
  commitSearchQuery: string;
  filteredCommands: readonly CommandDefinition[];
  helpCommands: readonly CommandDefinition[];
  filteredCommitItems: readonly CommitListItem[];
  filterIndex: number;
  isSubmittingReviewAction: boolean;
  leaderKeybind: string;
  mergeBodyScrollRef: React.MutableRefObject<ScrollBoxRenderable | null>;
  mergeCommitMessage: string;
  mergeCommitTitle: string;
  mergeConfirmOpen: boolean;
  mergeMethod: GitHubMergeMethod | undefined;
  mergeModalField: "method" | "title" | "body";
  openPrCount: number;
  pullRequestListIndex: number;
  pullRequestSearchActive: boolean;
  pullRequestSearchQuery: string;
  reviewRequestedPrCount: number;
  filteredPullRequests: readonly GitHubDashboardPullRequest[];
  isPullRequestListLoading: boolean;
  remoteBranchCount: number;
  reviewComposerBody: string;
  reviewComposerContext: {
    snippet: string;
    subtitle: string;
    title: string;
  } | null;
  reviewSubmissionBody: string;
  reviewSubmissionEventIndex: number;
  selectedPullRequestConversationItemId?: string;
  session: PreparedReviewSession;
  theme: UiTheme;
}

export function DiffdiffAppDialogs({
  activeDialog,
  activeListView,
  branchItems,
  branchListFilters,
  branchListIndex,
  canApplyCleanup,
  cleanupCandidateIndex,
  cleanupCandidates,
  cleanupSelection,
  commandIndex,
  commandQuery,
  commitListIndex,
  commitSearchActive,
  commitSearchQuery,
  filteredCommands,
  helpCommands,
  filteredCommitItems,
  filterIndex,
  isSubmittingReviewAction,
  leaderKeybind,
  mergeBodyScrollRef,
  mergeCommitMessage,
  mergeCommitTitle,
  mergeConfirmOpen,
  mergeMethod,
  mergeModalField,
  openPrCount,
  pullRequestListIndex,
  pullRequestSearchActive,
  pullRequestSearchQuery,
  reviewRequestedPrCount,
  filteredPullRequests,
  isPullRequestListLoading,
  remoteBranchCount,
  reviewComposerBody,
  reviewComposerContext,
  reviewSubmissionBody,
  reviewSubmissionEventIndex,
  selectedPullRequestConversationItemId,
  session,
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
        commitSearchActive={commitSearchActive}
        comparisonMode={session.comparison.mode}
        filters={branchListFilters}
        head={session.comparison.head}
        localBranchCount={session.branches.local.length}
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
        leaderKeybind={leaderKeybind}
        query={commandQuery}
        selectedIndex={commandIndex}
        theme={theme}
      />
    );
  }

  if (activeDialog === "pull-request-list") {
    return (
      <PullRequestListModal
        isLoading={isPullRequestListLoading}
        pullRequests={filteredPullRequests}
        reviewRequestedCount={reviewRequestedPrCount}
        searchActive={pullRequestSearchActive}
        searchQuery={pullRequestSearchQuery}
        selectedIndex={pullRequestListIndex}
        theme={theme}
      />
    );
  }

  if (activeDialog === "list-filter") {
    return (
      <ListFilterModal filters={branchListFilters} selectedIndex={filterIndex} theme={theme} />
    );
  }

  if (activeDialog === "comment-composer" && reviewComposerContext != null) {
    return (
      <ReviewComposerModal
        body={reviewComposerBody}
        context={reviewComposerContext}
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
          bodyScrollRef={mergeBodyScrollRef}
          canSubmit={session.github.pullRequest.merge.canMerge && mergeMethod != null}
          field={mergeModalField}
          isSubmitting={isSubmittingReviewAction}
          method={mergeMethod}
          pullRequest={session.github.pullRequest}
          theme={theme}
          title={mergeCommitTitle}
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
    return <HelpModal commands={helpCommands} leaderKeybind={leaderKeybind} theme={theme} />;
  }

  return null;
}
