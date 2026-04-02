# Dialog Stack And Overlay Manager

## Summary

OpenCode has a cleaner modal system than diffdiff. It centralizes dialog state, remembers focus, supports replace and clear operations, and handles Escape and copy-selection interactions more carefully. Diffdiff currently tracks many overlays as booleans and derives the active overlay separately.

## Why This Is Worth Stealing

- Diffdiff already has a substantial overlay surface.
- A dialog manager would simplify state flow in the main app.
- This would reduce the chance of awkward modal interactions and make future overlays cheaper to add.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/ui/dialog.tsx`
  Central stack state, focus restoration, dialog sizing, and selection-aware Escape behavior.
- `../opencode/packages/opencode/src/cli/cmd/tui/feature-plugins/system/plugins.tsx`
  A good example of code using the dialog manager to swap between list and install flows.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/app/DiffdiffApp.tsx`
  Tracks many overlay booleans such as help, branch modal, command palette, review composer, submit review, merge, cleanup, and comments.
- `packages/tui/src/app/layout.tsx`
  Mirrors much of the same overlay-driven rendering.
- `packages/tui/src/components/help-modal.tsx`
- `packages/tui/src/components/command-palette-modal.tsx`
- `packages/tui/src/components/branch-modal.tsx`
- `packages/tui/src/review/review-composer-modal.tsx`

## Good Fit Ideas To Steal

- Replace the boolean-per-modal model with a single dialog controller.
- Add a small notion of stack depth or replace semantics rather than supporting arbitrary nesting everywhere.
- Preserve focus when dialogs close.
- Copy OpenCode's selection-aware Escape behavior if it fits diffdiff's selection UX.

## Cautions

- Diffdiff does not necessarily need fully nested dialogs right away.
- The main win is simplifying state ownership in the app, not adding modal complexity.
- A stack should not become a substitute for route or workflow modeling where a simpler state machine would do.
