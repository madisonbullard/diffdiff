import type {
  GitHubCleanupPreferences,
  GitHubMergeMethod,
  GitHubRefCleanupCandidate,
} from "@diffdiff/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { BranchModal } from "../components/branch-modal.tsx";
import { CommandPaletteModal } from "../components/command-palette-modal.tsx";
import { HelpModal } from "../components/help-modal.tsx";
import { ListFilterModal } from "../components/list-filter-modal.tsx";
import { PullRequestCommentsModal } from "../review/comments-modal.tsx";
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
  filteredCommitItems: readonly CommitListItem[];
  filterIndex: number;
  isSubmittingReviewAction: boolean;
  leaderKeybind: string;
  mergeBodyScrollRef: React.MutableRefObject<ScrollBoxRenderable | null>;
  mergeCommitMessage: string;
  mergeCommitTitle: string;
  mergeMethod: GitHubMergeMethod | undefined;
  mergeModalField: "method" | "title" | "body";
  openPrCount: number;
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
  showBranchModal: boolean;
  showCleanupModal: boolean;
  showCommandModal: boolean;
  showCommentComposer: boolean;
  showCommentsModal: boolean;
  showHelp: boolean;
  showListFilterModal: boolean;
  showMergeModal: boolean;
  showSubmitReviewModal: boolean;
  theme: UiTheme;
}

export function DiffdiffAppDialogs({
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
  filteredCommitItems,
  filterIndex,
  isSubmittingReviewAction,
  leaderKeybind,
  mergeBodyScrollRef,
  mergeCommitMessage,
  mergeCommitTitle,
  mergeMethod,
  mergeModalField,
  openPrCount,
  remoteBranchCount,
  reviewComposerBody,
  reviewComposerContext,
  reviewSubmissionBody,
  reviewSubmissionEventIndex,
  selectedPullRequestConversationItemId,
  session,
  showBranchModal,
  showCleanupModal,
  showCommandModal,
  showCommentComposer,
  showCommentsModal,
  showHelp,
  showListFilterModal,
  showMergeModal,
  showSubmitReviewModal,
  theme,
}: DiffdiffAppDialogsProps) {
  return (
    <>
      {showBranchModal ? (
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
      ) : null}

      {showCommandModal ? (
        <CommandPaletteModal
          commands={filteredCommands}
          leaderKeybind={leaderKeybind}
          query={commandQuery}
          selectedIndex={commandIndex}
          theme={theme}
        />
      ) : null}

      {showBranchModal && showListFilterModal ? (
        <ListFilterModal filters={branchListFilters} selectedIndex={filterIndex} theme={theme} />
      ) : null}

      {showCommentComposer && reviewComposerContext != null ? (
        <ReviewComposerModal
          body={reviewComposerBody}
          context={reviewComposerContext}
          isSubmitting={isSubmittingReviewAction}
          theme={theme}
        />
      ) : null}

      {showCommentsModal && session.github != null ? (
        <PullRequestCommentsModal
          pullRequest={session.github.pullRequest}
          selectedItemId={selectedPullRequestConversationItemId}
          theme={theme}
        />
      ) : null}

      {showSubmitReviewModal ? (
        <SubmitReviewModal
          body={reviewSubmissionBody}
          eventIndex={reviewSubmissionEventIndex}
          isSubmitting={isSubmittingReviewAction}
          theme={theme}
        />
      ) : null}

      {showMergeModal && session.github != null ? (
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
      ) : null}

      {showCleanupModal ? (
        <PostMergeCleanupModal
          canApply={canApplyCleanup}
          candidates={cleanupCandidates}
          isSubmitting={isSubmittingReviewAction}
          selectedIndex={cleanupCandidateIndex}
          selection={cleanupSelection}
          theme={theme}
        />
      ) : null}

      {showHelp ? <HelpModal theme={theme} /> : null}
    </>
  );
}
