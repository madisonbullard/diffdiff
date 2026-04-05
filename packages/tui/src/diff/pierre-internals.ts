import type { FileDiffMetadata } from "@pierre/diffs";

export interface HastTextNode {
  type: "text";
  value: string;
}

export interface HastElementNode {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

export type HastNode = HastTextNode | HastElementNode;

export interface SegmentStyle {
  fg?: string;
  bg?: string;
}

export interface PrepareReviewSessionOptions {
  deferSyntaxRendering?: boolean;
  initialDiffView?: "unified" | "split" | "both";
}

export interface PierreDiffsModule {
  getSharedHighlighter(options: { themes: string[]; langs: string[] }): Promise<unknown>;
  parsePatchFiles(patch: string): Array<{ files?: FileDiffMetadata[] }>;
  renderDiffWithHighlighter(
    diff: FileDiffMetadata,
    highlighter: unknown,
    options: {
      theme: string;
      tokenizeMaxLineLength: number;
      lineDiffType: "word";
    },
  ): {
    themeStyles: string;
    code: {
      deletionLines: unknown[];
      additionLines: unknown[];
    };
  };
}

let pierreDiffsPromise: Promise<PierreDiffsModule> | undefined;

export async function loadPierreDiffs(): Promise<PierreDiffsModule> {
  pierreDiffsPromise ??= import("@pierre/diffs") as Promise<PierreDiffsModule>;
  return pierreDiffsPromise;
}
