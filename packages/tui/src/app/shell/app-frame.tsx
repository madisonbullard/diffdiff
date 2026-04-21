import type { GitHubPullRequestComment } from "@madisonbullard/diffdiff-core";
import type { BoxRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import type { MutableRefObject } from "react";
import { ErrorToast } from "../../components/error-toast.tsx";
import type { FileCardPreviewViewport } from "../../components/file-card.tsx";
import { PrefixPickerOverlay } from "../../components/prefix-picker-overlay.tsx";
import type { FileTreeNode, PreparedReviewSession } from "../../types.ts";
import type { UiTheme } from "../../theme.ts";
import type { PrefixMenuCommand, PrefixMenuConfig } from "../commands/prefix-menus.ts";
import type { DiffdiffDialogModels } from "../dialogs/dialog-models.ts";
import { DiffdiffAppDialogs } from "../dialogs/dialog-router.tsx";
import { VisibleCommentRelativeTimeProvider } from "../review/visible-comment-relative-time.tsx";
import { AppDiffPane } from "./app-diff-pane.tsx";
import { AppFooter } from "./app-footer.tsx";
import { AppHeader } from "./app-header.tsx";
import { AppSidebar } from "./app-sidebar.tsx";

interface DiffdiffAppViewProps {
  activeFileIndex: number;
  activeOverlay: import("../dialogs/stack.ts").AppDialog | null;
  activePane: import("../../types.ts").AppPane;
  collapsedCommentStates: Record<string, boolean>;
  collapsedDirectories: ReadonlySet<string>;
  collapsedPaths: ReadonlySet<string>;
  currentBranchLabel: string;
  dialogModels: DiffdiffDialogModels;
  diffPaneWidth: number;
  diffView: "unified" | "split";
  errorToastMessage: string | null;
  estimatedFileCardBodyHeights: readonly number[];
  fileCardBodyVisibility: readonly boolean[];
  fileCardPreviewViewports: readonly (FileCardPreviewViewport | undefined)[];
  fileCardRootRefs: readonly ((node: BoxRenderable | null) => void)[];
  footerEvent: { color: string; message: string };
  footerEventMessage: string;
  footerModeBadge: { bg: string; fg: string; label: string };
  handleFileTreeMouseUp: (node: FileTreeNode) => void;
  helpLabel: string;
  activePrefixMenu?: PrefixMenuConfig;
  activePrefixMenuCommands: readonly PrefixMenuCommand[];
  onMouseUp: () => void;
  refreshIndicatorLabel: string | null;
  reviewedPaths: ReadonlySet<string>;
  reviewThreadsByPath: ReadonlyMap<
    string,
    readonly import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread[]
  >;
  scrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  selectedFileIndex: number;
  selectedDiffRowRef: MutableRefObject<BoxRenderable | null>;
  showSelectedReviewAnchor: boolean;
  selectedReviewAnchor?: import("../../review-anchors.ts").SelectedReviewAnchor;
  selectedReviewComment?: GitHubPullRequestComment;
  selectedReviewThread?: import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread;
  selectedTreePath: string;
  session: PreparedReviewSession;
  showFooterLoadingIndicator: boolean;
  sidebarWidth: number;
  stickyFile?: PreparedReviewSession["files"][number];
  syntaxStyle: SyntaxStyle;
  terminalWidth: number;
  theme: UiTheme;
  toggleReviewThreadCollapsed: (
    thread: import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread,
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
  activeOverlay,
  activePane,
  collapsedCommentStates,
  collapsedDirectories,
  collapsedPaths,
  currentBranchLabel,
  dialogModels,
  diffPaneWidth,
  diffView,
  errorToastMessage,
  estimatedFileCardBodyHeights,
  fileCardBodyVisibility,
  fileCardPreviewViewports,
  fileCardRootRefs,
  footerEvent,
  footerEventMessage,
  footerModeBadge,
  handleFileTreeMouseUp,
  helpLabel,
  activePrefixMenu,
  activePrefixMenuCommands,
  onMouseUp,
  refreshIndicatorLabel,
  reviewedPaths,
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

      <VisibleCommentRelativeTimeProvider
        activeOverlay={activeOverlay}
        collapsedCommentStates={collapsedCommentStates}
        fileCardBodyVisibility={fileCardBodyVisibility}
        reviewThreadsByPath={reviewThreadsByPath}
        session={session}
      >
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
            models={dialogModels}
            session={session}
            terminalWidth={terminalWidth}
            theme={theme}
          />
        </box>
      </VisibleCommentRelativeTimeProvider>

      <AppFooter
        footerEvent={footerEvent}
        footerEventMessage={footerEventMessage}
        footerModeBadge={footerModeBadge}
        helpLabel={helpLabel}
        showLoadingIndicator={showFooterLoadingIndicator}
        theme={theme}
      />

      {errorToastMessage != null ? (
        <ErrorToast message={errorToastMessage} terminalWidth={terminalWidth} theme={theme} />
      ) : null}
    </box>
  );
}
