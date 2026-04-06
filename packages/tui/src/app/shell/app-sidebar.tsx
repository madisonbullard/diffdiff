import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { MutableRefObject } from "react";
import { FileTreeSidebar } from "../../components/file-tree-sidebar.tsx";
import type { AppPane, FileTreeNode, PreparedReviewSession } from "../../types.ts";
import type { UiTheme } from "../../theme.ts";

interface AppSidebarProps {
  activeOverlay: import("../dialogs/stack.ts").AppDialog | null;
  activePane: AppPane;
  collapsedDirectories: ReadonlySet<string>;
  collapsedPaths: ReadonlySet<string>;
  handleFileTreeMouseUp: (node: FileTreeNode) => void;
  reviewedPaths: ReadonlySet<string>;
  selectedFileIndex: number;
  selectedTreePath: string;
  session: PreparedReviewSession;
  sidebarWidth: number;
  theme: UiTheme;
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

export function AppSidebar({
  activeOverlay,
  activePane,
  collapsedDirectories,
  collapsedPaths,
  handleFileTreeMouseUp,
  reviewedPaths,
  selectedFileIndex,
  selectedTreePath,
  session,
  sidebarWidth,
  theme,
  treeRowRefCallbacks,
  treeScrollRef,
  treeSummaryLabels,
  visibleTreeNodes,
}: AppSidebarProps) {
  return (
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
        backgroundColor={theme.surface}
        focused={activeOverlay == null && activePane === "tree"}
        viewportOptions={{ backgroundColor: theme.surface }}
        contentOptions={{ backgroundColor: theme.surface }}
        verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
      >
        <box width="100%" flexDirection="column">
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
        </box>
      </scrollbox>
    </box>
  );
}
