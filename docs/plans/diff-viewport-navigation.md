# Diff Viewport And Navigation Rewrite

Status: implemented and validated. Extreme file-count mount/layout performance
remains a follow-up; see measurements below.

## Thesis

The diff pane uses OpenTUI's native layout, wrapping, text buffers, and scrollbox
culling instead of a second viewport implementation in React.

OpenTUI already provides everything the diff pane needs:

- a scrollbox that culls children outside the viewport
- native text buffers with word wrap, per-line gutters, signs, colors, and
  line-to-visual-row mapping
- a Yoga layout pass whose positions stay valid as long as layout does not
  depend on scroll position

The previous implementation built its own windowing layer on top of `<scrollbox>`:
placeholders, estimated heights, spacer rows, a viewport-metrics state loop,
and one React box per diff line. It then tries to navigate a layout that
changes every time it scrolls.

The rewrite deletes that layer. Every file is mounted the way OpenTUI intends,
each diff chunk is one native text buffer, and geometry never depends on
scroll position or selection. Scroll-to-file then reduces to
`scrollTo(node.y)`, the same thing OpenCode's diff viewer does.

## Evidence

### Prototype

`packages/tui/visual/spikes/native-scrollbox.spike.tsx` mounts the bench
fixture the idiomatic way: one `<scrollbox>`, every file a direct child, and
one `<line-number><text wrapMode="word">` per hunk. It jumps synchronously from
the previous frame's layout.

The fixture has 240 files and 46,792 diff lines, including 8 files of 3,000
lines with heavy wrapping, rendered at 124×50.

|                                              | Before rewrite                       | Prototype                            |
| -------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Correct file jumps across long wrapped files | fails                                | 59/59                                |
| File jump p50 / p95                          | ~90 ms / 1,479 ms                    | 2.4 ms / 4.5–7.4 ms                  |
| Page down p50                                | ~9 ms                                | 0.5 ms                               |
| Mounted renderables                          | 2,961, with most lines never mounted | 1,203, with all 46,792 lines mounted |
| Mount, plain text                            | —                                    | 317 ms                               |
| Mount, styled chunks                         | —                                    | 1,148 ms                             |

Mount time favors plain text first, with syntax colors applied progressively.
Colors never change text, so they never change geometry.

### Reproduced baseline bugs and their causes

All reproduced by `packages/tui/visual/navigation.visual.test.tsx`.

| Symptom                                                                                | Cause                                                                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Selecting a file after a 1,500-line wrapped file lands near line 862 of the long file. | Custom placeholders estimate height without wrapping. The real height replaces the estimate after the jump.        |
| Sticky-aligned jumps hide the target's first 3 rows.                                   | `ALIGN_SELECTED_FILE_SCROLL_OFFSET = 6` against a 3-row header.                                                    |
| `j`/`k` shows the header twice.                                                        | Two reveal modes disagree about where a file starts.                                                               |
| On first paint, the sticky header names the last file.                                 | Positions are read before any layout exists.                                                                       |
| `end` lands on the second-to-last file.                                                | There's no end spacer, so short trailing files can't top-align.                                                    |
| Jumping into a 3,000-line file blocks for ~1.5 s.                                      | Selecting a file forces whole-file syntax hydration on the main thread.                                            |
| ~75 ms per jump.                                                                       | Viewport metrics in React state re-render every card on every scroll, and lines are mounted as per-line box trees. |
| Viewport culling never applies.                                                        | All cards sit inside one inner `<box>`. OpenTUI culls only direct children of the scrollbox content.               |

## Implemented design

### Diff pane structure

```text
<scrollbox focused={false} contentOptions={{ paddingLeft, gap }}>
  <FileCard>                      direct child, so culling works
    title row, rename row
    gap row / hunk header row      1-row <box>
    <line-number lineNumbers lineColors lineSigns>
      <text content={chunk} wrapMode="word" />
    </line-number>                 one native buffer per chunk
    <ReviewThreadList />           between chunks, after anchored lines
    ...
  </FileCard>
  ...
  <box height={terminalHeight} flexShrink={0} />  end spacer, so any file can top-align
</scrollbox>
```

- **Chunks** are hunks, split again after any line with an anchored review
  thread so thread cards sit inline. Each split carries its own line-number
  map, so numbering stays correct.
- **Unified view:** `wrapMode="word"`. Word wrap, continuation alignment, and
  gutter colors on wrapped rows are all native.
- **Split view:** one row box per chunk with two
  `<line-number><text wrapMode="none">` sides. Rows align because pierre's
  `sideBySideRows` already pads the missing side, matching today's truncate
  behavior.
- **Colors:** chunk content starts as plain text, then becomes a `StyledText`
  built straight from pierre HAST through the existing color resolver. That
  keeps shiki-grade highlighting, word-level change backgrounds, and the
  pierre theme. Native `<diff>`/`<code>` are not used for highlighting: they
  bundle only 4 tree-sitter grammars and have no word diff.
- **Line state:** per-line adds/removes, the selected anchor, and comment
  annotation markers are all `<line-number>` `lineColors`/`lineSigns`. They
  update the native maps on one chunk and never touch layout. OpenTUI 0.1.92
  requires `setLineColors`/`setLineSigns` (and the corresponding numbering
  methods) for updates; JSX props alone only initialize those maps.
  `[`/`]` enables line selection, shown by an accent-colored `▶` before the
  line number and an accent background tint. Two fixed gutter cells keep the
  cursor separate from the `┃` comment marker without changing wrapping;
  addition/deletion signs remain visible. Selection starts hidden and hides
  again when changing files. Unified and split views share this indicator.
  `Shift+[` / `Shift+]` (`{` / `}`) add the previous/next line to a range,
  including counted extensions. Every selected line is tinted and marked `▎`;
  `▶` marks the newly extended edge. Ranges stay within one file, one hunk,
  and one GitHub side (RIGHT additions/context or LEFT deletions/context).
  Opposite-side changes are skipped, not included. Ordinary line/hunk jumps,
  file focus changes, and refreshed file snapshots clear the range. `a` opens
  a comment for the normalized range, with `startLine` / `startSide` and the
  final `line` / `side`; the composer shows the full range and its snippet.
- **Cost:** O(chunks) renderables, independent of line count. OpenTUI culls
  off-screen cards. Both file cards and tree rows are direct scrollbox children.
- **Flex sizing:** cards have `flexShrink={0}`. The end spacer uses the terminal
  height as a conservative fixed size, not `height="100%"`, which can consume
  the content height and shrink every diff body to its first row.
- **Fallback:** binary/empty/error placeholders remain. Patches without pierre
  metadata still use the existing native `<diff>` fallback.

### Geometry and navigation

These are the only invariants:

1. Layout depends only on content, width, view, and collapse/thread state. It
   never depends on scroll position or selection.
2. A file's position is `card.y - scroll.content.y`. A line's position is the
   chunk's position plus the first visual row whose `lineInfo.lineSources`
   entry equals the line.
3. **One canonical reveal.** `revealFile(path)` scrolls to the measured body
   position (or the card top when collapsed). The card header sits behind the sticky band
   naming file `i`, and the first diff row is at the top. `revealLine` takes a
   placement (`getLineRevealScrollTop`), applied instantly with no scroll
   animation:
   - `nearest`, for the `[`/`]` line cursor and `Shift+[`/`Shift+]` range edges:
     a fully visible line (every wrapped row) never scrolls. An off-screen line
     scrolls the least distance that shows it with up to 3 rows of context
     (`LINE_REVEAL_CONTEXT_ROWS`) past it. A move that would leave nothing of
     the previous viewport on screen, such as a counted jump, uses `jump`
     instead. A relayout re-runs the request from the viewport it started from.
   - `jump`, for hunk jumps (`gn`/`gp`) and line-number jumps: the line goes a
     third of the way down the viewport, clamped at the content start.
     Hunk navigation maps structural boundaries to review anchors, not indexes
     in the flattened diff. Counted and reverse jumps work across files.
4. **Scroll anchoring** is the single mechanism for layout changes such as
   collapse, view toggle, resize, refresh, threads loading, and comment
   collapse.
   - The viewport keeps an anchor `{ path, offsetInFile }`, updated on
     every scroll and every reveal.
   - On the root's public `layout-changed` event, fired after Yoga computes and
     before anything draws, it re-applies the anchor from Yoga's computed
     offsets via `getLayoutNode()`.
   - A reveal issued in the same commit as a layout change is just a new
     anchor, so it lands correctly on the very next frame without flicker.
   - Synchronize native viewport/content extents before revealing. A new line
     target also needs `updateFromLayout()` before reading its wrap map.
   - The initial anchor honors cached selection. Refresh preserves the viewport
     file even when selection is elsewhere; comparison switches can restore a
     different cached selection deliberately.
5. **Sticky file:** a `verticalScrollBar` `change` listener binary-searches
   card tops and calls `setState` only when the file index changes. Scrolling
   never re-renders the cards.
6. **Scrolling:**
   - The mouse wheel uses OpenTUI's native scrollbox behavior.
   - PageUp/PageDown and Ctrl+U/Ctrl+D call native `scrollBy` in viewport units.
     Arrow keys and j/k keep their file-navigation meaning.
   - The scrollbox is not focused, which removes today's double handling of
     arrow keys.
7. **Tree sidebar:** the same scrollbox, with 1-row items revealed by index
   arithmetic. It no longer reads row positions.

### Hydration

- Hydration is scheduled from measured visible cards, with collapsed files
  skipped and no scroll-driven React state loop.
- One lazy, reusable `node:worker_threads` worker runs a whole-file pierre/shiki
  job at a time. Both views are hydrated; plain buffers render immediately.
- `StyledText` replaces plain content directly, without React spans or an
  undefined `content` transition. Syntax and `data-diff-span` word backgrounds
  never change logical text or wrapping.
- Attempt tracking uses file identity, so unchanged refreshes can hydrate new
  objects. Stale results cannot overwrite replaced session files.
- The worker is disposed on session/theme changes or unmount. Its bundled
  `syntax-worker.mjs` entry is verified independently of source-mode tests.

### Deleted

The rewrite deletes:

- `unified-diff-virtualization.ts`
- the per-line row components in `diff-preview.tsx`, replaced by a chunk
  builder
- estimated-height placeholders and body visibility branches in `file-card.tsx`
- most of `use-app-preview.ts`
- the scroll half of `use-app-layout-effects.ts`

It also removes this state and these helpers:

- `diffViewportMetrics`, `fileCardPreviewViewports`, `fileCardBodyVisibility`,
  and `estimatedFileCardBodyHeights`
- `getFileTopOffsets` and `fileCardRefs`
- `treeRowRefs` position reads (`activeFileIndex` remains solely for sticky chrome)
- `pendingFileFocusRequestRef`, `lastScrolledSelectedFileIndexRef`, and
  `pendingSelectedDiffAnchorKeyRef`
- the four reveal modes, `getFileFocusScrollOffset`, and
  `ALIGN_SELECTED_FILE_SCROLL_OFFSET`
- the collapse metrics reset, `INITIAL_FILE_BODY_RENDER_COUNT`, and
  `GOTO_WINDOW_*` row estimates

## Feature parity checklist

Each item needs a visual or unit test before the old code is deleted.

| Feature                                                                | New home                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Unified/split views, syntax colors, word-level change backgrounds      | Chunk builder → `StyledText`; split as two native sides         |
| Line numbers, `+`/`-` signs, add/remove backgrounds                    | `<line-number>` `lineNumbers`/`lineSigns`/`lineColors`          |
| Hunk headers, `... N unchanged lines` gaps, hidden leading hunk header | 1-row boxes between chunks                                      |
| Inline review threads with collapse and selection                      | Chunks split after anchored lines; `ReviewThreadList` unchanged |
| Comment annotation markers, selected anchor highlight                  | `lineSigns.before` / `lineColors` on one chunk                  |
| Anchor, hunk, and line jumps (`]`/`[`, `gn`/`gp`, line jump)           | `revealLine` via `lineInfo.lineSources`                         |
| Sticky header, compact first card, reviewed/selected chrome            | Sticky band from scroll listener; card props                    |
| Collapse, reviewed-then-next, refresh keeps scroll position            | Scroll anchoring                                                |
| Binary, empty, render-error, and no-textual-diff placeholders          | Plain 1-row text in the card                                    |
| Deferred syntax hydration                                              | Viewport-driven worker jobs, geometry-neutral                   |
| `GOTO_WINDOW_TOP/CENTER/BOTTOM`                                        | Binary search over card tops at real viewport rows              |
| Selection copy                                                         | Native text buffer selection, with logical lines across wraps   |
| Tree ↔ diff sync                                                       | Sticky file index and tree reveal by index                      |

## Implementation map

- `components/diff-preview.tsx` and `diff-chunks.ts`: structural chunks and
  inline threads.
- `components/native-diff-chunk.tsx`: native buffers, gutters, annotations,
  selection colors, and line target refs.
- `app/layout/diff-scroll.ts`: measured geometry, canonical reveals, visible-card
  queries, and layout anchoring.
- `diff/preview-lines.ts`: cached geometry-identical plain previews.
- `app/layout/use-syntax-hydration.ts` and `diff/syntax-{hydrator,worker}.ts`:
  viewport scheduling and background syntax work.
- `visual/`: navigation/parity/lifecycle contracts, benchmark, and built-worker
  smoke test. `ready` and GitHub verification/release workflows run these gates.

## Testing

### Harness

`packages/tui/visual/` runs the real `DiffdiffApp` in OpenTUI's headless test
renderer under Bun. It uses real Yoga layout, real wrapping, and real
git/pierre loading against throwaway repositories.

- `HOME` is redirected in `visual/preload.ts`.
- `harness/app-harness.tsx` presses keys, resizes, paints until stable, and
  parses `{ stickyPath, rows }`. It reports first-frame latency, settle
  latency, extra frames after the first paint, and the renderable count.

Commands, from `packages/tui`:

- `vp run test:visual` — contract suite
- `vp run bench:visual` — benchmark (`-- --json` for machine-readable output)
- `FILE_COUNT=5000 vp run bench:visual` — extreme file-count benchmark
- `vp run test:worker-build` — built-worker smoke test (run the build first)
- `bun --preload ./visual/preload.ts ./visual/spikes/native-scrollbox.spike.tsx`
  — prototype (`PLAIN=1` for plain-text mount)

### Layers

1. **Contract** (`navigation.visual.test.tsx`).
   - Every go-to-file path puts the target's first diff row at the top, under
     a sticky header naming it, with zero extra frames.
   - Collapse and resize keep the view anchored.
   - Split view holds the same contract.
2. **Parity** (`parity.visual.test.tsx`). Threads inline, anchor highlight, line/hunk
   jumps, placeholders, rename, reviewed chrome, refresh scroll preservation,
   and wide characters/tabs. Each is asserted on painted frames.
3. **Model-based fuzz.** Random jumps, scrolls, collapses, view toggles, and
   resizes. After each step: sticky header == file owning the top row, jump
   targets sit at row 0, and there are zero extra frames.
4. **Performance.**
   - Gating, because it is deterministic: renderables ≤ `k × chunks` and
     independent of line count. Zero React commits during pure scrolling.
   - Reported: jump, page, mount, and hydration latencies at 240 files and at
     5,000 files.

### Baseline (before rewrite)

240 files, 8 of them 3,000-line wrapping files, 160×50. Harness overhead is
about 10 ms per frame.

| Action                   | p50       | p95        |
| ------------------------ | --------- | ---------- |
| No-op frame              | 10 ms     | 20 ms      |
| Diff next file (`j`)     | 94–101 ms | 1,479 ms   |
| Diff previous file (`k`) | 83 ms     | 485–509 ms |
| Tree next/previous file  | 83–88 ms  | 94–110 ms  |
| Page down                | 9 ms      | 11–19 ms   |

Renderables: 2,961 at launch, 3,228 max.

### Full-app measurements after rewrite

The 240-file fixture and 160×50 terminal match the baseline; these are full-app
results, not the faster prototype above. Timings include harness overhead and
background hydration. Wall-clock numbers are reported, not CI timing gates.

| Action                   | p50     | p95     |
| ------------------------ | ------- | ------- |
| No-op frame              | 4.6 ms  | 7.4 ms  |
| Diff next file (`j`)     | 10.7 ms | 19.0 ms |
| Diff previous file (`k`) | 10.9 ms | 16.4 ms |
| First/last file          | 10.2 ms | 11.7 ms |
| Tree next file           | 8.4 ms  | 13.3 ms |

Launch: ~887 ms, 3,151 renderables, with no distinct settling frames during
navigation. One file with 10 or 10,000 lines mounts the same number of native
renderables. Pure paging inside a file causes zero React commits.

At **5,000 files** (eight 3,000-line files), launch is ~5.6 s / 65,031 renderables;
next-file p50/p95 is ~192/212 ms, tree navigation ~100/125 ms, and paging ~34/67 ms.
Alignment still settles in the first frame. This exposes the linear native
layout/mount cost of mounting all cards, not line virtualization drift.

## Risks

- **Extreme file count remains slow.** Avoid reintroducing estimated-height
  windowing. Follow up on native incremental layout/culling and progressive
  mounting while preserving exact reveal geometry.
- **16 ms is a goal, not a proven bound.** The 240-file navigation p95 is close
  but not always below it; applying a large styled buffer still costs main-thread
  work even though tokenization runs in a worker.
- **Gutter width across chunks.** A file needs one width for every chunk.
  Compute it from the max line number per file and pass it as `minWidth`
  rather than syncing after paint.
- **Anchoring on `layout-changed`.** It depends on Yoga computed offsets being
  readable before draw. The harness's extra-frames metric verifies this
  directly.
