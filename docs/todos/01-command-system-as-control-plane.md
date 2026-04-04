# Command System As Control Plane

## Summary

OpenCode treats commands as the main action layer for the TUI. The same command definition can power the command palette, slash commands, keybinds, and plugin-triggered actions. Diffdiff already has the beginnings of this pattern, but command behavior is still split between reusable helpers and app-local wiring.

## Why This Is Worth Stealing

- Diffdiff is already keyboard-first and action-dense.
- Review tools benefit from one canonical place to define action titles, availability, discoverability, and shortcuts.
- This would reduce the amount of app logic currently living directly in `packages/tui/src/app/DiffdiffApp.tsx`.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/component/dialog-command.tsx`
  Central command registration, visibility filtering, keybind dispatch, slash command exposure, palette display, a trigger-by-id API, and suggested-command promotion under a dedicated category.
- `../opencode/packages/opencode/src/cli/cmd/tui/app.tsx`
  The app shell relies on the command system for a wide range of global actions via `CommandProvider`, which keeps command execution separate from most app-screen logic.
- `../opencode/packages/opencode/src/cli/cmd/tui/context/keybind.tsx`
  Leader-key state, keybind printing, parsed-key matching, and focus-aware leader-mode handling that temporarily blurs focused elements while waiting for the second key.
- `../opencode/packages/web/src/content/docs/tui.mdx`
  User-facing docs show that slash commands and keybinds are part of the same command vocabulary and are documented from one conceptual action surface.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/commands.ts`
  Already has key parsing, matching, formatting, and palette filtering.
- `packages/tui/src/app/command-registry.ts`
  Already has a good extracted `buildAppCommands()` function, which looks like the right direction.
- `packages/tui/src/app/DiffdiffApp.tsx`
  Still owns a lot of command execution and command-adjacent state directly.

## Good Fit Ideas To Steal

- Finish consolidating app actions behind `buildAppCommands()` or an equivalent single registry.
- Let command definitions remain the source of truth for palette rows, keybind labels, and future slash-style actions.
- Keep command availability contextual, especially for GitHub-only actions.
- Use the command layer for higher-level review actions such as jumping to the next unreviewed file, opening a selected file quickly, toggling view modes, and opening GitHub workflows.
- Mirror OpenCode's `trigger(name)` idea so command ids stay stable even when the initiating UI surface changes.
- Mirror OpenCode's suggested-command grouping so the palette has a clearer first-run and low-query browsing mode.
- Mirror OpenCode's docs/help consistency by deriving user-facing shortcut help from command metadata instead of maintaining a separate static shortcut list.

## Cautions

- Diffdiff does not need OpenCode's full general-purpose command surface.
- The win is consistency, not a larger feature set for its own sake.
- This should stay review-centric rather than turning the app into a generic shell.
- OpenCode's command provider also supports plugin-time registration via reactive owners. Diffdiff should only adopt that piece if a concrete extensibility surface materializes.
