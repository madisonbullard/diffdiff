import type { GitHubPullRequestReviewThread } from "@diffdiff/core";
import { logDiffdiffWarn } from "@diffdiff/core";
import type { BoxRenderable, ColorInput, SyntaxStyle } from "@opentui/core";
import { memo, useEffect, useRef } from "react";
import type { Ref } from "react";
import { getDiffFiletype } from "../language.ts";
import type { UiTheme } from "../theme.ts";
import type { PreparedReviewFile } from "../types.ts";
import type { SelectedReviewAnchor } from "../review-anchors.ts";
import { SideBySideDiffPreview, UnifiedDiffPreview } from "./diff-preview.tsx";
import { SPLIT_BORDER, Tag, capitalize, getCollapseToggleGlyph } from "./shared.tsx";

export interface FileCardPreviewViewport {
  bottom: number;
  overscan: number;
  top: number;
}

export interface FileCardProps {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  file: PreparedReviewFile;
  diffView: "unified" | "split";
  headerVariant?: "sticky-compact";
  isCollapsed: boolean;
  removeTopPadding?: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  onToggleReviewThreadCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  placeholderHeight?: number;
  previewViewport?: FileCardPreviewViewport;
  selectedReviewCommentId?: number;
  reviewThreads?: readonly GitHubPullRequestReviewThread[];
  selectedReviewThreadId?: string;
  rootRef?: Ref<BoxRenderable>;
  shouldRenderBody?: boolean;
  selectedReviewAnchor?: SelectedReviewAnchor;
  syntaxStyle: SyntaxStyle;
  terminalWidth: number;
  theme: UiTheme;
}

export function FileCard(props: FileCardProps) {
  return <MemoizedFileCard {...props} />;
}

const MemoizedFileCard = memo(function FileCard({
  collapsedCommentStates,
  file,
  diffView,
  headerVariant,
  isCollapsed,
  removeTopPadding = false,
  isReviewed,
  isSelected,
  onToggleReviewThreadCollapsed,
  placeholderHeight,
  previewViewport,
  selectedReviewCommentId,
  reviewThreads = [],
  selectedReviewThreadId,
  rootRef,
  shouldRenderBody = true,
  selectedReviewAnchor,
  syntaxStyle,
  terminalWidth,
  theme,
}: FileCardProps) {
  const { statusColor, statusLabel } = getFileStatusChrome(file.status, theme);
  const { borderColor, fileBackground } = getFileCardChrome(isSelected, isReviewed, theme);
  const usesCompactHeader = headerVariant === "sticky-compact";

  const usesFallbackRenderer =
    shouldRenderBody &&
    !file.isBinary &&
    file.renderError == null &&
    file.patch.trim() !== "" &&
    ((diffView === "unified" && file.unifiedLines.length === 0) ||
      (diffView === "split" && file.sideBySideRows.length === 0));
  const loggedFallbackRef = useRef(false);
  const bodyViewport =
    previewViewport == null
      ? undefined
      : getFileCardBodyViewport({
          file,
          headerVariant,
          previewViewport,
          removeTopPadding,
        });

  useEffect(() => {
    if (usesFallbackRenderer && !loggedFallbackRef.current) {
      loggedFallbackRef.current = true;
      logDiffdiffWarn("render", "diff_fallback_renderer_used", {
        diffView,
        path: file.path,
      });
    }

    if (!usesFallbackRenderer) {
      loggedFallbackRef.current = false;
    }
  }, [diffView, file.path, shouldRenderBody, usesFallbackRenderer]);

  return (
    <box
      ref={rootRef}
      width="100%"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={borderColor}
      backgroundColor={fileBackground}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={0}
      paddingTop={removeTopPadding ? 0 : 1}
      paddingBottom={isCollapsed ? 0 : 1}
      gap={1}
    >
      {usesCompactHeader ? (
        <FileCardStatusRow
          isReviewed={isReviewed}
          statusColor={statusColor}
          statusLabel={statusLabel}
          theme={theme}
        />
      ) : (
        <>
          <FileCardTitleRow
            file={file}
            isCollapsed={isCollapsed}
            isSelected={isSelected}
            theme={theme}
          />
          <FileCardStatusTags
            isReviewed={isReviewed}
            statusColor={statusColor}
            statusLabel={statusLabel}
            theme={theme}
          />
        </>
      )}

      {file.previousPath != null ? (
        <text fg={theme.textMuted} wrapMode="none">
          <span fg={theme.warning}>rename</span>
          <span> </span>
          <span>{file.previousPath}</span>
          <span fg={theme.warning}>{" \u2192 "}</span>
          <span>{file.path}</span>
        </text>
      ) : null}

      {!isCollapsed && shouldRenderBody ? (
        <MemoizedFileCardBody
          collapsedCommentStates={collapsedCommentStates}
          diffView={diffView}
          file={file}
          onToggleReviewThreadCollapsed={onToggleReviewThreadCollapsed}
          previewViewport={bodyViewport}
          selectedReviewCommentId={selectedReviewCommentId}
          selectedReviewThreadId={selectedReviewThreadId}
          reviewThreads={reviewThreads}
          selectedReviewAnchor={selectedReviewAnchor}
          syntaxStyle={syntaxStyle}
          terminalWidth={terminalWidth}
          theme={theme}
        />
      ) : !isCollapsed && (placeholderHeight ?? 0) > 0 ? (
        <box width="100%" height={placeholderHeight} />
      ) : null}
    </box>
  );
});

const MemoizedFileCardBody = memo(function FileCardBody({
  collapsedCommentStates,
  diffView,
  file,
  onToggleReviewThreadCollapsed,
  previewViewport,
  selectedReviewCommentId,
  reviewThreads,
  selectedReviewThreadId,
  selectedReviewAnchor,
  syntaxStyle,
  terminalWidth,
  theme,
}: {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  diffView: "unified" | "split";
  file: PreparedReviewFile;
  onToggleReviewThreadCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  previewViewport?: FileCardPreviewViewport;
  selectedReviewCommentId?: number;
  reviewThreads: readonly GitHubPullRequestReviewThread[];
  selectedReviewThreadId?: string;
  selectedReviewAnchor?: SelectedReviewAnchor;
  syntaxStyle: SyntaxStyle;
  terminalWidth: number;
  theme: UiTheme;
}) {
  const filetype = getDiffFiletype(file.path);

  return (
    <box width="100%" flexDirection="column">
      {file.isBinary ? (
        <box paddingLeft={1}>
          <text fg={theme.textMuted}>
            Binary file changed. Content preview is not available yet.
          </text>
        </box>
      ) : null}
      {!file.isBinary && file.renderError != null ? (
        <box paddingLeft={1}>
          <text fg={theme.warning}>{file.renderError}</text>
        </box>
      ) : null}
      {!file.isBinary && file.renderError == null && file.patch.trim() === "" ? (
        <box paddingLeft={1}>
          <text fg={theme.textMuted}>No textual diff available for this file.</text>
        </box>
      ) : null}
      {!file.isBinary && file.renderError == null && file.patch.trim() !== "" ? (
        <box width="100%">
          {diffView === "unified" && file.unifiedLines.length > 0 ? (
            <UnifiedDiffPreview
              collapsedCommentStates={collapsedCommentStates}
              file={file}
              onToggleReviewThreadCollapsed={onToggleReviewThreadCollapsed}
              previewViewport={
                reviewThreads.length === 0 && selectedReviewAnchor == null
                  ? previewViewport
                  : undefined
              }
              selectedReviewCommentId={selectedReviewCommentId}
              selectedReviewThreadId={selectedReviewThreadId}
              reviewThreads={reviewThreads}
              selectedReviewAnchor={selectedReviewAnchor}
              terminalWidth={terminalWidth}
              theme={theme}
            />
          ) : diffView === "split" && file.sideBySideRows.length > 0 ? (
            <SideBySideDiffPreview
              collapsedCommentStates={collapsedCommentStates}
              file={file}
              onToggleReviewThreadCollapsed={onToggleReviewThreadCollapsed}
              selectedReviewCommentId={selectedReviewCommentId}
              selectedReviewThreadId={selectedReviewThreadId}
              reviewThreads={reviewThreads}
              selectedReviewAnchor={selectedReviewAnchor}
              terminalWidth={terminalWidth}
              theme={theme}
            />
          ) : (
            <box width="100%" flexDirection="column" gap={1}>
              <diff
                diff={file.patch}
                view={diffView}
                filetype={filetype}
                showLineNumbers={true}
                syntaxStyle={syntaxStyle}
                width="100%"
                wrapMode="word"
                fg={theme.text}
                addedBg={theme.additionBg}
                removedBg={theme.deletionBg}
                contextBg={theme.contextBg}
                addedSignColor={theme.success}
                removedSignColor={theme.danger}
                lineNumberFg={theme.textMuted}
                lineNumberBg={theme.contextBg}
                addedLineNumberBg={theme.additionLineNumberBg}
                removedLineNumberBg={theme.deletionLineNumberBg}
              />
            </box>
          )}
        </box>
      ) : null}
    </box>
  );
});

export function StickyFileHeader(props: {
  file: PreparedReviewFile;
  isCollapsed: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  theme: UiTheme;
}) {
  return <MemoizedStickyFileHeader {...props} />;
}

const MemoizedStickyFileHeader = memo(function StickyFileHeader({
  file,
  isCollapsed,
  isReviewed,
  isSelected,
  theme,
}: {
  file: PreparedReviewFile;
  isCollapsed: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  theme: UiTheme;
}) {
  const { borderColor, fileBackground } = getFileCardChrome(isSelected, isReviewed, theme);

  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={borderColor}
      backgroundColor={fileBackground}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={0}
      paddingTop={1}
      paddingBottom={1}
      zIndex={10}
    >
      <box width="100%" paddingRight={1}>
        <FileCardTitleRow
          file={file}
          isCollapsed={isCollapsed}
          isSelected={isSelected}
          theme={theme}
        />
      </box>
    </box>
  );
});

function FileCardTitleRow({
  file,
  isCollapsed,
  isSelected,
  theme,
}: {
  file: PreparedReviewFile;
  isCollapsed: boolean;
  isSelected: boolean;
  theme: UiTheme;
}) {
  return (
    <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
      <text fg={theme.text} wrapMode="none">
        <span fg={theme.textMuted}>{`${getCollapseToggleGlyph(isCollapsed)} `}</span>
        <span fg={isSelected ? theme.accent : theme.text}>{file.path}</span>
      </text>
      <FileCardChangeCounts file={file} theme={theme} />
    </box>
  );
}

function FileCardStatusRow({
  isReviewed,
  statusColor,
  statusLabel,
  theme,
}: {
  isReviewed: boolean;
  statusColor: ColorInput;
  statusLabel: string;
  theme: UiTheme;
}) {
  return (
    <box width="100%">
      <FileCardStatusTags
        isReviewed={isReviewed}
        statusColor={statusColor}
        statusLabel={statusLabel}
        theme={theme}
      />
    </box>
  );
}

function FileCardStatusTags({
  isReviewed,
  statusColor,
  statusLabel,
  theme,
}: {
  isReviewed: boolean;
  statusColor: ColorInput;
  statusLabel: string;
  theme: UiTheme;
}) {
  return (
    <text fg={theme.textMuted} wrapMode="none">
      <Tag label={statusLabel.toUpperCase()} fg={theme.inverseText} bg={statusColor} />
      {isReviewed ? (
        <>
          <span> </span>
          <Tag label="REVIEWED" fg={theme.success} bg={theme.reviewedBg} />
        </>
      ) : null}
    </text>
  );
}

function FileCardChangeCounts({ file, theme }: { file: PreparedReviewFile; theme: UiTheme }) {
  return (
    <box paddingRight={2}>
      <text fg={theme.textMuted} wrapMode="none">
        <span fg={theme.success}>{`+${file.additions}`}</span>
        <span fg={theme.border}>{" / "}</span>
        <span fg={theme.danger}>{`-${file.deletions}`}</span>
      </text>
    </box>
  );
}

function getFileCardBodyViewport({
  file,
  headerVariant,
  previewViewport,
  removeTopPadding,
}: {
  file: PreparedReviewFile;
  headerVariant?: "sticky-compact";
  previewViewport: FileCardPreviewViewport;
  removeTopPadding: boolean;
}): FileCardPreviewViewport {
  const headerBlockCount = headerVariant === "sticky-compact" ? 1 : 2;
  const blocksBeforeBody = headerBlockCount + (file.previousPath != null ? 1 : 0);
  const bodyTopOffset = (removeTopPadding ? 0 : 1) + blocksBeforeBody + blocksBeforeBody;

  return {
    bottom: previewViewport.bottom - bodyTopOffset,
    overscan: previewViewport.overscan,
    top: previewViewport.top - bodyTopOffset,
  };
}

function getFileCardChrome(isSelected: boolean, isReviewed: boolean, theme: UiTheme) {
  return {
    borderColor: isSelected ? theme.borderActive : isReviewed ? theme.success : theme.border,
    fileBackground: isSelected ? theme.surfaceMuted : theme.surface,
  };
}

function getFileStatusChrome(status: PreparedReviewFile["status"], theme: UiTheme) {
  return {
    statusColor:
      status === "added"
        ? theme.success
        : status === "deleted"
          ? theme.danger
          : status === "renamed"
            ? theme.warning
            : theme.accent,
    statusLabel: status === "modified" ? "Changed" : capitalize(status),
  };
}
