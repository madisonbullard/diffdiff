# Docs Index

This repository treats versioned, repo-local documentation as the system of
record for agent context. Keep the entry points small, then follow links to the
smallest relevant source of truth.

## Start here

1. `../AGENTS.md`
2. `../ARCHITECTURE.md`
3. `agents/README.md`

## Documentation map

### Stable operating context

- `../AGENTS.md`
  - Short entry point for future agents.
- `../README.md`
  - Product overview and common commands.
- `../ARCHITECTURE.md`
  - Current package map, boundaries, and source-of-truth hierarchy.
- `agents/README.md`
  - Agent-focused reading paths and maintenance guidance.
- `agents/context-constitution.md`
  - Repo-specific principles for continuity, memory, and progressive disclosure.
- `agents/knowledge-base-maintenance.md`
  - Routing guide for where new knowledge belongs.

### Product and implementation direction

- `plans/gh-integration.md`
  - Current durable plan snapshot for GitHub PR interaction in the TUI.
- `todos/`
  - Versioned implementation slices for follow-on TUI, command, rendering, and
    automation work.

## Reading paths

### For feature work

Read `../ARCHITECTURE.md`, then the relevant plan or todo doc, then the code.

### For documentation or context work

Read `agents/README.md`, then `agents/knowledge-base-maintenance.md`, then use
the repo-local skill in `../.agents/skills/maintain-agent-context/` if the task
is specifically about improving agent context.

### For session or logging work

Read `../AGENTS.md`, then `../ARCHITECTURE.md`, then inspect the relevant
`packages/core` logging and session files.

## Documentation rules

- Keep indexes short and stable.
- Prefer one authoritative page per topic.
- Cross-link instead of duplicating long explanations.
- When code changes invalidate documentation, update the doc in the same change.
- Delete stale guidance rather than preserving contradictory context.
