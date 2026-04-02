# Local TUI Automation Surface

## Summary

OpenCode exposes server routes that can drive TUI actions externally. Diffdiff already has strong local session tracking and structured logs, so there is an opportunity to expose a small local control surface for automation and editor integration later.

## Why This Is Worth Stealing

- Diffdiff is already session-aware.
- A local automation surface could make the TUI easier to integrate with shells, editors, or future helper tools.
- This would extend the usefulness of the app without changing the core review workflow.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/server/routes/tui.ts`
  Shows a commandable TUI with actions like appending input, opening dialogs, and executing commands.
- `../opencode/packages/opencode/src/cli/cmd/tui/app.tsx`
  Demonstrates that many TUI actions are already modeled as commands, which makes remote triggering simpler.

## Relevant Diffdiff Touchpoints

- `packages/core/src/logging.ts`
  Strong local session metadata, session IDs, and JSONL logs.
- `README.md`
  Documents session list and session management commands.
- `packages/tui/src/cli.tsx`
  Entry point that could eventually grow automation-adjacent commands.
- `packages/tui/src/review-anchors.ts`
  Useful if a future automation surface ever needs to target specific reviewable lines.

## Good Fit Ideas To Steal

- Keep any future surface local-only at first.
- Focus on review-centric actions such as opening a session, focusing a file, jumping to an anchor, or opening a known modal.
- Reuse the command model for external triggering if the command registry becomes more central.

## Cautions

- This is a longer-horizon capability, not the first thing to build.
- Avoid inventing a broad API before clear integration use cases exist.
- Any local control surface should be deliberate about lifecycle and security boundaries.
