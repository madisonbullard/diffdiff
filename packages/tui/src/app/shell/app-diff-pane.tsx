import type { GitHubPullRequestReviewThread } from "@madisonbullard/diffdiff-core";
import type { ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import type { MutableRefObject } from "react";
import { FileCard, StickyFileHeader } from "../../components/file-card.tsx";
import type { PreparedReviewSession } from "../../types.ts";
import type { UiTheme } from "../../theme.ts";
import { EMPTY_REVIEW_THREADS } from "../review/review-constants.ts";
import type { DiffLineTarget, DiffScrollController } from "../layout/diff-scroll.ts";
import { PullRequestOverviewCard } from "../../components/pull-request-overview-card.tsx";
import { getOverviewStateKeys, PR_OVERVIEW_PATH } from "../review/pull-request-overview.ts";

interface AppDiffPaneProps {
  onSelectOverview?: () => void;
  onToggleOverviewReviewed?: () => void;
  onToggleOverviewCollapsed?: () => void;
  activeFileIndex: number;
  activeOverlay: import("../dialogs/stack.ts").AppDialog | null;
  activePane: import("../../types.ts").AppPane;
  collapsedCommentStates: Record<string, boolean>;
  collapsedPaths: ReadonlySet<string>;
  diffPaneWidth: number;
  terminalHeight: number;
  diffView: "unified" | "split";
  diffScroll: DiffScrollController;
  reviewThreadsByPath: ReadonlyMap<string, readonly GitHubPullRequestReviewThread[]>;
  reviewedPaths: ReadonlySet<string>;
  scrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  selectedFileIndex: number;
  selectedDiffRowRef: MutableRefObject<DiffLineTarget | null>;
  showSelectedReviewAnchor: boolean;
  selectedReviewAnchor?: import("../../review-anchors.ts").SelectedReviewAnchor;
  selectedReviewComment?: import("@madisonbullard/diffdiff-core").GitHubPullRequestComment;
  selectedReviewThread?: GitHubPullRequestReviewThread;
  session: PreparedReviewSession;
  stickyFile?: PreparedReviewSession["files"][number];
  syntaxStyle: SyntaxStyle;
  theme: UiTheme;
  toggleReviewThreadCollapsed: (thread: GitHubPullRequestReviewThread) => void;
}

export function AppDiffPane({
  onSelectOverview,
  onToggleOverviewReviewed,
  onToggleOverviewCollapsed,
  activeFileIndex,
  activePane,
  collapsedCommentStates,
  collapsedPaths,
  diffPaneWidth,
  terminalHeight,
  diffView,
  diffScroll,
  reviewThreadsByPath,
  reviewedPaths,
  scrollRef,
  selectedFileIndex,
  selectedDiffRowRef,
  showSelectedReviewAnchor,
  selectedReviewAnchor,
  selectedReviewComment,
  selectedReviewThread,
  session,
  stickyFile,
  syntaxStyle,
  theme,
  toggleReviewThreadCollapsed,
}: AppDiffPaneProps) {
  const overviewKeys =
    session.github == null ? undefined : getOverviewStateKeys(session.github.pullRequest);
  return (
    <box flexGrow={1} flexDirection="column" minHeight={0}>
      {stickyFile != null ? (
        <box flexShrink={0} width="100%" paddingLeft={1} backgroundColor={theme.appBackground}>
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
        minHeight={0}
        focused={false}
        viewportOptions={{ backgroundColor: theme.appBackground }}
        contentOptions={{
          backgroundColor: theme.appBackground,
          flexDirection: "column",
          paddingLeft: 1,
          gap: 1,
        }}
        verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
      >
        {session.github != null && overviewKeys != null ? (
          <PullRequestOverviewCard
            github={session.github}
            isCollapsed={collapsedCommentStates[overviewKeys.collapsed] ?? false}
            isReviewed={collapsedCommentStates[overviewKeys.reviewed] ?? false}
            isSelected={selectedFileIndex === -1}
            rootRef={diffScroll.refs(PR_OVERVIEW_PATH).card}
            syntaxStyle={syntaxStyle}
            theme={theme}
            onSelect={onSelectOverview}
            onToggleCollapsed={onToggleOverviewCollapsed}
            onToggleReviewed={onToggleOverviewReviewed}
          />
        ) : null}
        {session.files.length === 0 ? (
          <text fg={theme.textMuted}>No changed files found for this comparison.</text>
        ) : null}
        {session.files.map((file, index) => {
          const isSelected = index === selectedFileIndex;
          const refs = diffScroll.refs(file.path);
          return (
            <FileCard
              key={file.path}
              file={file}
              diffView={diffView}
              headerVariant={index === 0 && session.github == null ? "sticky-compact" : undefined}
              removeTopPadding={index === 0 && session.github == null}
              isCollapsed={collapsedPaths.has(file.path)}
              isReviewed={reviewedPaths.has(file.path)}
              isSelected={isSelected}
              collapsedCommentStates={collapsedCommentStates}
              onToggleReviewThreadCollapsed={toggleReviewThreadCollapsed}
              reviewThreads={reviewThreadsByPath.get(file.path) ?? EMPTY_REVIEW_THREADS}
              rootRef={refs.card}
              bodyRef={refs.body}
              selectedDiffRowRef={isSelected ? selectedDiffRowRef : undefined}
              selectedReviewCommentId={isSelected ? selectedReviewComment?.id : undefined}
              selectedReviewThreadId={isSelected ? selectedReviewThread?.id : undefined}
              selectedReviewAnchor={
                isSelected && showSelectedReviewAnchor ? selectedReviewAnchor : undefined
              }
              syntaxStyle={syntaxStyle}
              terminalWidth={diffPaneWidth}
              theme={theme}
            />
          );
        })}
        <box height={terminalHeight} flexShrink={0} />
      </scrollbox>
    </box>
  );
}
