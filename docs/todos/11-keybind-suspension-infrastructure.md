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

## Current Diffdiff Reality

- `packages/tui/src/app/DiffdiffApp.tsx` owns `leaderActive`, `leaderTimeoutRef`, `enterLeaderMode()`, and `clearLeaderMode()` directly.
- `keyboardHandlerRef.current` in `DiffdiffApp` hard-switches across overlays first, then falls through to leader handling, command dispatch, and pane navigation.
- Text-entry flows such as `handleCommandModalKey`, `handleCommentComposerKey`, `handleSubmitReviewModalKey`, `handleMergeModalKey`, the PR-list search mode, and the branch commit-search mode all implement their own inline key capture.
- Tree and diff focus are currently controlled only through `focused={activeOverlay == null && activePane === ...}` on the two main `scrollbox` elements. Leader mode does not currently remember and restore the actual focused renderable.
- `packages/tui/tests/app.test.tsx` already exercises command palette opening, leader commands, modal focus removal, comment composition, submit review, and merge flows, so the existing test harness is strong enough to cover this refactor.

## Proposed Shape

- Keep `packages/tui/src/commands.ts` as the low-level parse, match, and format layer. This todo is about state and dispatch policy, not a new binding syntax.
- Add a small app-local keybind controller module, likely `packages/tui/src/app/keybind-controller.ts` or `use-keybind-controller.ts`, instead of importing a larger provider stack from OpenCode.
- The controller should own:
  - leader-mode state and timeout
  - a ref-counted suspension count for global command dispatch
  - the previously focused renderable during leader capture so focus can be blurred and restored safely
  - a tiny API surface such as `enterLeaderMode()`, `clearLeaderMode()`, `suspendGlobalKeybinds()`, `resumeGlobalKeybinds()`, and `globalKeybindsSuspended()`
- `DiffdiffApp` should remain the single `useKeyboard()` registration point in the first pass. The goal is to make the keyboard pipeline explicit and reusable without forcing every modal to grow its own keyboard hook immediately.
- Prefer a scoped or ref-counted suspension API over a plain boolean so nested surfaces like branch -> list-filter or comments -> reply composer cannot accidentally re-enable global shortcuts too early.

## Implementation Plan

1. Extract leader handling into a controller.

- Move `leaderActive`, timeout management, and the leader status copy out of the middle of `DiffdiffApp` and into a small app helper.
- On leader entry, snapshot `renderer.currentFocusedRenderable`, blur it, and restore it on timeout or completion if nothing else has claimed focus.
- Keep the current leader timeout behavior and status messages so the user-visible behavior stays familiar.

2. Split surface-local key handling from global command dispatch.

- Reshape the `DiffdiffApp` keyboard pipeline so local surface handlers run first and return whether they consumed the key.
- After local handling, only run leader matching, command-list matching, app command dispatch, and pane navigation when global keybinds are not suspended.
- Do not route tree and diff navigation through a new abstraction. Keep the existing fast path for those flows in `DiffdiffApp`.

3. Add a ref-counted suspension mechanism.

- Implement `suspendCount` semantics similar to OpenCode's `dialog-command.tsx` so suspension is nest-safe.
- Expose a minimal API that lets the app enter or leave suspension deliberately when an input surface becomes active.
- Clear leader mode whenever a suspending surface opens so typed input never inherits a half-active multi-stroke command state.

4. Wire the first suspending consumers explicitly.

- Whole-surface suspension: `command-palette`, `comment-composer`, `submit-review`, and `merge`.
- Mode-specific suspension: `pullRequestSearchActive` and `commitSearchActive`, since those are true text-entry states embedded inside otherwise navigational overlays.
- Leave purely navigational overlays such as help, cleanup, comments, list-filter, and non-search branch browsing on the existing local handling path in the first pass unless testing shows they need suspension too.
- Keep the dialog-stack restore-parent behavior unchanged. Suspension should compose with the dialog stack, not replace it.

5. Reduce special cases gradually.

- Introduce a small derived helper for overlay or mode suspension rather than scattering more `activeOverlay === ...` checks through the keyboard handler.
- Do not try to move all text-editing state into modal components in the same change. `DiffdiffApp` can keep owning composer state while the infrastructure gets introduced.
- If a provider becomes useful later for slash input or configurable keybind settings, build it on top of the controller after this refactor lands.

6. Verify with focused tests.

- Add a unit test for the new controller if it has enough pure behavior to justify one.
- Extend `packages/tui/tests/app.test.tsx` to cover:
  - leader entry and timeout while focus is on the main diff/tree surface
  - opening a suspending surface while leader mode is active
  - typed characters in command palette, review composer, submit review, merge, PR search, and commit search not triggering global commands
  - nested dialog restore behavior not re-enabling global shortcuts too early
  - focus returning to the correct main surface after a suspending overlay closes

## Likely File Touchpoints

- `packages/tui/src/app/DiffdiffApp.tsx`
- `packages/tui/src/app/dialog-stack.ts`
- `packages/tui/src/commands.ts`
- likely new `packages/tui/src/app/keybind-controller.ts`
- possibly `packages/tui/src/app/layout.tsx` if any modal props or status text need to reflect the new behavior
- `packages/tui/tests/app.test.tsx`
- likely new `packages/tui/tests/keybind-controller.test.ts`

## Acceptance Criteria

- Leader-mode state and timeout logic no longer live as ad hoc inline infrastructure inside `DiffdiffApp`.
- Global command dispatch can be suspended and resumed via a nest-safe API.
- Command palette, review composition, submit review, merge, and active search modes do not leak typed keys into global shortcuts.
- Entering leader mode blurs the previously focused renderable, and focus is restored reliably when leader mode exits without another surface claiming focus.
- Existing tree and diff navigation behavior remains unchanged when no suspending surface is active.
- Existing dialog-stack restore-parent behavior continues to work for nested overlays.
