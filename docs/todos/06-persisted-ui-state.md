# Persisted UI State

## Summary

OpenCode uses a tiny shared KV store for persisting lightweight TUI preferences. Diffdiff already persists meaningful data like review cache and GitHub preferences, but not much generic UI state. There is room to add a small persistence layer for TUI ergonomics without changing the core review model.

## Why This Is Worth Stealing

- Review sessions are repetitive, and users tend to settle on a preferred layout.
- Diffdiff already saves higher-value state, so the app has the right product shape for small persisted UI preferences.
- This is a relatively low-risk quality-of-life improvement.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/context/kv.tsx`
  A small `kv.json` store with `get`, `set`, and `signal()` for reactive persisted values.
- `../opencode/packages/opencode/src/cli/cmd/tui/app.tsx`
  Uses KV-backed state for settings like terminal title and other app-level toggles.
- `../opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx`
  Uses shared persisted state as part of the theme experience.

## Relevant Diffdiff Touchpoints

- `packages/core/src/review-cache.ts`
  Already persists review progress keyed by repo and comparison.
- `packages/core/src/preferences.ts`
  Already persists user-level GitHub preferences.
- `packages/tui/src/app/DiffdiffApp.tsx`
  Manages a lot of ephemeral state that could be made sticky.

## Good Fit Ideas To Steal

- Add a tiny KV-style store for TUI preferences that are not review-cache-specific.
- Good early candidates include diff view preference, sidebar visibility, key legend visibility, outdated-thread visibility, and other purely local presentation toggles.
- Keep review cache and UI state separate so the meaning of each persistence layer stays clear.

## Cautions

- Do not collapse review state, GitHub preferences, and generic UI state into one file unless there is a strong reason.
- Persist only settings that feel stable and user-owned.
- Avoid saving transient modal state or highly situational selections unless that behavior is clearly helpful.
