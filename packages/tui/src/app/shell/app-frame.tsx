import type {
  GitHubCleanupPreferences,
  GitHubDashboardPullRequest,
  GitHubMergeMethod,
  GitHubPullRequestComment,
  GitHubRefCleanupCandidate,
  ReviewComposerHistoryEntry,
} from "@diffdiff/core";
import type { BoxRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import type { MutableRefObject } from "react";
import type { FileCardPreviewViewport } from "../../components/file-card.tsx";
import { PrefixPickerOverlay } from "../../components/prefix-picker-overlay.tsx";
import type { SessionDiagnosticEvent } from "../diagnostics/session-events.ts";
import type { AppCommand } from "../commands/registry.ts";
import type { PrefixMenuCommand, PrefixMenuConfig } from "../commands/prefix-menus.ts";
import { DiffdiffAppDialogs } from "../dialogs/dialog-router.tsx";
import { AppDiffPane } from "./app-diff-pane.tsx";
import { AppFooter } from "./app-footer.tsx";
import { AppHeader } from "./app-header.tsx";
import { AppSidebar } from "./app-sidebar.tsx";
import type {
  AppPane,
  BranchListFilters,
  BranchListItem,
  CommitListItem,
  FileTreeNode,
  ListModalView,
  PreparedReviewSession,
} from "../../types.ts";
import type { UiTheme } from "../../theme.ts";

interface DiffdiffAppViewProps {
  activeFileIndex: number;
  activeListView: ListModalView;
  activeOverlay: import("../dialogs/stack.ts").AppDialog | null;
  activePane: AppPane;
  baseBranchLoadingMessage: string | null;
  branchItems: readonly BranchListItem[];
  branchListFilters: BranchListFilters;
  branchListIndex: number;
  canApplyCleanup: boolean;
  cleanupCandidateIndex: number;
  cleanupCandidates: readonly GitHubRefCleanupCandidate[];
  cleanupSelection: GitHubCleanupPreferences;
  collapsedCommentStates: Record<string, boolean>;
  collapsedDirectories: ReadonlySet<string>;
  collapsedPaths: ReadonlySet<string>;
  commandBindingLabels: ReadonlyMap<string, string | undefined>;
  commandIndex: number;
  commandQuery: string;
  commandQueryCursorOffset: number;
  commitListIndex: number;
  commitSearchActive: boolean;
  commitSearchQuery: string;
  commitSearchCursorOffset: number;
  currentBranchLabel: string;
  diagnosticErrorMessage: string | null;
  diagnosticEventIndex: number;
  diagnosticEvents: readonly SessionDiagnosticEvent[];
  diagnosticLogFilePath: string;
  diffPaneWidth: number;
  diffView: "unified" | "split";
  draftPrCount: number;
  estimatedFileCardBodyHeights: readonly number[];
  fileCardBodyVisibility: readonly boolean[];
  fileCardPreviewViewports: readonly (FileCardPreviewViewport | undefined)[];
  fileCardRootRefs: readonly ((node: BoxRenderable | null) => void)[];
  filteredCommands: readonly AppCommand[];
  filteredCommitItems: readonly CommitListItem[];
  filteredPullRequests: readonly GitHubDashboardPullRequest[];
  filterIndex: number;
  footerEvent: { color: string; message: string };
  footerEventMessage: string;
  footerModeBadge: { bg: string; fg: string; label: string };
  handleFileTreeMouseUp: (node: FileTreeNode) => void;
  helpCommands: readonly AppCommand[];
  helpLabel: string;
  isDiagnosticsLoading: boolean;
  isPullRequestListLoading: boolean;
  isSubmittingReviewAction: boolean;
  localBranchCount: number;
  mergeBodyScrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  mergeCommitMessage: string;
  mergeCommitMessageCursorOffset: number;
  mergeCommitTitle: string;
  mergeCommitTitleCursorOffset: number;
  mergeMethod: GitHubMergeMethod | undefined;
  mergeModalField: "method" | "title" | "body";
  activePrefixMenu?: PrefixMenuConfig;
  activePrefixMenuCommands: readonly PrefixMenuCommand[];
  onMouseUp: () => void;
  openPrCount: number;
  pullRequestConversationItemId?: string;
  pullRequestListIndex: number;
  pullRequestSearchActive: boolean;
  pullRequestSearchQuery: string;
  pullRequestSearchCursorOffset: number;
  refreshIndicatorLabel: string | null;
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
  reviewedPaths: ReadonlySet<string>;
  reviewedCount: number;
  reviewRequestedPrCount: number;
  reviewSubmissionBody: string;
  reviewSubmissionCursorOffset: number;
  reviewSubmissionEventIndex: number;
  reviewThreadsByPath: ReadonlyMap<
    string,
    readonly import("@diffdiff/core").GitHubPullRequestReviewThread[]
  >;
  scrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  selectedFileIndex: number;
  selectedDiffRowRef: MutableRefObject<BoxRenderable | null>;
  showSelectedReviewAnchor: boolean;
  selectedReviewAnchor?: import("../../review-anchors.ts").SelectedReviewAnchor;
  selectedReviewComment?: GitHubPullRequestComment;
  selectedReviewThread?: import("@diffdiff/core").GitHubPullRequestReviewThread;
  selectedTreePath: string;
  session: PreparedReviewSession;
  showFooterLoadingIndicator: boolean;
  showMergeConfirmModal: boolean;
  sidebarWidth: number;
  stickyFile?: PreparedReviewSession["files"][number];
  syntaxStyle: SyntaxStyle;
  terminalWidth: number;
  theme: UiTheme;
  toggleReviewThreadCollapsed: (
    thread: import("@diffdiff/core").GitHubPullRequestReviewThread,
  ) => void;
  treeRowRefCallbacks: readonly ((node: BoxRenderable | null) => void)[];
  treeScrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  treeSummaryLabels: {
    diffAdditions: string;
    diffDeletions: string;
    diffSeparator: string;
    reviewed: string;
  };
  visibleTreeNodes: readonly FileTreeNode[];
}

export function DiffdiffAppView({
  activeFileIndex,
  activeListView,
  activeOverlay,
  activePane,
  branchItems,
  branchListFilters,
  branchListIndex,
  canApplyCleanup,
  cleanupCandidateIndex,
  cleanupCandidates,
  cleanupSelection,
  collapsedCommentStates,
  collapsedDirectories,
  collapsedPaths,
  commandBindingLabels,
  commandIndex,
  commandQuery,
  commandQueryCursorOffset,
  commitListIndex,
  commitSearchActive,
  commitSearchQuery,
  commitSearchCursorOffset,
  currentBranchLabel,
  diagnosticErrorMessage,
  diagnosticEventIndex,
  diagnosticEvents,
  diagnosticLogFilePath,
  diffPaneWidth,
  diffView,
  draftPrCount,
  estimatedFileCardBodyHeights,
  fileCardBodyVisibility,
  fileCardPreviewViewports,
  fileCardRootRefs,
  filteredCommands,
  filteredCommitItems,
  filteredPullRequests,
  filterIndex,
  footerEvent,
  footerEventMessage,
  footerModeBadge,
  handleFileTreeMouseUp,
  helpCommands,
  helpLabel,
  isDiagnosticsLoading,
  isPullRequestListLoading,
  isSubmittingReviewAction,
  localBranchCount,
  mergeBodyScrollRef,
  mergeCommitMessage,
  mergeCommitMessageCursorOffset,
  mergeCommitTitle,
  mergeCommitTitleCursorOffset,
  mergeMethod,
  mergeModalField,
  activePrefixMenu,
  activePrefixMenuCommands,
  onMouseUp,
  openPrCount,
  pullRequestConversationItemId,
  pullRequestListIndex,
  pullRequestSearchActive,
  pullRequestSearchQuery,
  pullRequestSearchCursorOffset,
  refreshIndicatorLabel,
  remoteBranchCount,
  reviewComposerBody,
  reviewComposerCursorOffset,
  reviewComposerAutocomplete,
  reviewComposerAutocompleteIndex,
  reviewComposerContext,
  reviewComposerHistoryEntries,
  reviewedPaths,
  reviewedCount,
  reviewRequestedPrCount,
  reviewSubmissionBody,
  reviewSubmissionCursorOffset,
  reviewSubmissionEventIndex,
  reviewThreadsByPath,
  scrollRef,
  selectedFileIndex,
  selectedDiffRowRef,
  showSelectedReviewAnchor,
  selectedReviewAnchor,
  selectedReviewComment,
  selectedReviewThread,
  selectedTreePath,
  session,
  showFooterLoadingIndicator,
  showMergeConfirmModal,
  sidebarWidth,
  stickyFile,
  syntaxStyle,
  terminalWidth,
  theme,
  toggleReviewThreadCollapsed,
  treeRowRefCallbacks,
  treeScrollRef,
  treeSummaryLabels,
  visibleTreeNodes,
}: DiffdiffAppViewProps) {
  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.appBackground}
      onMouseUp={onMouseUp}
    >
      <AppHeader
        currentBranchLabel={currentBranchLabel}
        refreshIndicatorLabel={refreshIndicatorLabel}
        session={session}
        theme={theme}
      />

      <box width="100%" flexGrow={1}>
        <box width="100%" height="100%" flexDirection="row">
          <AppSidebar
            activeOverlay={activeOverlay}
            activePane={activePane}
            collapsedDirectories={collapsedDirectories}
            collapsedPaths={collapsedPaths}
            handleFileTreeMouseUp={handleFileTreeMouseUp}
            reviewedPaths={reviewedPaths}
            selectedFileIndex={selectedFileIndex}
            selectedTreePath={selectedTreePath}
            session={session}
            sidebarWidth={sidebarWidth}
            theme={theme}
            treeRowRefCallbacks={treeRowRefCallbacks}
            treeScrollRef={treeScrollRef}
            treeSummaryLabels={treeSummaryLabels}
            visibleTreeNodes={visibleTreeNodes}
          />

          <AppDiffPane
            activeFileIndex={activeFileIndex}
            activeOverlay={activeOverlay}
            activePane={activePane}
            collapsedCommentStates={collapsedCommentStates}
            collapsedPaths={collapsedPaths}
            diffPaneWidth={diffPaneWidth}
            diffView={diffView}
            estimatedFileCardBodyHeights={estimatedFileCardBodyHeights}
            fileCardBodyVisibility={fileCardBodyVisibility}
            fileCardPreviewViewports={fileCardPreviewViewports}
            fileCardRootRefs={fileCardRootRefs}
            reviewThreadsByPath={reviewThreadsByPath}
            reviewedPaths={reviewedPaths}
            scrollRef={scrollRef}
            selectedFileIndex={selectedFileIndex}
            selectedDiffRowRef={selectedDiffRowRef}
            showSelectedReviewAnchor={showSelectedReviewAnchor}
            selectedReviewAnchor={selectedReviewAnchor}
            selectedReviewComment={selectedReviewComment}
            selectedReviewThread={selectedReviewThread}
            session={session}
            stickyFile={stickyFile}
            syntaxStyle={syntaxStyle}
            theme={theme}
            toggleReviewThreadCollapsed={toggleReviewThreadCollapsed}
          />
        </box>

        {activePrefixMenu?.picker != null ? (
          <PrefixPickerOverlay
            commands={activePrefixMenuCommands}
            prefixMenu={activePrefixMenu}
            theme={theme}
          />
        ) : null}

        <DiffdiffAppDialogs
          activeDialog={activeOverlay}
          activeListView={activeListView}
          activePane={activePane}
          branchItems={branchItems}
          branchListFilters={branchListFilters}
          branchListIndex={branchListIndex}
          canApplyCleanup={canApplyCleanup}
          cleanupCandidateIndex={cleanupCandidateIndex}
          cleanupCandidates={cleanupCandidates}
          cleanupSelection={cleanupSelection}
          commandBindingLabels={commandBindingLabels}
          commandIndex={commandIndex}
          commandQuery={commandQuery}
          commandQueryCursorOffset={commandQueryCursorOffset}
          commitListIndex={commitListIndex}
          commitSearchActive={commitSearchActive}
          commitSearchQuery={commitSearchQuery}
          commitSearchCursorOffset={commitSearchCursorOffset}
          diagnosticErrorMessage={diagnosticErrorMessage}
          diagnosticEventIndex={diagnosticEventIndex}
          diagnosticEvents={diagnosticEvents}
          diagnosticLogFilePath={diagnosticLogFilePath}
          draftPrCount={draftPrCount}
          filteredCommands={filteredCommands}
          helpCommands={helpCommands}
          filteredCommitItems={filteredCommitItems}
          filterIndex={filterIndex}
          isDiagnosticsLoading={isDiagnosticsLoading}
          isSubmittingReviewAction={isSubmittingReviewAction}
          localBranchCount={localBranchCount}
          mergeBodyScrollRef={mergeBodyScrollRef}
          mergeCommitMessage={mergeCommitMessage}
          mergeCommitMessageCursorOffset={mergeCommitMessageCursorOffset}
          mergeCommitTitle={mergeCommitTitle}
          mergeCommitTitleCursorOffset={mergeCommitTitleCursorOffset}
          mergeConfirmOpen={showMergeConfirmModal}
          mergeMethod={mergeMethod}
          mergeModalField={mergeModalField}
          openPrCount={openPrCount}
          pullRequestListIndex={pullRequestListIndex}
          pullRequestSearchActive={pullRequestSearchActive}
          pullRequestSearchQuery={pullRequestSearchQuery}
          pullRequestSearchCursorOffset={pullRequestSearchCursorOffset}
          reviewRequestedPrCount={reviewRequestedPrCount}
          filteredPullRequests={filteredPullRequests}
          isPullRequestListLoading={isPullRequestListLoading}
          remoteBranchCount={remoteBranchCount}
          reviewComposerBody={reviewComposerBody}
          reviewComposerCursorOffset={reviewComposerCursorOffset}
          reviewComposerAutocomplete={reviewComposerAutocomplete}
          reviewComposerAutocompleteIndex={reviewComposerAutocompleteIndex}
          reviewComposerContext={reviewComposerContext}
          reviewComposerHistoryEntries={reviewComposerHistoryEntries}
          reviewedCount={reviewedCount}
          reviewSubmissionBody={reviewSubmissionBody}
          reviewSubmissionCursorOffset={reviewSubmissionCursorOffset}
          reviewSubmissionEventIndex={reviewSubmissionEventIndex}
          selectedPullRequestConversationItemId={pullRequestConversationItemId}
          session={session}
          terminalWidth={terminalWidth}
          theme={theme}
        />
      </box>

      <AppFooter
        footerEvent={footerEvent}
        footerEventMessage={footerEventMessage}
        footerModeBadge={footerModeBadge}
        helpLabel={helpLabel}
        showLoadingIndicator={showFooterLoadingIndicator}
        theme={theme}
      />
    </box>
  );
}
