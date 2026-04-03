# Sidebar As Review Dashboard

## Summary

OpenCode treats the sidebar as a compact summary surface, not just a navigation area. Diffdiff already has a strong file tree sidebar, but there is room to make it a richer review dashboard without losing the current navigation value.

## Why This Is Worth Stealing

- Diffdiff users are doing focused review work and benefit from dense summary information.
- The sidebar is already a natural place for progress, counts, and current-file context.
- This could improve situational awareness without touching the main diff pane much.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`
  The sidebar is a host area that supports structured sections.
- `../opencode/packages/opencode/src/cli/cmd/tui/feature-plugins/sidebar/files.tsx`
  A simple collapsible summary block for modified files and add/delete counts.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/components/file-tree-sidebar.tsx`
  Current sidebar tree and review-state display.
- `packages/tui/src/view-model.ts`
  Contains many of the review summaries and tree-derived helpers.
- `packages/tui/src/review/banner.tsx`
  Holds useful PR metadata that could potentially be echoed in a denser sidebar form.
- `packages/tui/src/app/DiffdiffApp.tsx`
  Coordinates current file, reviewed state, collapsed state, and sidebar width.

## Good Fit Ideas To Steal

- Split the sidebar into a few small sections rather than one monolithic tree area.
- Add compact review-centric summaries such as unreviewed files, files with comments, or files with parsing fallbacks.
- Keep the tree as the main interactive section, but let the rest of the sidebar act as a dashboard.
- Borrow the collapsible-section feel from OpenCode's sidebar blocks.

## Cautions

- The sidebar should stay useful on narrower terminals.
- Avoid turning it into a second full-screen app.
- Summary blocks should be directly useful for review decisions, not generic status noise.
