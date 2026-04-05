# AGENTS.md

## Purpose

`diffdiff` is a git-backed terminal code review tool. It compares working tree
changes or explicit refs, renders them in a TUI, and can perform GitHub PR
review actions when authenticated.

This file is the entry point for future agents, not the full manual. Use it as
the table of contents for the repository's durable knowledge.

The current scope is intentionally focused:

- a reusable `packages/core` layer for repository, session, logging, and GitHub
  review logic
- a terminal-first client in `packages/tui`
- local session metadata and JSONL logs for diagnostics and continuity

## Start Here

Read these in order before making non-trivial changes:

1. `README.md`
2. `ARCHITECTURE.md`
3. `docs/README.md`
4. `docs/agents/README.md`

Then load the smallest task-specific source of truth:

- GitHub PR workflow direction: `docs/plans/gh-integration.md`
- focused implementation slices and backlog: `docs/todos/`
- agent context and maintenance guidance: `docs/agents/`

## Current Architecture Guardrails

- Keep reusable repository, comparison, session, logging, auth, and GitHub
  logic in `packages/core` so future non-TUI clients can share it.
- Keep the `packages/tui` CLI/bootstrap layer thin; place app behavior under
  `packages/tui/src/app`.
- Treat `diffdiff session` commands as the source of truth for local session
  metadata and log locations instead of guessing file paths from the filesystem.
- Preserve the terminal-first interaction model already reflected in the code
  and plans. New workflows should fit the keyboard-driven TUI unless the
  governing docs are updated deliberately.

<!--VITE PLUS START-->

## Tooling

- Read `README.md` early in each session to understand `diffdiff` capabilities
  and expected behavior.
- This repo uses Vite+ via the `vp` CLI.
- Use `vp` for package management and tooling. Do not use `npm`, `pnpm`,
  `yarn`, or `npx` directly.
- `vp dev`, `vp build`, `vp test`, `vp lint`, and similar commands run Vite+
  built-ins, not `package.json` scripts. Use `vp run <script>` for custom
  scripts.
- Import tooling APIs from `vite-plus` and `vite-plus/test`, not from `vite`
  or `vitest`.
- Do not install wrapped tools like `vitest`, `oxlint`, or `oxfmt` directly.

<!--VITE PLUS END-->

## Knowledge Base Rules

- Keep `AGENTS.md` short. Put stable detail in `ARCHITECTURE.md`, `docs/`, or a
  repo-local skill.
- When behavior changes, update the source-of-truth doc in the same change.
- Prefer progressive disclosure: add indexes and cross-links before adding long
  prose.
- Delete or rewrite stale guidance instead of layering contradictory notes on
  top.

## Local Skill

- `.agents/skills/maintain-agent-context/SKILL.md`: use when a task is about
  updating repo docs, improving agent context, refreshing `AGENTS.md`, or
  adding repo-local skills.

## Commands

- Show the CLI surface area: `diffdiff -h`
- List sessions for machine-readable log paths: `diffdiff session list --json`
- List sessions for a quick summary: `diffdiff session list`
- Remove one session and its log: `diffdiff session remove <session-id>`
- Remove all recorded sessions and logs: `diffdiff session remove-all`
- Build the packages: `vp run build -r`
- Run tests: `vp run test -r`
- Run the repo readiness suite: `vp run ready`
- Launch the TUI after building: `bun packages/tui/dist/cli.mjs tui`

When you need to visually inspect the TUI, use `ht-mcp` to spawn a bash session,
build, and launch the TUI. The terminal output includes raw ANSI escape
sequences, so parse cursor position codes (`[row;colH`) and color codes
(`\x1b[48;2;r;g;bm`) to determine element positions and boundaries.
