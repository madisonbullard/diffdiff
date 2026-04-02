import type { GitHubCleanupPreferences, GitHubRefCleanupCandidate } from "@diffdiff/core";
import type { BoxRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import { BranchModal } from "../components/branch-modal.tsx";
import { CommandPaletteModal } from "../components/command-palette-modal.tsx";
import { FileCard, StickyFileHeader } from "../components/file-card.tsx";
import { FileTreeSidebar } from "../components/file-tree-sidebar.tsx";
import { HelpModal } from "../components/help-modal.tsx";
import { ListFilterModal } from "../components/list-filter-modal.tsx";
import { Tag } from "../components/shared.tsx";
import { PullRequestBanner } from "../review/banner.tsx";
import { PullRequestCommentsModal } from "../review/comments-modal.tsx";
import { MergePullRequestModal } from "../review/merge-pull-request-modal.tsx";
import { PostMergeCleanupModal } from "../review/post-merge-cleanup-modal.tsx";
import { ReviewComposerModal } from "../review/review-composer-modal.tsx";
import { SubmitReviewModal } from "../review/submit-review-modal.tsx";
import type {
  AppPane,
  BranchListFilters,
  DiffView,
  ListModalView,
  PreparedReviewSession,
} from "../types.ts";
import type { CommandDefinition } from "../commands.ts";
import type { UiTheme } from "../theme.ts";

export function DiffdiffAppLayout(props: {
  activeFileIndex: number;
  activeListView: ListModalView;
  activeOverlay: string | null;
  activePane: AppPane;
  baseBranchLoadingMessage: string | null;
  branchItems: readonly import("../types.ts").BranchListItem[];
  branchListFilters: BranchListFilters;
  branchListIndex: number;
  cleanupCandidateIndex: number;
  cleanupCandidates: readonly GitHubRefCleanupCandidate[];
  cleanupSelection: GitHubCleanupPreferences;
  commandIndex: number;
  commandListLabel: string;
  commitItems: readonly import("../types.ts").CommitListItem[];
  commitListIndex: number;
  commitSearchActive: boolean;
  commitSearchQuery: string;
  diffPaneWidth: number;
  diffView: DiffView;
  errorToastMessage: string | null;
  fileCardRefs: React.MutableRefObject<(BoxRenderable | null)[]>;
  filterIndex: number;
  filteredCommands: readonly CommandDefinition[];
  footerEventColor: string;
  footerEventMessage: string;
  keyLegendToggleLabel: string;
  loadingIndicatorFrame: number;
  mergeBodyScrollRef: React.MutableRefObject<ScrollBoxRenderable | null>;
  mergeCanSubmit: boolean;
  mergeCommitMessage: string;
  mergeCommitTitle: string;
  mergeMethod: import("@diffdiff/core").GitHubMergeMethod | undefined;
  mergeModalField: "method" | "title" | "body";
  openPrCount: number;
  remoteBranchCount: number;
  reviewedPaths: ReadonlySet<string>;
  reviewComposerBody: string;
  reviewSubmissionBody: string;
  reviewSubmissionEventIndex: number;
  selectedFileIndex: number;
  selectedReviewAnchor: import("../review-anchors.ts").SelectedReviewAnchor | undefined;
  selectedTreePath: string;
  session: PreparedReviewSession;
  showBranchModal: boolean;
  showCleanupModal: boolean;
  showCommandModal: boolean;
  showCommentComposer: boolean;
  showCommentsModal: boolean;
  showHelp: boolean;
  showKeyLegend: boolean;
  showListFilterModal: boolean;
  showMergeModal: boolean;
  showSubmitReviewModal: boolean;
  sidebarWidth: number;
  statusMessage: string;
  stickyFile: import("../types.ts").PreparedReviewFile | undefined;
  syntaxStyle: SyntaxStyle;
  terminalWidth: number;
  theme: UiTheme;
  toastMessage: string | null;
  treeRowRefs: React.MutableRefObject<(BoxRenderable | null)[]>;
  treeScrollRef: React.MutableRefObject<ScrollBoxRenderable | null>;
  treeSummaryLabels: {
    reviewed: string;
    diffAdditions: string;
    diffSeparator: string;
    diffDeletions: string;
  };
  visibleTreeNodes: readonly import("../types.ts").FileTreeNode[];
  canApplyCleanup: boolean;
  isSubmittingReviewAction: boolean;
  collapsedDirectories: ReadonlySet<string>;
  collapsedPaths: ReadonlySet<string>;
  commentCollapseStates?: Readonly<Record<string, boolean>>;
  onFileTreeMouseUp: (node: import("../types.ts").FileTreeNode) => void;
  onMouseUp: () => void;
  onToggleReviewGroupCollapsed?: (
    group: import("@diffdiff/core").GitHubPullRequestReviewGroup,
  ) => void;
  onToggleReviewThreadCollapsed?: (
    thread: import("@diffdiff/core").GitHubPullRequestReviewThread,
  ) => void;
  scrollRef: React.MutableRefObject<ScrollBoxRenderable | null>;
}) {
  const {
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
    commandIndex,
    commandListLabel,
    commitItems,
    commitListIndex,
    commitSearchActive,
    commitSearchQuery,
    diffPaneWidth,
    diffView,
    fileCardRefs,
    filterIndex,
    filteredCommands,
    footerEventColor,
    footerEventMessage,
    keyLegendToggleLabel,
    mergeBodyScrollRef,
    mergeCanSubmit,
    mergeCommitMessage,
    mergeCommitTitle,
    mergeMethod,
    mergeModalField,
    openPrCount,
    remoteBranchCount,
    reviewedPaths,
    reviewComposerBody,
    reviewSubmissionBody,
    reviewSubmissionEventIndex,
    selectedFileIndex,
    selectedReviewAnchor,
    selectedTreePath,
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
    sidebarWidth,
    stickyFile,
    syntaxStyle,
    theme,
    treeRowRefs,
    treeScrollRef,
    treeSummaryLabels,
    visibleTreeNodes,
    commentCollapseStates,
    collapsedDirectories,
    collapsedPaths,
    onFileTreeMouseUp,
    onMouseUp,
    onToggleReviewGroupCollapsed,
    onToggleReviewThreadCollapsed,
    scrollRef,
  } = props;
  const selectedFile = session.files[selectedFileIndex];
  const currentBranchLabel = session.repository.currentBranch ?? "detached";

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
            <span>{"  "}</span>
            <Tag
              label={`base ← ${session.comparison.base}`}
              fg={theme.inverseText}
              bg={theme.warning}
            />
            <span fg={theme.border}>{"  \u2502  "}</span>
            <Tag
              label={`head → ${session.comparison.head}`}
              fg={theme.inverseText}
              bg={theme.accent}
            />
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
              onNodeMouseUp={onFileTreeMouseUp}
              onRowRef={(index, node) => {
                treeRowRefs.current[index] = node;
              }}
              reviewedPaths={reviewedPaths}
              selectedFilePath={selectedFile?.path}
              selectedPath={selectedTreePath}
              theme={theme}
            />
          </scrollbox>
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

              {session.files.map((file, index) => (
                <FileCard
                  collapsedCommentStates={commentCollapseStates}
                  key={file.path}
                  file={file}
                  diffView={diffView}
                  headerVariant={index === activeFileIndex ? "sticky-compact" : undefined}
                  isCollapsed={collapsedPaths.has(file.path)}
                  removeTopPadding={index === 0}
                  isReviewed={reviewedPaths.has(file.path)}
                  isSelected={index === selectedFileIndex}
                  onToggleReviewThreadCollapsed={onToggleReviewThreadCollapsed}
                  reviewThreads={session.github?.pullRequest.reviewThreads.filter(
                    (thread) => thread.path === file.path,
                  )}
                  rootRef={(node) => {
                    fileCardRefs.current[index] = node;
                  }}
                  selectedReviewAnchor={
                    index === selectedFileIndex && session.github != null
                      ? selectedReviewAnchor
                      : undefined
                  }
                  syntaxStyle={syntaxStyle}
                  terminalWidth={diffPaneWidth}
                  theme={theme}
                />
              ))}
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
        <box flexShrink={0}>
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
          <text fg={footerEventColor} wrapMode="none">
            <span>{footerEventMessage}</span>
          </text>
        </box>
      </box>

      {showBranchModal ? (
        <BranchModal
          activeView={activeListView}
          base={session.comparison.base}
          branchItems={branchItems}
          branchIndex={branchListIndex}
          commitItems={commitItems}
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
          leaderKeybind="ctrl+x"
          query=""
          selectedIndex={commandIndex}
          theme={theme}
        />
      ) : null}
      {showBranchModal && showListFilterModal ? (
        <ListFilterModal filters={branchListFilters} selectedIndex={filterIndex} theme={theme} />
      ) : null}
      {showCommentComposer && selectedReviewAnchor != null ? (
        <ReviewComposerModal
          anchor={selectedReviewAnchor}
          body={reviewComposerBody}
          isSubmitting={props.isSubmittingReviewAction}
          theme={theme}
        />
      ) : null}
      {showCommentsModal && session.github != null ? (
        <PullRequestCommentsModal
          collapsedCommentStates={commentCollapseStates}
          onToggleCollapsed={onToggleReviewGroupCollapsed}
          pullRequest={session.github.pullRequest}
          theme={theme}
        />
      ) : null}
      {showSubmitReviewModal ? (
        <SubmitReviewModal
          body={reviewSubmissionBody}
          eventIndex={reviewSubmissionEventIndex}
          isSubmitting={props.isSubmittingReviewAction}
          theme={theme}
        />
      ) : null}
      {showMergeModal && session.github != null ? (
        <MergePullRequestModal
          body={mergeCommitMessage}
          bodyScrollRef={mergeBodyScrollRef}
          canSubmit={mergeCanSubmit}
          field={mergeModalField}
          isSubmitting={props.isSubmittingReviewAction}
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
          isSubmitting={props.isSubmittingReviewAction}
          selectedIndex={cleanupCandidateIndex}
          selection={cleanupSelection}
          theme={theme}
        />
      ) : null}
      {showHelp ? <HelpModal theme={theme} /> : null}
    </box>
  );
}
