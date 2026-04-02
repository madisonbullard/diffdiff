# Slot-Based Extensibility

## Summary

The most interesting long-term architectural idea in OpenCode is not the full plugin manager. It is the typed slot system that lets the host app expose specific insertion points while staying in control of the overall layout. That is a better fit for diffdiff than a large plugin platform.

## Why This Is Worth Stealing

- Diffdiff has a clear primary workflow and should probably keep the host UI in charge.
- Slot-style extension points would let future experiments or internal features grow without bloating the main app file.
- This creates a path to modularity that does not require turning diffdiff into a generic TUI host overnight.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/plugin/slots.tsx`
  Typed slot registry over the real renderer.
- `../opencode/packages/opencode/specs/tui-plugins.md`
  Documents the slot and plugin surface and makes clear that internal features use the same architecture.
- `../opencode/packages/opencode/src/cli/cmd/tui/routes/home.tsx`
  Good example of replace-style slots for a host-owned screen.
- `../opencode/packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`
  Good example of additive slot areas in a host-owned layout.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/app/DiffdiffApp.tsx`
  The current concentration point for many app concerns.
- `packages/tui/src/app/layout.tsx`
  Useful as a potential host-owned surface for future insertion points.
- `packages/tui/src/components/file-tree-sidebar.tsx`
- `packages/tui/src/review/banner.tsx`

## Good Fit Ideas To Steal

- Start with host-owned slots only.
- Favor narrow extension points such as sidebar header, sidebar summary, diff header metadata, or footer/status surfaces.
- If internal features are extracted later, let them use the same slot mechanism so the architecture gets dogfooded early.

## Cautions

- Do not start with a full external plugin install/runtime story unless there is a strong product reason.
- The win here is modularity and controlled extensibility, not third-party ecosystem work.
- Keep the core review workflow canonical and stable.
