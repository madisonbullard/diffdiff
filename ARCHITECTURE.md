# Architecture

This document is the stable map for `diffdiff`: what the repository currently
contains, where boundaries live, and which artifact should be treated as the
source of truth for a given kind of change.

## Source-of-truth hierarchy

Read durable repository knowledge with progressive disclosure:

1. `AGENTS.md`
   - entry point and reading order for future agents
2. `README.md`
   - product overview, common commands, and high-level capabilities
3. `docs/README.md`
   - index of the documentation tree
4. `docs/agents/`
   - durable guidance for agent context and documentation maintenance
5. `docs/plans/` and `docs/todos/`
   - feature direction, interaction decisions, and follow-on implementation work
6. code and tests
   - executable truth

Add new knowledge at the lowest level that keeps it easy to discover.

## Workspace map

### Root

- `README.md`
  - user-facing overview of what `diffdiff` does.
- `AGENTS.md`
  - short routing layer for future agents.
- `ARCHITECTURE.md`
  - this file.
- `vite.config.ts`
  - repo-wide Vite+ lint and staged-check configuration.
- `pnpm-workspace.yaml`
  - workspace package definitions and shared catalog versions.

### Packages

- `packages/core`
  - reusable repository, diff, session, logging, preferences, and GitHub review
    functionality.
- `packages/tui`
  - the `diffdiff` CLI and terminal UI implementation.

### Documentation

- `docs/README.md`
  - documentation index.
- `docs/agents/`
  - agent-focused continuity and maintenance docs.
- `docs/plans/`
  - cross-cutting feature direction and durable implementation plans.
- `docs/todos/`
  - narrower, versioned implementation slices for ongoing TUI and CLI work.

### Repo-local skills

- `.agents/skills/`
  - procedural guidance that is too step-oriented for the main docs.

## Package boundaries

### `packages/core`

`packages/core` owns reusable logic that should not depend on the terminal UI.
Today that includes:

- repository detection and git-backed comparison loading
- patch parsing and branch metadata helpers
- GitHub auth, client construction, and pull-request review services
- diffdiff preferences, review cache, and review-session fingerprints
- per-session JSONL logging and session metadata under `~/.diffdiff/`
- shared types for startup options, review sessions, providers, and GitHub data

If a future client other than the TUI would need the behavior, it likely belongs
here first.

### `packages/tui`

`packages/tui` owns the terminal-specific client:

- the Commander CLI entrypoint and startup option wiring
- launch-target resolution and startup orchestration
- terminal theme, syntax highlighting, and renderer setup
- app state, keyboard handlers, dialogs, layout, and focus management
- diff rendering and review interaction surfaces

`packages/tui` should depend on `packages/core` for repository and GitHub data
instead of re-implementing those concerns locally.

## Runtime flow

At a high level, the current runtime flow is:

1. `packages/tui/src/cli.tsx` parses the command line and resolves the launch
   target.
2. `packages/core` resolves the repository, loads the review session, and
   attaches GitHub review context when available.
3. `packages/tui` renders the session in the OpenTUI/React app and manages
   keyboard-driven review workflows.
4. `packages/core` persists session metadata, logs, auth state, preferences, and
   review cache across runs.

This split is deliberate: data acquisition and shared review behavior live in
`core`, while rendering and interaction live in `tui`.

## Extension guidance

- New repository or forge integrations should start in `packages/core`.
- New TUI commands, overlays, keymaps, and layout behavior should stay in
  `packages/tui` unless they expose reusable domain logic.
- If a new feature introduces durable user state that matters outside one screen,
  prefer storing it in `packages/core` preferences or session/cache utilities.
- Keep docs aligned with code shape. If package boundaries change, update this
  file in the same patch.

## Current durable directions

- `diffdiff` is terminal-first. Rich keyboard workflows are part of the product,
  not incidental implementation detail.
- GitHub integration should continue to expose reusable capabilities from
  `packages/core` so other clients can reuse the same review and auth logic.
- Session logs and metadata are part of the normal local debugging workflow, and
  `diffdiff session` is the supported way to inspect them.
