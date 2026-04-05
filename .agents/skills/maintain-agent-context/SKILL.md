---
name: maintain-agent-context
description: This skill should be used when the user asks to "update the docs", "refresh AGENTS.md", "improve agent context", "document the architecture", "add repo knowledge", or "create a local skill" for the diffdiff repository.
---

## Purpose

Use this skill to keep the repository legible to future agents without bloating
the top-level instructions.

## Read order

Start with the smallest stable context layer:

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `docs/README.md`
4. `docs/agents/knowledge-base-maintenance.md`

Load deeper sources only when the task requires them:

- current GitHub PR workflow direction: `docs/plans/gh-integration.md`
- focused follow-on work and backlog slices: `docs/todos/`
- package boundaries and current implementation shape: `packages/core/` and
  `packages/tui/`

## Operating rules

- Keep `AGENTS.md` as a table of contents, not an encyclopedia.
- Prefer one authoritative page per topic.
- Add the smallest durable update that preserves future context.
- Cross-link instead of duplicating large sections of prose.
- Rewrite or delete stale guidance instead of leaving conflicting text behind.
- Create a repo-local skill only when a workflow is repeated and procedural.

## Change routing

Use `references/update-matrix.md` to decide where new knowledge belongs.

Typical outcomes:

- repo entry point changed -> update `AGENTS.md`
- package boundaries changed -> update `ARCHITECTURE.md`
- roadmap or interaction direction changed -> update a plan or todo doc
- recurring procedure emerged -> add or refresh a local skill

## Validation

Before finishing:

1. Check that all new docs are cross-linked from an existing entry point.
2. Check that commands and file paths match the repository.
3. Check that no shorter source of truth already says the same thing.
4. Check that the new guidance helps a future agent start faster.
