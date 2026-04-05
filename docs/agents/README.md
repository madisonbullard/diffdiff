# Agent Knowledge Base

This directory is the agent-first knowledge layer for `diffdiff`. It focuses on
context continuity: helping future agents understand what this repository is,
where durable knowledge lives, and how to leave better context behind.

## Files

- `context-constitution.md`
  - Durable principles for identity, memory, and progressive disclosure in this
    repository.
- `knowledge-base-maintenance.md`
  - Operational guide for where to record new knowledge and how to keep docs
    fresh.

## Read by task type

### First time in the repo

1. `../../AGENTS.md`
2. `../../README.md`
3. `../../ARCHITECTURE.md`
4. `context-constitution.md`

### Updating docs or repo context

1. `knowledge-base-maintenance.md`
2. `../../.agents/skills/maintain-agent-context/SKILL.md`

### Extending core or TUI behavior

1. `../../ARCHITECTURE.md`
2. the relevant `../../docs/plans/` or `../../docs/todos/` doc
3. `knowledge-base-maintenance.md`

## What belongs here

Put guidance here when it is:

- durable across many tasks
- specific to this repository
- too detailed for `AGENTS.md`
- useful for future agents before they read a large plan or long transcript

Do not put transient task notes here. Those belong in plans, PRs, or issue
threads until they become durable repository knowledge.
