# Keybind Suspension Infrastructure

## Summary

OpenCode has a small but important piece of infrastructure around keybind suspension and leader-mode focus handling. The point is not just nicer internals. It prevents multi-stroke keybind capture from fighting focused inputs and gives overlays or text-entry surfaces a clean way to opt out of global shortcuts temporarily. Diffdiff currently handles dialogs through ad hoc branching in `DiffdiffApp`, which works, but it is less explicit and less reusable.

## Why This Is Worth Stealing

- Diffdiff already has several text-entry and modal surfaces: command palette, review composer, submit review, merge, branch filtering.
- Multi-stroke shortcuts become more fragile as the app grows more focused inputs.
- A suspension mechanism would make future slash input, configurable keybinds, and richer composers easier to ship safely.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/component/dialog-command.tsx`
  Tracks a `suspendCount`, skips command dispatch while suspended, and exposes a `keybinds(enabled: boolean)` API so other surfaces can suspend or resume command handling deliberately.
- `../opencode/packages/opencode/src/cli/cmd/tui/context/keybind.tsx`
  Stores leader-mode state, blurs the currently focused renderable when leader mode starts, restores focus on exit or timeout, and centralizes parsed-key matching and printed labels.
- `../opencode/packages/opencode/src/cli/cmd/tui/app.tsx`
  Demonstrates how the global keyboard pipeline composes multiple concerns while still respecting focus and dialog state.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/app/DiffdiffApp.tsx`
  Currently owns leader-mode timing and most overlay-specific keyboard branching directly.
- `packages/tui/src/commands.ts`
  Already contains parsing, matching, and formatting helpers that a suspension layer could build on.
- `packages/tui/src/components/command-palette-modal.tsx`
  A good first consumer because it behaves like an input-focused surface.
- `packages/tui/src/review/review-composer-modal.tsx`
- `packages/tui/src/review/submit-review-modal.tsx`
- `packages/tui/src/review/merge-pull-request-modal.tsx`

## Good Fit Ideas To Steal

- Add a tiny command/keybind context that can suspend global command dispatch while a focused input surface is active.
- Move leader-mode state out of `DiffdiffApp` into a reusable keybind helper or context.
- Adopt OpenCode's focus-handling pattern when leader mode starts so the currently focused renderable does not keep consuming input.
- Let overlays and composers opt into suspension explicitly instead of relying only on a large top-level keyboard switch statement.
- Keep the API small: something like `suspendKeybinds()` / `resumeKeybinds()` or scoped enter/exit helpers is probably enough.

## Cautions

- Diffdiff does not need OpenCode's entire provider stack to get the benefit.
- Do not break the existing fast-path keyboard flow for tree and diff navigation just to make the abstraction cleaner.
- Focus restoration has to be reliable or the result will feel worse than the current direct handling.

## OpenCode Inspiration Notes

- The key implementation reference is `../opencode/packages/opencode/src/cli/cmd/tui/context/keybind.tsx`, especially:
  - storing leader state centrally
  - remembering the focused renderable before entering leader mode
  - blurring on leader entry and restoring focus on timeout or completion
- The command-side complement is `../opencode/packages/opencode/src/cli/cmd/tui/component/dialog-command.tsx`, especially:
  - `suspendCount`
  - `suspended()` checks inside keyboard handlers
  - the explicit `keybinds(enabled: boolean)` toggling API
- Together those files show a useful split: key parsing and leader behavior live in one place, while command dispatch can be suspended independently by higher-level UI surfaces.
