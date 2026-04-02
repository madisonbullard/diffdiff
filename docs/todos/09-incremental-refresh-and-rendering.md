# Incremental Refresh And Rendering

## Summary

OpenCode has stronger incremental state reconciliation patterns than diffdiff. Diffdiff already has good startup and deferred-rendering instincts, but it still leans on whole-session refreshes and a large central app component. If large reviews become a pain point, this is where the biggest structural improvements likely live.

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
- A lot of value can come from smaller incremental improvements before considering anything like virtualization.
