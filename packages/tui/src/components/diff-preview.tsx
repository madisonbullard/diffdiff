import type { GitHubPullRequestReviewThread } from "@madisonbullard/diffdiff-core";
import type { Ref } from "react";
import { Fragment, memo, useMemo } from "react";
import { ReviewThreadList } from "../review/threads.tsx";
import type { UiTheme } from "../theme.ts";
import type { PreparedReviewFile } from "../types.ts";
import type { SelectedReviewAnchor } from "../review-anchors.ts";
import type { DiffLineTarget } from "../app/layout/diff-scroll.ts";
import { getFilePreview } from "../diff/preview-lines.ts";
import {
  buildSideBySideThreadIndex,
  buildUnifiedThreadIndex,
  getSideBySideRowAnnotations,
  getSideBySideRowThreads,
  getUnifiedLineAnnotations,
  getUnifiedLineThreads,
} from "./diff-thread-index.ts";
import { appendChunkLine, type DiffChunk } from "./diff-chunks.ts";
import { NativeDiffChunk } from "./native-diff-chunk.tsx";

interface PreviewProps {
  collapsedCommentStates?: Readonly<Record<string, boolean>>;
  file: PreparedReviewFile;
  onToggleReviewThreadCollapsed?: (thread: GitHubPullRequestReviewThread) => void;
  selectedDiffRowRef?: Ref<DiffLineTarget>;
  selectedReviewCommentId?: number;
  reviewThreads: readonly GitHubPullRequestReviewThread[];
  selectedReviewThreadId?: string;
  selectedReviewAnchor?: SelectedReviewAnchor;
  terminalWidth: number;
  theme: UiTheme;
}

export function UnifiedDiffPreview(props: PreviewProps) {
  return <DiffPreview {...props} split={false} />;
}

export function SideBySideDiffPreview(props: PreviewProps) {
  return <DiffPreview {...props} split={true} />;
}

const DiffPreview = memo(function DiffPreview({
  file: rawFile,
  split,
  reviewThreads,
  theme,
  selectedReviewAnchor,
  selectedDiffRowRef,
  ...threadProps
}: PreviewProps & { split: boolean }) {
  const file = getFilePreview(rawFile);
  const { chunks, unanchoredThreads } = useMemo(() => {
    const chunks: DiffChunk[] = [];
    if (split) {
      const index = buildSideBySideThreadIndex(reviewThreads, file.sideBySideRows);
      for (const row of file.sideBySideRows) {
        if (row.kind !== "line") {
          chunks.push({ kind: "header", headerKind: row.kind, segments: row.segments ?? [] });
        } else {
          appendChunkLine(
            chunks,
            {
              left: row.left,
              right: row.right,
              annotations: getSideBySideRowAnnotations(index, row),
            },
            getSideBySideRowThreads(index, row),
          );
        }
      }
      return { chunks, unanchoredThreads: index.unanchoredThreads };
    }
    const index = buildUnifiedThreadIndex(reviewThreads, file.unifiedLines);
    for (const line of file.unifiedLines) {
      if (line.kind === "hunk" || line.kind === "gap") {
        chunks.push({ kind: "header", headerKind: line.kind, segments: line.segments });
      } else {
        appendChunkLine(
          chunks,
          {
            unified: line,
            annotations: { left: getUnifiedLineAnnotations(index, line), right: [] },
          },
          getUnifiedLineThreads(index, line),
        );
      }
    }
    return { chunks, unanchoredThreads: index.unanchoredThreads };
  }, [file, reviewThreads, split]);

  const threads = (items: readonly GitHubPullRequestReviewThread[]) => (
    <ReviewThreadList
      collapsedCommentStates={threadProps.collapsedCommentStates}
      onToggleCollapsed={threadProps.onToggleReviewThreadCollapsed}
      selectedCommentId={threadProps.selectedReviewCommentId}
      selectedThreadId={threadProps.selectedReviewThreadId}
      threads={items}
      theme={theme}
    />
  );
  return (
    <>
      {chunks.map((chunk, index) =>
        chunk.kind === "header" ? (
          <box
            key={index}
            height={1}
            width="100%"
            backgroundColor={chunk.headerKind === "hunk" ? theme.hunkBg : theme.contextBg}
          >
            <text
              fg={chunk.headerKind === "hunk" ? theme.warning : theme.textMuted}
              wrapMode="none"
            >
              {chunk.segments.map((segment) => segment.text).join("")}
            </text>
          </box>
        ) : (
          <Fragment key={index}>
            <NativeDiffChunk
              chunk={chunk}
              split={split}
              lineNumberWidth={file.lineNumberWidth}
              anchor={selectedReviewAnchor}
              selectedDiffRowRef={selectedDiffRowRef}
              theme={theme}
            />
            {threads(chunk.threads)}
          </Fragment>
        ),
      )}
      {threads(unanchoredThreads)}
    </>
  );
});
