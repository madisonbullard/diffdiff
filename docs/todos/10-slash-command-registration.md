# Slash Command Registration

## Summary

OpenCode treats slash commands as another view over the same command registry used by keybinds and the command palette. Diffdiff's command model is now much closer to that structure, so adding slash-command registration would be a natural next step and would keep action naming, discoverability, and future automation aligned.

## Why This Is Worth Stealing

- Slash commands are a concise action vocabulary for keyboard-first users.
- Diffdiff already has stable command ids and command metadata, so the marginal architecture cost is now much lower than it would have been earlier.
- A slash surface would create a clean bridge between today's palette/keybind UX and any future local automation or editor integration.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/component/dialog-command.tsx`
  Defines a `slash` field directly on command options, exposes a `slashes()` projection over visible commands, and routes slash execution back through the same `trigger(option.value)` path used by other command surfaces.
- `../opencode/packages/web/src/content/docs/tui.mdx`
  Documents slash commands and keybinds as one shared command vocabulary rather than separate systems.
- `../opencode/packages/opencode/src/cli/cmd/tui/app.tsx`
  Shows that command invocation is app-global, so slash commands do not need their own bespoke action handlers.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/app/command-registry.ts`
  Now holds most of the app action definitions and stable command ids.
- `packages/tui/src/commands.ts`
  Already contains the core matching and formatting primitives, and can be extended with slash metadata without inventing a separate action model.
- `packages/tui/src/app/DiffdiffApp.tsx`
  Already has `runCommandByValue()`, which is the right seam for a slash layer.
- `docs/todos/08-local-tui-automation-surface.md`
  A future automation surface will benefit if command ids and slash names stay aligned.

## Good Fit Ideas To Steal

- Add optional slash metadata directly to command definitions instead of inventing a parallel slash registry.
- Treat slash commands as a filtered projection over visible commands, like OpenCode's `slashes()` helper.
- Route slash execution through command ids so palette, keybinds, slash commands, and future automation all share one execution path.
- Support lightweight aliases for especially common review actions such as `/help`, `/list`, `/review`, or `/comments`.
- Keep slash names review-centric and action-oriented rather than exposing every internal command id verbatim.

## Cautions

- Diffdiff does not currently have a freeform prompt surface like OpenCode, so the first slash integration point needs to be explicit.
- Avoid shipping a partial slash grammar that competes with review text entry inside composers.
- Slash names should be stable once introduced because they are likely to become muscle memory and integration points.

## OpenCode Inspiration Notes

- The key architectural idea to copy is not just "support `/help`". It is OpenCode's pattern where slash commands are metadata on the canonical command record and are resolved back through a stable command id.
- The strongest reference is `../opencode/packages/opencode/src/cli/cmd/tui/component/dialog-command.tsx`, especially:
  - the `slash?: Slash` field on `CommandOption`
  - the `slashes()` helper that derives slash entries from visible commands
  - the `trigger(name)` helper that runs the command by stable id
- The strongest product reference is `../opencode/packages/web/src/content/docs/tui.mdx`, where slash commands and keybinds are documented as the same action vocabulary.
