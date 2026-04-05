# Context Constitution

This document adapts the general ideas from agent-first repositories and
long-lived agent memory to `diffdiff`.

The goal is not to give every agent a giant manual. The goal is to make the
repository easy to re-understand, extend, and maintain over many sessions.

## Purpose

`diffdiff` exists to make code review and repository comparison possible from a
terminal-first interface. Its current implementation is narrower than every
possible future client or integration. Future agents should preserve that
distinction:

- north star: a strong terminal code-review workflow with reusable comparison
  and PR-review primitives
- current implementation: `packages/core` shared review/session/GitHub logic,
  `packages/tui` terminal UI, and repo-local docs that capture the intended
  direction

Context should reinforce that identity instead of blurring it.

## Identity

The repository's current identity is defined by a few durable constraints:

- `diffdiff` is a terminal code review tool, not a generic git helper grab bag.
- `packages/core` is the reusable logic boundary for repository, session,
  logging, preference, and GitHub review behavior.
- `packages/tui` owns CLI startup, terminal rendering, and keyboard-driven
  interaction.
- GitHub integration is important but should not force the reusable core into
  GitHub-only assumptions when repository-level review concepts are broader.
- Local session metadata and JSONL logs under `~/.diffdiff/` are part of the
  supported debugging workflow. Prefer `diffdiff session` commands over guessing
  paths by hand.
- This repo uses Vite+ through `vp`; repo automation and commands should follow
  that tooling model.

When proposed work conflicts with those constraints, update the governing docs
deliberately instead of drifting around them silently.

## Memory hierarchy

Treat repository knowledge as a hierarchy with progressive disclosure:

1. `AGENTS.md`
   - entry point and routing only
2. `README.md` and `ARCHITECTURE.md`
   - product overview, package map, boundaries, and source-of-truth ordering
3. `docs/agents/`
   - durable agent behavior guidance and maintenance rules
4. `docs/plans/` and `docs/todos/`
   - feature direction, roadmap slices, and accepted interaction guidance
5. code and tests
   - executable truth

Add knowledge at the lowest level that still keeps it discoverable.

## Progressive disclosure

Favor small, navigable entry points over large catch-all documents.

- Keep `AGENTS.md` short.
- Keep indexes focused on routing, not full explanation.
- Add a new deep document only when a concept is durable and reused.
- Prefer cross-links between docs instead of restating the same rule in several
  places.

If a rule matters on nearly every task, it may belong in `AGENTS.md` or
`ARCHITECTURE.md`. If it matters only for a repeated workflow, it likely belongs
in a repo-local skill.

## Continuity

Future agents should be able to answer three questions quickly:

1. What is this repository trying to become?
2. What is already true in code today?
3. Where should new knowledge be recorded so it survives this session?

To preserve continuity:

- convert stable chat conclusions into versioned docs
- update architecture and command docs when code shape changes
- keep plan and todo docs aligned with the current implementation direction
- remove obsolete guidance instead of letting contradictory documents coexist

## Durable learnings

Capture durable learnings when a future agent would otherwise repeat discovery
work or misunderstand the repository. Good examples:

- a new `packages/core` versus `packages/tui` boundary
- a new required command or test flow
- a repeated rule for session logs, startup options, or TUI interaction
- a design decision that changes how GitHub review work should be extended

Do not capture ephemeral facts that are easier to re-derive from code, git
history, or a one-off plan.

## Efficiency

Context is expensive. Documentation should earn its keep.

- Prefer one authoritative page per topic.
- Keep prose concrete and repo-specific.
- Avoid speculative frameworks that are not yet reflected in code or plans.
- Create a local skill only when the workflow is reusable and the guidance is
  more procedural than architectural.

The best repository context is small, current, and well-linked.
