# Configurable Keybinds

## Summary

OpenCode has a stronger keybinding layer than diffdiff. It supports host-level parsing, printable keybind labels, leader-key semantics, and configuration-driven overrides. Diffdiff already has a capable parser, but the current setup is still mostly hardcoded inside the app.

## Why This Is Worth Stealing

- Review workflows accumulate shortcuts quickly.
- Terminal users often have strong preferences around leader keys and collisions.
- A configurable system would make help text, command palette footers, and docs more reliable.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/context/keybind.tsx`
  Handles leader mode, temporarily blurs focused elements during leader capture, and provides shared parse, match, and print helpers.
- `../opencode/packages/opencode/src/config/tui-schema.ts`
  Supports keybind overrides in TUI config.
- `../opencode/packages/web/src/content/docs/tui.mdx`
  Documents the default leader key and ties it to the command model.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/commands.ts`
  Already provides the core parsing and formatting primitives.
- `packages/tui/src/app/DiffdiffApp.tsx`
  Defines `ctrl+x` as the leader key directly and manages leader behavior locally.
- `packages/tui/src/app/command-registry.ts`
  Contains many command definitions whose keybinds could become configurable without changing their meanings.

## Good Fit Ideas To Steal

- Add a small preferences or config-backed keybind override layer.
- Keep the existing keybind string format and extend it rather than replacing it.
- Adopt the focus-handling idea from OpenCode's leader mode so multi-stroke shortcuts do not fight text inputs.
- Use one shared printer for the help modal, command palette, and any future docs generation.

## Cautions

- Diffdiff probably does not need the full OpenCode config model.
- A lightweight override mechanism is likely enough at first.
- Avoid introducing a separate binding language if the current string format can carry the feature.
