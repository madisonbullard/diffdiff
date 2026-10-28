import type { GitHubPullRequestComment } from "@madisonbullard/diffdiff-core";
import type { ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import type { MutableRefObject } from "react";
import { ErrorToast } from "../../components/error-toast.tsx";
import type { DiffLineTarget, DiffScrollController } from "../layout/diff-scroll.ts";
import { PrefixPickerOverlay } from "../../components/prefix-picker-overlay.tsx";
import type { FileTreeNode, PreparedReviewSession } from "../../types.ts";
import type { UiTheme } from "../../theme.ts";
import type { PrefixMenuCommand, PrefixMenuConfig } from "../commands/prefix-menus.ts";
import type { DiffdiffDialogModels } from "../dialogs/dialog-models.ts";
import { DiffdiffAppDialogs } from "../dialogs/dialog-router.tsx";
import { VisibleCommentRelativeTimeProvider } from "../review/visible-comment-relative-time.tsx";
import { AppDiffPane } from "./app-diff-pane.tsx";
import { AppFooter, getFooterHintsWidth, type FooterHint } from "./app-footer.tsx";
import { AppHeader } from "./app-header.tsx";
import { AppSidebar } from "./app-sidebar.tsx";
import { DialogUiProvider, type DialogUi } from "../../components/dialog/context.tsx";
import { dialogTokens } from "../../components/dialog/tokens.ts";
import { truncateInlineMessage } from "../shared/text.ts";

interface DiffdiffAppViewProps {
  dialogUi: DialogUi;
  onSelectOverview?: () => void;
  onToggleOverviewReviewed?: () => void;
  onToggleOverviewCollapsed?: () => void;
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
  diffScroll: DiffScrollController;
  footerEvent: { color: string; message: string };
  footerEventMessage: string;
  footerModeBadge: { bg: string; fg: string; label: string };
  handleFileTreeMouseUp: (node: FileTreeNode) => void;
  footerHints: readonly FooterHint[];
  activePrefixMenu?: PrefixMenuConfig;
  activePrefixMenuCommands: readonly PrefixMenuCommand[];
  onMouseUp: () => void;
  onOpenChecks?: () => void;
  refreshIndicatorLabel: string | null;
  reviewedPaths: ReadonlySet<string>;
  reviewThreadsByPath: ReadonlyMap<
    string,
    readonly import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread[]
  >;
  scrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  selectedFileIndex: number;
  selectedDiffRowRef: MutableRefObject<DiffLineTarget | null>;
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
  terminalHeight: number;
  theme: UiTheme;
  toggleReviewThreadCollapsed: (
    thread: import("@madisonbullard/diffdiff-core").GitHubPullRequestReviewThread,
  ) => void;
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
  dialogUi,
  onSelectOverview,
  onToggleOverviewReviewed,
  onToggleOverviewCollapsed,
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
  diffScroll,
  footerEvent,
  footerEventMessage,
  footerModeBadge,
  handleFileTreeMouseUp,
  footerHints,
  activePrefixMenu,
  activePrefixMenuCommands,
  onMouseUp,
  onOpenChecks,
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
  terminalHeight,
  theme,
  toggleReviewThreadCollapsed,
  treeScrollRef,
  treeSummaryLabels,
  visibleTreeNodes,
}: DiffdiffAppViewProps) {
  const hasOverlaySurface = activeOverlay != null || activePrefixMenu?.picker != null;
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
        onOpenChecks={activeOverlay == null ? onOpenChecks : undefined}
        refreshIndicatorLabel={refreshIndicatorLabel}
        session={session}
        theme={theme}
      />

      <VisibleCommentRelativeTimeProvider
        activeOverlay={activeOverlay}
        collapsedCommentStates={collapsedCommentStates}
        fileCardBodyVisibility={session.files.map((file) => !collapsedPaths.has(file.path))}
        reviewThreadsByPath={reviewThreadsByPath}
        session={session}
      >
        <box width="100%" flexGrow={1}>
          <box width="100%" height="100%" flexDirection="row">
            <AppSidebar
              collapsedCommentStates={collapsedCommentStates}
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
              treeScrollRef={treeScrollRef}
              treeSummaryLabels={treeSummaryLabels}
              visibleTreeNodes={visibleTreeNodes}
            />

            <AppDiffPane
              onSelectOverview={onSelectOverview}
              onToggleOverviewReviewed={onToggleOverviewReviewed}
              onToggleOverviewCollapsed={onToggleOverviewCollapsed}
              activeFileIndex={activeFileIndex}
              activeOverlay={activeOverlay}
              activePane={activePane}
              collapsedCommentStates={collapsedCommentStates}
              collapsedPaths={collapsedPaths}
              diffPaneWidth={diffPaneWidth}
              terminalHeight={terminalHeight}
              diffView={diffView}
              diffScroll={diffScroll}
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
        </box>
      </VisibleCommentRelativeTimeProvider>
      <DialogUiProvider value={dialogUi}>
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
      </DialogUiProvider>

      <AppFooter
        footerEvent={
          errorToastMessage != null && hasOverlaySurface
            ? { color: theme.danger, message: errorToastMessage }
            : footerEvent
        }
        footerEventMessage={
          errorToastMessage != null && hasOverlaySurface
            ? truncateInlineMessage(
                `✗ ${errorToastMessage}`,
                Math.max(
                  0,
                  terminalWidth - footerModeBadge.label.length - getFooterHintsWidth(footerHints),
                ),
              )
            : footerEventMessage
        }
        footerModeBadge={footerModeBadge}
        hints={footerHints}
        showLoadingIndicator={showFooterLoadingIndicator}
        theme={{ ...theme, chromeBackground: dialogTokens(theme).footer }}
      />

      {errorToastMessage != null && !hasOverlaySurface ? (
        <ErrorToast message={errorToastMessage} terminalWidth={terminalWidth} theme={theme} />
      ) : null}
    </box>
  );
}
