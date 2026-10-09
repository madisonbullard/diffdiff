# Incremental Refresh And Rendering

## Summary

The native viewport rewrite removed estimated-height windowing and moved syntax
hydration into a worker. Navigation is now reliable and much faster at hundreds
of files. Whole-session refreshes and native mount/layout cost at thousands of
files remain opportunities for incremental reconciliation.

## Why This Is Worth Stealing

- Large diffs and many changed files are a natural stress case for diffdiff.
- The current code already shows awareness of performance, which means there is a good foundation to build on.
- This category matters more for scale than for feature count.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/context/sync.tsx`
  Incremental event reconciliation, sorted insertion, and bounded history behavior.
- `../opencode/packages/opencode/src/cli/cmd/tui/app.tsx`
  Renderer configuration and a generally more explicit split between app shell and synced state.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/app/DiffdiffApp.tsx`
  Refreshes git state on terminal focus and coordinates a large amount of render-sensitive behavior.
- `packages/tui/src/diff/prepare-review-session.ts`
  Important part of the diff preparation pipeline.
- `packages/tui/src/components/file-card.tsx`
- `packages/tui/src/components/diff-preview.tsx`
- `packages/tui/src/view-model.ts`
  Contains many derived structures and ordering helpers that affect render behavior.

## Good Fit Ideas To Steal

- Separate cheap metadata refresh from expensive diff-body refresh where practical.
- Favor bounded caches and incremental updates for derived state when full reloads are unnecessary.
- Preserve the current fallback-first attitude around expensive diff rendering.

## Cautions

- This is one of the hardest areas to change without regressions.
- Diffdiff's sticky headers, inline review threads, and tree-to-diff ordering all make rendering changes delicate.
- Build on the invariants and 5,000-file measurements in
  `../plans/diff-viewport-navigation.md`. Investigate incremental native layout
  and session reconciliation without recreating estimated-height windowing.
