import type { BoxRenderable, Renderable, ScrollBoxRenderable, TextRenderable } from "@opentui/core";
import { getTopIntersectingFileIndex } from "../../view-model.ts";
import { PR_OVERVIEW_PATH } from "../review/pull-request-overview.ts";

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

interface FileNodes {
  card: BoxRenderable | null;
  body: BoxRenderable | null;
}
type ScrollAnchor = { path: string; offset: number | "body" };

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
  private pendingLine: DiffLineTarget | null = null;
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

  revealLine(target: DiffLineTarget): void {
    if (this.laidOut) this.applyLine(target);
    this.pendingLine = target;
  }

  private applyLine(target: DiffLineTarget): void {
    if (this.scroll == null || target.node.isDestroyed) return;
    this.applying = true;
    try {
      this.scroll.scrollTo(
        Math.max(
          0,
          lineTargetOffset(target, this.scroll.content) - Math.floor(this.getViewportHeight() / 3),
        ),
      );
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
    const target = this.pendingLine;
    this.pendingLine = null;
    if (target != null && !target.node.isDestroyed) {
      // A newly expanded buffer has Yoga's width but not its native wrap map
      // yet. Synchronize that buffer before asking for its visual row.
      target.node.updateFromLayout();
      this.applyLine(target);
    } else this.applyAnchor();
    this.notifyViewport();
  };
}
