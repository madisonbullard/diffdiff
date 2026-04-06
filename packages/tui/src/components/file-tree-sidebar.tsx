import type { BoxRenderable } from "@opentui/core";
import type { AppPane, FileTreeNode, PreparedReviewFile } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import { SPLIT_BORDER, getCollapseToggleGlyph, tintHex } from "./shared.tsx";

export interface FileTreeSidebarProps {
  activePane: AppPane;
  collapsedDirectories: ReadonlySet<string>;
  collapsedPaths: ReadonlySet<string>;
  nodes: readonly FileTreeNode[];
  onNodeMouseUp: (node: FileTreeNode) => void;
  onRowRef?: (index: number, node: BoxRenderable | null) => void;
  reviewedPaths: ReadonlySet<string>;
  selectedFilePath?: string;
  selectedPath?: string;
  theme: UiTheme;
}

export function FileTreeSidebar({
  activePane,
  collapsedDirectories,
  collapsedPaths,
  nodes,
  onNodeMouseUp,
  onRowRef,
  reviewedPaths,
  selectedFilePath,
  selectedPath,
  theme,
}: FileTreeSidebarProps) {
  if (nodes.length === 0) {
    return (
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={activePane === "tree" ? theme.borderActive : theme.border}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={theme.textMuted}>No files in this comparison.</text>
      </box>
    );
  }

  return (
    <box width="100%" flexDirection="column" gap={0}>
      {nodes.map((node, index) => {
        const isSelected = node.path === selectedPath;
        const isCurrentFile = node.kind === "file" && node.path === selectedFilePath;
        const isReviewed = node.kind === "file" && reviewedPaths.has(node.path);
        const isFileCollapsed = node.kind === "file" && collapsedPaths.has(node.path);
        const isDirectoryCollapsed =
          node.kind === "directory" && collapsedDirectories.has(node.path);
        const accent =
          node.kind === "directory"
            ? theme.warning
            : node.status === "added"
              ? theme.success
              : node.status === "deleted"
                ? theme.danger
                : node.status === "renamed"
                  ? theme.warning
                  : theme.accent;
        const borderColor = isSelected
          ? theme.borderActive
          : isCurrentFile
            ? theme.accent
            : theme.border;
        const backgroundColor = isSelected
          ? tintHex(theme.surface, accent, 0.24)
          : isCurrentFile
            ? tintHex(theme.surface, theme.accent, 0.14)
            : theme.surface;
        const labelColor = isSelected || isCurrentFile ? theme.text : theme.textMuted;
        const indentation = `${"  ".repeat(node.depth)}`;

        return (
          <box
            key={node.path}
            ref={(renderable) => {
              onRowRef?.(index, renderable);
            }}
            width="100%"
            border={["left"]}
            customBorderChars={SPLIT_BORDER}
            borderColor={borderColor}
            backgroundColor={backgroundColor}
            paddingLeft={1}
            paddingRight={1}
            paddingTop={0}
            paddingBottom={0}
            onMouseDown={() => {
              onNodeMouseUp(node);
            }}
          >
            <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
              <text fg={labelColor} wrapMode="none">
                <span>{indentation}</span>
                {node.kind === "directory" ? (
                  <>
                    <span
                      fg={theme.textMuted}
                    >{`${getCollapseToggleGlyph(isDirectoryCollapsed)} `}</span>
                  </>
                ) : (
                  <span fg={accent}>{`${getFileTreeStatusGlyph(node.status)} `}</span>
                )}
                <span fg={isSelected ? theme.text : isCurrentFile ? theme.accent : labelColor}>
                  {node.name}
                </span>
              </text>
              <text fg={theme.textMuted} wrapMode="none">
                {node.kind === "directory" ? (
                  <span>{`${node.fileCount}`}</span>
                ) : (
                  <>
                    {isReviewed ? <span fg={theme.success}>{"\u2713 "}</span> : null}
                    {isFileCollapsed ? <span fg={theme.textMuted}>{"\u2212 "}</span> : null}
                    <span fg={theme.success}>{`+${node.additions}`}</span>
                    <span fg={theme.border}> </span>
                    <span fg={theme.danger}>{`-${node.deletions}`}</span>
                  </>
                )}
              </text>
            </box>
          </box>
        );
      })}
    </box>
  );
}

function getFileTreeStatusGlyph(status: PreparedReviewFile["status"]): string {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "modified":
      return "M";
  }
}
