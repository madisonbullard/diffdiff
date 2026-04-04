import type {
  GitHubCleanupPreferences,
  GitHubDashboardPullRequest,
  GitHubMergeMethod,
  GitHubPullRequestComment,
  GitHubRefCleanupCandidate,
} from "@diffdiff/core";
import type { BoxRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import type { MutableRefObject } from "react";
import {
  FileCard,
  StickyFileHeader,
  type FileCardPreviewViewport,
} from "../components/file-card.tsx";
import { FileTreeSidebar } from "../components/file-tree-sidebar.tsx";
import { Tag } from "../components/shared.tsx";
import { PullRequestBanner } from "../review/banner.tsx";
import type { AppCommand } from "./command-registry.ts";
import { DiffdiffAppKeyLegend } from "./diffdiff-app-key-legend.tsx";
import { DiffdiffAppDialogs } from "./layout.tsx";
import { EMPTY_REVIEW_THREADS } from "./diffdiff-app-shared.ts";
import type {
  AppPane,
  BranchListFilters,
  BranchListItem,
  CommitListItem,
  FileTreeNode,
  ListModalView,
  PreparedReviewSession,
} from "../types.ts";
import type { UiTheme } from "../theme.ts";

interface DiffdiffAppViewProps {
  activeFileIndex: number;
  activeListView: ListModalView;
  activeOverlay: import("./dialog-stack.ts").AppDialog | null;
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
  commandIndex: number;
  commandListLabel: string;
  commandQuery: string;
  commitListIndex: number;
  commitSearchActive: boolean;
  commitSearchQuery: string;
  currentBranchLabel: string;
  diffPaneWidth: number;
  diffView: "unified" | "split";
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
  isPullRequestListLoading: boolean;
  isSubmittingReviewAction: boolean;
  keyLegendToggleLabel: string;
  leaderKeybind: string;
  mergeBodyScrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  mergeCommitMessage: string;
  mergeCommitTitle: string;
  mergeMethod: GitHubMergeMethod | undefined;
  mergeModalField: "method" | "title" | "body";
  onMouseUp: () => void;
  openPrCount: number;
  pullRequestConversationItemId?: string;
  pullRequestListIndex: number;
  pullRequestSearchActive: boolean;
  pullRequestSearchQuery: string;
  refreshIndicatorLabel: string | null;
  remoteBranchCount: number;
  reviewComposerBody: string;
  reviewComposerContext: {
    snippet: string;
    subtitle: string;
    title: string;
  } | null;
  reviewedPaths: ReadonlySet<string>;
  reviewRequestedPrCount: number;
  reviewSubmissionBody: string;
  reviewSubmissionEventIndex: number;
  reviewThreadsByPath: ReadonlyMap<
    string,
    readonly import("@diffdiff/core").GitHubPullRequestReviewThread[]
  >;
  scrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  selectedFileIndex: number;
  selectedReviewAnchor?: import("../review-anchors.ts").SelectedReviewAnchor;
  selectedReviewComment?: GitHubPullRequestComment;
  selectedReviewThread?: import("@diffdiff/core").GitHubPullRequestReviewThread;
  selectedTreePath: string;
  session: PreparedReviewSession;
  showKeyLegend: boolean;
  showMergeConfirmModal: boolean;
  sidebarWidth: number;
  stickyFile?: PreparedReviewSession["files"][number];
  syntaxStyle: SyntaxStyle;
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
  commandIndex,
  commandListLabel,
  commandQuery,
  commitListIndex,
  commitSearchActive,
  commitSearchQuery,
  currentBranchLabel,
  diffPaneWidth,
  diffView,
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
  isPullRequestListLoading,
  isSubmittingReviewAction,
  keyLegendToggleLabel,
  leaderKeybind,
  mergeBodyScrollRef,
  mergeCommitMessage,
  mergeCommitTitle,
  mergeMethod,
  mergeModalField,
  onMouseUp,
  openPrCount,
  pullRequestConversationItemId,
  pullRequestListIndex,
  pullRequestSearchActive,
  pullRequestSearchQuery,
  refreshIndicatorLabel,
  remoteBranchCount,
  reviewComposerBody,
  reviewComposerContext,
  reviewedPaths,
  reviewRequestedPrCount,
  reviewSubmissionBody,
  reviewSubmissionEventIndex,
  reviewThreadsByPath,
  scrollRef,
  selectedFileIndex,
  selectedReviewAnchor,
  selectedReviewComment,
  selectedReviewThread,
  selectedTreePath,
  session,
  showKeyLegend,
  showMergeConfirmModal,
  sidebarWidth,
  stickyFile,
  syntaxStyle,
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
      <box
        flexShrink={0}
        width="100%"
        backgroundColor={theme.chromeBackground}
        paddingX={2}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={0}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <text fg={theme.text} wrapMode="none">
            <span fg={theme.accent}>diffdiff</span>
            <span fg={theme.border}>{" / "}</span>
            <span>{session.repository.name}</span>
            <span fg={theme.border}>{"  │  "}</span>
            <Tag
              label={`base ← ${session.comparison.base}`}
              fg={theme.inverseText}
              bg={theme.warning}
            />
            <span>{"  "}</span>
            <Tag
              label={`head → ${session.comparison.head}`}
              fg={theme.inverseText}
              bg={theme.accent}
            />
            {refreshIndicatorLabel != null ? (
              <>
                <span>{"  "}</span>
                <Tag label={refreshIndicatorLabel} fg={theme.inverseText} bg={theme.danger} />
              </>
            ) : null}
          </text>
          <text fg={theme.textMuted} wrapMode="none">
            <span>{session.repository.rootPath}</span>
            <span>{"  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>{` ${currentBranchLabel} `}</span>
          </text>
        </box>
        {session.warnings[0] != null ? (
          <text fg={theme.warning} wrapMode="none">
            <span>{"warning "}</span>
            <span>{session.warnings[0].message}</span>
          </text>
        ) : null}
        {session.github != null ? (
          <PullRequestBanner pullRequest={session.github.pullRequest} theme={theme} />
        ) : null}
      </box>

      <box width="100%" flexGrow={1} flexDirection="row">
        <box
          flexShrink={0}
          width={sidebarWidth}
          backgroundColor={theme.appBackground}
          paddingLeft={2}
          paddingRight={1}
          paddingY={1}
          flexDirection="column"
          gap={1}
        >
          <box width="100%">
            <box
              width="100%"
              border={["left"]}
              borderColor={activePane === "tree" ? theme.borderActive : theme.border}
              backgroundColor={activePane === "tree" ? theme.surfaceMuted : theme.surface}
              paddingLeft={1}
              paddingRight={1}
              paddingY={1}
              flexDirection="column"
              gap={0}
            >
              <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={reviewedPaths.size > 0 ? theme.success : theme.textMuted}>
                    {reviewedPaths.size}
                  </span>
                  <span>{treeSummaryLabels.reviewed.slice(String(reviewedPaths.size).length)}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="none">
                  <span fg={theme.success}>{treeSummaryLabels.diffAdditions}</span>
                  <span fg={theme.border}>{treeSummaryLabels.diffSeparator}</span>
                  <span fg={theme.danger}>{treeSummaryLabels.diffDeletions}</span>
                </text>
              </box>
            </box>
          </box>

          <scrollbox
            ref={treeScrollRef}
            width="100%"
            flexGrow={1}
            focused={activeOverlay == null && activePane === "tree"}
            viewportOptions={{ backgroundColor: theme.appBackground }}
            contentOptions={{ backgroundColor: theme.appBackground }}
            verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
          >
            <FileTreeSidebar
              activePane={activePane}
              collapsedDirectories={collapsedDirectories}
              collapsedPaths={collapsedPaths}
              nodes={visibleTreeNodes}
              onNodeMouseUp={handleFileTreeMouseUp}
              onRowRef={(index, node) => {
                treeRowRefCallbacks[index]?.(node);
              }}
              reviewedPaths={reviewedPaths}
              selectedFilePath={session.files[selectedFileIndex]?.path}
              selectedPath={selectedTreePath}
              theme={theme}
            />
          </scrollbox>

          {showKeyLegend ? (
            <DiffdiffAppKeyLegend hasGitHubReview={session.github != null} theme={theme} />
          ) : null}
        </box>

        <box flexGrow={1} flexDirection="column">
          {stickyFile != null ? (
            <box
              flexShrink={0}
              width="100%"
              paddingLeft={1}
              paddingRight={0}
              backgroundColor={theme.appBackground}
            >
              <StickyFileHeader
                file={stickyFile}
                isCollapsed={collapsedPaths.has(stickyFile.path)}
                isReviewed={reviewedPaths.has(stickyFile.path)}
                isSelected={activePane === "diff" && activeFileIndex === selectedFileIndex}
                theme={theme}
              />
            </box>
          ) : null}

          <scrollbox
            ref={scrollRef}
            width="100%"
            flexGrow={1}
            focused={activeOverlay == null && activePane === "diff"}
            viewportOptions={{ backgroundColor: theme.appBackground }}
            contentOptions={{ backgroundColor: theme.appBackground }}
            verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
          >
            <box
              width="100%"
              flexDirection="column"
              paddingLeft={1}
              paddingRight={0}
              paddingBottom={1}
              gap={1}
            >
              {session.files.length === 0 ? (
                <box
                  border={["left"]}
                  borderColor={theme.border}
                  backgroundColor={theme.surface}
                  paddingLeft={2}
                  paddingRight={0}
                  paddingTop={1}
                  paddingBottom={1}
                >
                  <text fg={theme.textMuted}>No changed files found for this comparison.</text>
                </box>
              ) : null}

              {session.files.map((file, index) => {
                const isSelected = index === selectedFileIndex;
                const isReviewed = reviewedPaths.has(file.path);
                const isCollapsed = collapsedPaths.has(file.path);

                return (
                  <FileCard
                    collapsedCommentStates={collapsedCommentStates}
                    key={file.path}
                    file={file}
                    diffView={diffView}
                    headerVariant={index === 0 ? "sticky-compact" : undefined}
                    isCollapsed={isCollapsed}
                    removeTopPadding={index === 0}
                    isReviewed={isReviewed}
                    isSelected={isSelected}
                    onToggleReviewThreadCollapsed={toggleReviewThreadCollapsed}
                    placeholderHeight={estimatedFileCardBodyHeights[index]}
                    previewViewport={fileCardPreviewViewports[index]}
                    reviewThreads={reviewThreadsByPath.get(file.path) ?? EMPTY_REVIEW_THREADS}
                    rootRef={fileCardRootRefs[index]}
                    shouldRenderBody={fileCardBodyVisibility[index]}
                    selectedReviewCommentId={isSelected ? selectedReviewComment?.id : undefined}
                    selectedReviewThreadId={isSelected ? selectedReviewThread?.id : undefined}
                    selectedReviewAnchor={
                      isSelected && session.github != null ? selectedReviewAnchor : undefined
                    }
                    syntaxStyle={syntaxStyle}
                    terminalWidth={diffPaneWidth}
                    theme={theme}
                  />
                );
              })}
            </box>
          </scrollbox>
        </box>
      </box>

      <box
        flexShrink={0}
        width="100%"
        backgroundColor={theme.chromeBackground}
        paddingX={2}
        paddingTop={0}
        paddingBottom={0}
        flexDirection="row"
        alignItems="center"
        gap={2}
      >
        <box flexShrink={0} flexDirection="row" alignItems="center" gap={2}>
          <Tag label={footerModeBadge.label} fg={footerModeBadge.fg} bg={footerModeBadge.bg} />
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>{` ${commandListLabel} `}</span>
            <span>{" commands  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" z "}
            </span>
            <span>{` ${keyLegendToggleLabel}`}</span>
          </text>
        </box>
        <box flexGrow={1} flexDirection="row" justifyContent="flex-end">
          <text fg={footerEvent.color} wrapMode="none">
            <span>{footerEventMessage}</span>
          </text>
        </box>
      </box>

      <DiffdiffAppDialogs
        activeDialog={activeOverlay}
        activeListView={activeListView}
        branchItems={branchItems}
        branchListFilters={branchListFilters}
        branchListIndex={branchListIndex}
        canApplyCleanup={canApplyCleanup}
        cleanupCandidateIndex={cleanupCandidateIndex}
        cleanupCandidates={cleanupCandidates}
        cleanupSelection={cleanupSelection}
        commandIndex={commandIndex}
        commandQuery={commandQuery}
        commitListIndex={commitListIndex}
        commitSearchActive={commitSearchActive}
        commitSearchQuery={commitSearchQuery}
        filteredCommands={filteredCommands}
        helpCommands={helpCommands}
        filteredCommitItems={filteredCommitItems}
        filterIndex={filterIndex}
        isSubmittingReviewAction={isSubmittingReviewAction}
        leaderKeybind={leaderKeybind}
        mergeBodyScrollRef={mergeBodyScrollRef}
        mergeCommitMessage={mergeCommitMessage}
        mergeCommitTitle={mergeCommitTitle}
        mergeConfirmOpen={showMergeConfirmModal}
        mergeMethod={mergeMethod}
        mergeModalField={mergeModalField}
        openPrCount={openPrCount}
        pullRequestListIndex={pullRequestListIndex}
        pullRequestSearchActive={pullRequestSearchActive}
        pullRequestSearchQuery={pullRequestSearchQuery}
        reviewRequestedPrCount={reviewRequestedPrCount}
        filteredPullRequests={filteredPullRequests}
        isPullRequestListLoading={isPullRequestListLoading}
        remoteBranchCount={remoteBranchCount}
        reviewComposerBody={reviewComposerBody}
        reviewComposerContext={reviewComposerContext}
        reviewSubmissionBody={reviewSubmissionBody}
        reviewSubmissionEventIndex={reviewSubmissionEventIndex}
        selectedPullRequestConversationItemId={pullRequestConversationItemId}
        session={session}
        theme={theme}
      />
    </box>
  );
}
