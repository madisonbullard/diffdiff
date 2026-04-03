# Terminal Ergonomics And Debugging

## Summary

OpenCode has a collection of terminal-native quality-of-life features that make the app feel more polished and more operable when something goes wrong. Diffdiff already does well on theme adaptation, clipboard support, and structured logs, but there are still a few useful ideas worth borrowing.

## Why This Is Worth Stealing

- Terminal apps benefit disproportionately from good copy behavior, title handling, and debugging affordances.
- Diffdiff is already strong on local observability, so adding a few more operator-friendly features would compound nicely.
- These improvements are often lower risk than deeper architecture work.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/app.tsx`
  Renderer config, terminal title handling, debug overlay toggles, console toggles, suspend behavior, and heap snapshot commands.
- `../opencode/packages/opencode/src/cli/cmd/tui/ui/dialog.tsx`
  Strong selection and copy behavior around overlays.
- `../opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx`
  A more mature theme system with layering, adaptive contrast logic, and a broader theme surface.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/theme.ts`
  Already has terminal background probing and palette-adaptive theming.
- `packages/tui/src/selection-copy.ts`
- `packages/tui/src/clipboard.ts`
- `packages/tui/src/app/DiffdiffApp.tsx`
  Already handles clipboard actions and selection-copy behavior.
- `packages/core/src/logging.ts`
  Gives diffdiff a strong debugging baseline that pairs well with better terminal ergonomics.

## Good Fit Ideas To Steal

- Terminal title support is a particularly good fit because diffdiff sessions are tied to repo and comparison context.
- Better selection-aware Escape and copy behavior around overlays is also a strong fit.
- If debugging painful rendering cases becomes common, a lightweight debug overlay or console toggle could be worth adding.

## Cautions

- These should stay optional and not clutter the default review experience.
- Debug features are most valuable when they reuse existing logging and session state instead of inventing a parallel diagnostics system.
- Theme-system work should stay in service of diff readability rather than theme count alone.
