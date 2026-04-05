# Knowledge Base Maintenance

Use this guide when deciding where new repo knowledge belongs and what should be
updated alongside a code or documentation change.

## Core rule

Prefer the smallest durable update that keeps future agents from repeating the
same discovery work.

## Routing guide

| If the change affects...                                         | Update...                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| repo entry points, common commands, or where to begin            | `AGENTS.md` and possibly `README.md`                               |
| package layout, reusable boundaries, or source-of-truth ordering | `ARCHITECTURE.md`                                                  |
| agent memory rules or context strategy                           | `docs/agents/`                                                     |
| cross-cutting feature direction or durable interaction design    | `docs/plans/`                                                      |
| focused follow-on implementation slices or backlog               | `docs/todos/`                                                      |
| a repeated procedural workflow                                   | `.agents/skills/<skill-name>/SKILL.md`                             |
| transient implementation notes                                   | a plan, issue, or PR description, not the permanent knowledge base |

## Update triggers

### Update `AGENTS.md` when

- the preferred read order changes
- the main commands change
- the session and logging workflow changes materially
- a repo-local skill becomes part of normal workflow
- a global guardrail becomes important enough to appear on nearly every task

### Update `ARCHITECTURE.md` when

- a new top-level package or layer is added
- responsibility shifts between `packages/core` and `packages/tui`
- runtime wiring changes materially
- a new persistent state or logging boundary is introduced
- the current extension guidance no longer matches the code

### Update plans when

- the GitHub review direction changes materially
- the repository comparison or startup model changes in a durable way
- a cross-cutting UX or interaction decision should survive outside one task

### Update todo docs when

- a planned slice of follow-on work is re-scoped
- a backlog item becomes stale, completed, or superseded
- a narrower TUI or CLI implementation note should survive across sessions

### Create or update a local skill when

- the workflow is procedural and repeated
- the guidance is more useful as steps than as architecture prose
- the task benefits from a reusable checklist or command sequence

Do not create a skill for one-off notes.

## Freshness rules

- Make the doc change in the same patch as the code change when practical.
- Prefer rewriting over appending caveats to stale text.
- Keep cross-links working; broken references are stale context.
- If a file stops being the source of truth, say where the new source lives.

## Lightweight doc-gardening checklist

Before finishing a change, ask:

1. Did the code change invalidate any command, boundary, or architectural map?
2. Is there a decision here that should survive outside the current session?
3. Would a future agent know where to start without re-reading a long transcript?
4. Should this knowledge live in a doc, a todo doc, or a local skill?

If the answer to any of those is yes, update the relevant artifact now.
