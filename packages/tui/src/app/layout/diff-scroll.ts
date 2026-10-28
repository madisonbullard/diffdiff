import type { BoxRenderable, Renderable, ScrollBoxRenderable, TextRenderable } from "@opentui/core";
import { getTopIntersectingFileIndex } from "../../view-model.ts";
import { PR_OVERVIEW_PATH } from "../review/pull-request-overview.ts";

export const LINE_REVEAL_CONTEXT_ROWS = 3;

export interface DiffLineTarget {
  node: TextRenderable;
  line: number;
}

/** Read Yoga's committed layout, including before OpenTUI copies it to .y. */
export function contentOffset(node: Renderable, content: Renderable): number {
  let offset = 0;
  for (let current: Renderable | null = node; current !== content; current = current.parent) {
    if (current == null) return node.y - content.y;
    offset += current.getLayoutNode().getComputedTop();
  }
  return offset;
}

export function lineTargetOffset(target: DiffLineTarget, content: Renderable): number {
  const row = target.node.lineInfo.lineSources.indexOf(target.line);
  return contentOffset(target.node, content) + Math.max(row, 0);
}

/**
 * `jump` puts the line a third of the way down the viewport. `nearest` leaves
 * a visible line alone and otherwise scrolls the least distance that shows it
 * with a few rows of context, falling back to `jump` when that distance leaves
 * nothing of the previous viewport on screen.
 */
export type LineRevealPlacement = "jump" | "nearest";

export function getLineRevealScrollTop({
  height,
  lineRows,
  lineTop,
  placement,
  scrollTop,
}: {
  height: number;
  lineRows: number;
  lineTop: number;
  placement: LineRevealPlacement;
  scrollTop: number;
}): number {
  const jumpTop = Math.max(0, lineTop - Math.floor(height / 3));
  if (placement === "jump") return jumpTop;
  const lineBottom = lineTop + Math.max(lineRows, 1) - 1;
  if (lineTop >= scrollTop && lineBottom < scrollTop + height) return scrollTop;
  const context = Math.max(
    0,
    Math.min(LINE_REVEAL_CONTEXT_ROWS, Math.floor((height - lineRows) / 4)),
  );
  const nearestTop =
    lineTop < scrollTop || lineRows > height
      ? lineTop - context
      : lineBottom - height + 1 + context;
  return Math.abs(nearestTop - scrollTop) >= height ? jumpTop : Math.max(0, nearestTop);
}

interface FileNodes {
  card: BoxRenderable | null;
  body: BoxRenderable | null;
}
type ScrollAnchor = { path: string; offset: number | "body" };
/** `from` is the viewport the request saw, so a relayout can re-run it. */
type PendingLine = {
  target: DiffLineTarget;
  placement: LineRevealPlacement;
  from: ScrollAnchor | null;
};

/** One native scrollbox, one anchor, no height estimates or viewport state. */
export class DiffScrollController {
  private paths: string[] = [];
  private files: readonly { path: string }[] | null = null;
  private hasOverview = false;
  private nodes = new Map<string, FileNodes>();
  private callbacks = new Map<
    string,
    {
      card: (node: BoxRenderable | null) => void;
      body: (node: BoxRenderable | null) => void;
    }
  >();
  private tops: number[] = [];
  private anchor: ScrollAnchor | null = null;
  private pendingLine: PendingLine | null = null;
  private applying = false;
  private laidOut = false;
  private activeIndex = 0;
  private scroll: ScrollBoxRenderable | null = null;
  private onActiveFile: (index: number) => void = () => undefined;
  private viewportListeners = new Set<() => void>();

  subscribeViewport(listener: () => void): () => void {
    this.viewportListeners.add(listener);
    return () => {
      this.viewportListeners.delete(listener);
    };
  }

  private notifyViewport(): void {
    for (const listener of this.viewportListeners) listener();
  }

  setFiles(files: readonly { path: string }[], hasOverview = false): void {
    if (files === this.files && hasOverview === this.hasOverview) return;
    this.files = files;
    this.hasOverview = hasOverview;
    const paths = files.map((file) => file.path);
    if (hasOverview) paths.unshift(PR_OVERVIEW_PATH);
    if (
      paths.length === this.paths.length &&
      paths.every((path, index) => path === this.paths[index])
    )
      return;
    this.paths = paths;
    this.laidOut = false;
    const valid = new Set(paths);
    for (const path of this.nodes.keys())
      if (!valid.has(path)) {
        this.nodes.delete(path);
        this.callbacks.delete(path);
      }
    if (this.anchor == null || !valid.has(this.anchor.path)) {
      this.anchor = paths[0] == null ? null : { path: paths[0], offset: "body" };
    }
  }

  refs(path: string) {
    let refs = this.callbacks.get(path);
    if (refs == null) {
      const entry: FileNodes = { card: null, body: null };
      this.nodes.set(path, entry);
      refs = {
        card: (node: BoxRenderable | null) => {
          entry.card = node;
        },
        body: (node: BoxRenderable | null) => {
          entry.body = node;
        },
      };
      this.callbacks.set(path, refs);
    }
    return refs;
  }

  connect(scroll: ScrollBoxRenderable, root: Renderable, onActiveFile: (index: number) => void) {
    this.scroll = scroll;
    this.onActiveFile = onActiveFile;
    root.on("layout-changed", this.layout);
    scroll.verticalScrollBar.on("change", this.changed);
    return () => {
      root.off("layout-changed", this.layout);
      scroll.verticalScrollBar.off("change", this.changed);
      this.scroll = null;
    };
  }

  getFileTop(index: number): number | undefined {
    return this.tops[index + Number(this.hasOverview)];
  }
  getViewportHeight(): number {
    return this.scroll?.viewport.height ?? 0;
  }
  fileAtViewport(fraction: number): number {
    return this.fileAt(
      (this.scroll?.scrollTop ?? 0) +
        Math.floor(Math.max(0, this.getViewportHeight() - 1) * fraction),
    );
  }
  visibleRange(): [number, number] {
    return [this.fileAtViewport(0), this.fileAtViewport(1)];
  }

  revealFile(path: string, offset?: number): void {
    this.pendingLine = null;
    this.anchor = { path, offset: offset ?? "body" };
    if (this.laidOut) this.applyAnchor();
    const index = this.paths.indexOf(path);
    if (index >= 0) this.setActive(index - Number(this.hasOverview));
    this.notifyViewport();
  }

  revealLine(target: DiffLineTarget, placement: LineRevealPlacement): void {
    const request = { target, placement, from: this.anchor };
    if (this.laidOut) this.applyLine(request);
    this.pendingLine = request;
  }

  private applyLine({ target, placement }: PendingLine): void {
    if (this.scroll == null || target.node.isDestroyed) return;
    const sources = target.node.lineInfo.lineSources;
    const firstRow = sources.indexOf(target.line);
    const scrollTop = getLineRevealScrollTop({
      height: this.getViewportHeight(),
      lineRows: firstRow < 0 ? 1 : sources.lastIndexOf(target.line) - firstRow + 1,
      lineTop: lineTargetOffset(target, this.scroll.content),
      placement,
      scrollTop: this.scroll.scrollTop,
    });
    this.applying = true;
    try {
      this.scroll.scrollTo(scrollTop);
    } finally {
      this.applying = false;
    }
    this.changed();
  }

  scrollBy(amount: number, page = false): void {
    this.scroll?.scrollBy(amount, page ? "viewport" : "absolute");
  }

  private fileAt(row: number): number {
    return getTopIntersectingFileIndex(this.tops, row) - Number(this.hasOverview);
  }

  private setActive(index: number): void {
    if (index === this.activeIndex) return;
    this.activeIndex = index;
    this.onActiveFile(index);
  }

  private changed = () => {
    if (this.applying || !this.laidOut || this.scroll == null) return;
    this.pendingLine = null;
    const index = this.fileAt(this.scroll.scrollTop);
    const itemIndex = index + Number(this.hasOverview);
    const path = this.paths[itemIndex];
    if (path != null) this.anchor = { path, offset: this.scroll.scrollTop - this.tops[itemIndex]! };
    this.setActive(index);
    this.notifyViewport();
  };

  private applyAnchor(): void {
    const scroll = this.scroll;
    if (scroll == null || this.anchor == null) return;
    const index = this.paths.indexOf(this.anchor.path);
    const entry = this.nodes.get(this.anchor.path);
    const top = this.tops[index];
    if (top == null || entry?.card == null) return;
    const offset =
      this.anchor.offset === "body"
        ? entry.body == null
          ? 0
          : contentOffset(entry.body, scroll.content) - top
        : Math.min(
            this.anchor.offset,
            Math.max(0, entry.card.getLayoutNode().getComputedHeight() - 1),
          );
    this.applying = true;
    try {
      scroll.scrollTo(Math.max(0, top + offset));
    } finally {
      this.applying = false;
    }
    this.setActive(index - Number(this.hasOverview));
  }

  private layout = () => {
    const scroll = this.scroll;
    if (scroll == null) return;
    this.applying = true;
    // Update native scrollbar extents before scrollTo, not a frame afterwards.
    try {
      scroll.viewport.updateFromLayout();
      scroll.content.updateFromLayout();
    } finally {
      this.applying = false;
    }
    this.tops = this.paths.map((path) => {
      const card = this.nodes.get(path)?.card;
      return card == null ? Infinity : contentOffset(card, scroll.content);
    });
    this.laidOut = true;
    const pending = this.pendingLine;
    this.pendingLine = null;
    if (pending != null && !pending.target.node.isDestroyed) {
      // A newly expanded buffer has Yoga's width but not its native wrap map
      // yet. Synchronize that buffer before asking for its visual row.
      pending.target.node.updateFromLayout();
      if (pending.placement === "nearest" && pending.from != null) {
        this.anchor = pending.from;
        this.applyAnchor();
      }
      this.applyLine(pending);
    } else this.applyAnchor();
    this.notifyViewport();
  };
}
