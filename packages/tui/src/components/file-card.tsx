import type { GitHubPullRequestReviewThread } from "@madisonbullard/diffdiff-core";
import type { BoxRenderable, ColorInput, SyntaxStyle } from "@opentui/core";
import { memo } from "react";
import type { Ref } from "react";
import { getFilePreview } from "../diff/preview-lines.ts";
import { getDiffFiletype } from "../language.ts";
import type { DiffLineTarget } from "../app/layout/diff-scroll.ts";
import type { UiTheme } from "../theme.ts";
import type { PreparedReviewFile } from "../types.ts";
import type { SelectedReviewAnchor } from "../review-anchors.ts";
import { SideBySideDiffPreview, UnifiedDiffPreview } from "./diff-preview.tsx";
import { SPLIT_BORDER, Tag, capitalize, getCollapseToggleGlyph } from "./shared.tsx";

interface FileCardProps {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  file: PreparedReviewFile;
  diffView: "unified" | "split";
  headerVariant?: "sticky-compact";
  isCollapsed: boolean;
  removeTopPadding?: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  onToggleReviewThreadCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  bodyRef?: Ref<BoxRenderable>;
  selectedDiffRowRef?: Ref<DiffLineTarget>;
  selectedReviewCommentId?: number;
  reviewThreads?: readonly GitHubPullRequestReviewThread[];
  selectedReviewThreadId?: string;
  rootRef?: Ref<BoxRenderable>;
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
  file: rawFile,
  diffView,
  headerVariant,
  isCollapsed,
  removeTopPadding = false,
  isReviewed,
  isSelected,
  onToggleReviewThreadCollapsed,
  bodyRef,
  selectedDiffRowRef,
  selectedReviewCommentId,
  reviewThreads = [],
  selectedReviewThreadId,
  rootRef,
  selectedReviewAnchor,
  syntaxStyle,
  terminalWidth,
  theme,
}: FileCardProps) {
  const file = isCollapsed ? rawFile : getFilePreview(rawFile);
  const { statusColor, statusLabel } = getFileStatusChrome(file.status, theme);
  const { borderColor, fileBackground } = getFileCardChrome(isSelected, isReviewed, theme);
  const usesCompactHeader = headerVariant === "sticky-compact";

  return (
    <box
      ref={rootRef}
      width="100%"
      flexShrink={0}
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={borderColor}
      backgroundColor={fileBackground}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={0}
      paddingTop={removeTopPadding ? 0 : 1}
      paddingBottom={1}
      gap={1}
    >
      {usesCompactHeader ? null : (
        <FileCardTitleRow
          file={file}
          isCollapsed={isCollapsed}
          isReviewed={isReviewed}
          isSelected={isSelected}
          statusColor={statusColor}
          statusLabel={statusLabel}
          theme={theme}
        />
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

      {!isCollapsed ? (
        <MemoizedFileCardBody
          bodyRef={bodyRef}
          collapsedCommentStates={collapsedCommentStates}
          diffView={diffView}
          file={file}
          onToggleReviewThreadCollapsed={onToggleReviewThreadCollapsed}
          selectedDiffRowRef={selectedDiffRowRef}
          selectedReviewCommentId={selectedReviewCommentId}
          selectedReviewThreadId={selectedReviewThreadId}
          reviewThreads={reviewThreads}
          selectedReviewAnchor={selectedReviewAnchor}
          syntaxStyle={syntaxStyle}
          terminalWidth={terminalWidth}
          theme={theme}
        />
      ) : null}
    </box>
  );
});

const MemoizedFileCardBody = memo(function FileCardBody({
  collapsedCommentStates,
  diffView,
  file,
  onToggleReviewThreadCollapsed,
  bodyRef,
  selectedDiffRowRef,
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
  bodyRef?: Ref<BoxRenderable>;
  selectedDiffRowRef?: Ref<DiffLineTarget>;
  selectedReviewCommentId?: number;
  reviewThreads: readonly GitHubPullRequestReviewThread[];
  selectedReviewThreadId?: string;
  selectedReviewAnchor?: SelectedReviewAnchor;
  syntaxStyle: SyntaxStyle;
  terminalWidth: number;
  theme: UiTheme;
}) {
  const showsEmptyFilePlaceholder = isEmptyFileDiff(file);

  return (
    <box ref={bodyRef} width="100%" flexDirection="column">
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
      {showsEmptyFilePlaceholder ? (
        <box paddingLeft={1}>
          <text fg={theme.textMuted}>empty file</text>
        </box>
      ) : null}
      {!showsEmptyFilePlaceholder &&
      !file.isBinary &&
      file.renderError == null &&
      file.patch.trim() === "" ? (
        <box paddingLeft={1}>
          <text fg={theme.textMuted}>No textual diff available for this file.</text>
        </box>
      ) : null}
      {!showsEmptyFilePlaceholder &&
      !file.isBinary &&
      file.renderError == null &&
      file.patch.trim() !== "" ? (
        <box width="100%">
          {diffView === "unified" && file.unifiedLines.length > 0 ? (
            <UnifiedDiffPreview
              collapsedCommentStates={collapsedCommentStates}
              file={file}
              onToggleReviewThreadCollapsed={onToggleReviewThreadCollapsed}
              selectedDiffRowRef={selectedDiffRowRef}
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
              selectedDiffRowRef={selectedDiffRowRef}
              selectedReviewCommentId={selectedReviewCommentId}
              selectedReviewThreadId={selectedReviewThreadId}
              reviewThreads={reviewThreads}
              selectedReviewAnchor={selectedReviewAnchor}
              terminalWidth={terminalWidth}
              theme={theme}
            />
          ) : (
            <diff
              diff={file.patch}
              view={diffView}
              filetype={getDiffFiletype(file.path, file.patch)}
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
          )}
        </box>
      ) : null}
    </box>
  );
});

function isEmptyFileDiff(file: PreparedReviewFile): boolean {
  if (file.isBinary || file.renderError != null) {
    return false;
  }

  if (file.additions !== 0 || file.deletions !== 0) {
    return false;
  }

  if (file.status !== "added" && file.status !== "deleted") {
    return false;
  }

  if (file.diff != null) {
    return file.diff.hunks.length === 0;
  }

  return !/^@@ /mu.test(file.patch);
}

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
  const { statusColor, statusLabel } = getFileStatusChrome(file.status, theme);

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
          isReviewed={isReviewed}
          isSelected={isSelected}
          statusColor={statusColor}
          statusLabel={statusLabel}
          theme={theme}
        />
      </box>
    </box>
  );
});

function FileCardTitleRow({
  file,
  isCollapsed,
  isReviewed,
  isSelected,
  statusColor,
  statusLabel,
  theme,
}: {
  file: PreparedReviewFile;
  isCollapsed: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  statusColor: ColorInput;
  statusLabel: string;
  theme: UiTheme;
}) {
  return (
    <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
      <text fg={theme.text} wrapMode="none">
        <span fg={theme.textMuted}>{`${getCollapseToggleGlyph(isCollapsed)} `}</span>
        <span fg={isSelected ? theme.accent : theme.text}>{file.path}</span>
      </text>
      <FileCardHeaderMeta
        additions={file.additions}
        deletions={file.deletions}
        isReviewed={isReviewed}
        statusColor={statusColor}
        statusLabel={statusLabel}
        theme={theme}
      />
    </box>
  );
}

function FileCardHeaderMeta({
  additions,
  deletions,
  isReviewed,
  statusColor,
  statusLabel,
  theme,
}: {
  additions: number;
  deletions: number;
  isReviewed: boolean;
  statusColor: ColorInput;
  statusLabel: string;
  theme: UiTheme;
}) {
  return (
    <text paddingRight={2} flexShrink={0} fg={theme.textMuted} wrapMode="none">
      <Tag label={statusLabel.toUpperCase()} fg={theme.inverseText} bg={statusColor} />
      {isReviewed ? (
        <>
          <span> </span>
          <Tag label="REVIEWED" fg={theme.success} bg={theme.reviewedBg} />
        </>
      ) : null}
      <span> </span>
      <span fg={theme.success}>{`+${additions}`}</span>
      <span fg={theme.border}>{" / "}</span>
      <span fg={theme.danger}>{`-${deletions}`}</span>
    </text>
  );
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
