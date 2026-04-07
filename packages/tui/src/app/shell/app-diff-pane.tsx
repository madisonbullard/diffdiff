import type { BoxRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import type { MutableRefObject } from "react";
import {
  FileCard,
  StickyFileHeader,
  type FileCardPreviewViewport,
} from "../../components/file-card.tsx";
import type { PreparedReviewSession } from "../../types.ts";
import type { UiTheme } from "../../theme.ts";
import { EMPTY_REVIEW_THREADS } from "../review/review-constants.ts";

interface AppDiffPaneProps {
  activeFileIndex: number;
  activeOverlay: import("../dialogs/stack.ts").AppDialog | null;
  activePane: import("../../types.ts").AppPane;
  collapsedCommentStates: Record<string, boolean>;
  collapsedPaths: ReadonlySet<string>;
  diffPaneWidth: number;
  diffView: "unified" | "split";
  estimatedFileCardBodyHeights: readonly number[];
  fileCardBodyVisibility: readonly boolean[];
  fileCardPreviewViewports: readonly (FileCardPreviewViewport | undefined)[];
  fileCardRootRefs: readonly ((node: BoxRenderable | null) => void)[];
  reviewThreadsByPath: ReadonlyMap<
    string,
    readonly import("@diffdiff/core").GitHubPullRequestReviewThread[]
  >;
  reviewedPaths: ReadonlySet<string>;
  scrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  selectedFileIndex: number;
  selectedDiffRowRef: MutableRefObject<BoxRenderable | null>;
  showSelectedReviewAnchor: boolean;
  selectedReviewAnchor?: import("../../review-anchors.ts").SelectedReviewAnchor;
  selectedReviewComment?: import("@diffdiff/core").GitHubPullRequestComment;
  selectedReviewThread?: import("@diffdiff/core").GitHubPullRequestReviewThread;
  session: PreparedReviewSession;
  stickyFile?: PreparedReviewSession["files"][number];
  syntaxStyle: SyntaxStyle;
  theme: UiTheme;
  toggleReviewThreadCollapsed: (
    thread: import("@diffdiff/core").GitHubPullRequestReviewThread,
  ) => void;
}

export function AppDiffPane({
  activeFileIndex,
  activeOverlay,
  activePane,
  collapsedCommentStates,
  collapsedPaths,
  diffPaneWidth,
  diffView,
  estimatedFileCardBodyHeights,
  fileCardBodyVisibility,
  fileCardPreviewViewports,
  fileCardRootRefs,
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
  return (
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
        </box>
      </scrollbox>
    </box>
  );
}
