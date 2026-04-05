# Update Matrix

Use this matrix to route new repository knowledge.

| Situation                                                        | Primary artifact                |
| ---------------------------------------------------------------- | ------------------------------- |
| A future agent would need a better starting point                | `AGENTS.md` or `docs/README.md` |
| The code layout or reusable boundary changed                     | `ARCHITECTURE.md`               |
| The repository needs a durable rule for agent context management | `docs/agents/`                  |
| The product or interaction roadmap changed                       | `docs/plans/`                   |
| A focused follow-on work item needs durable notes                | `docs/todos/`                   |
| A repeated workflow needs step-by-step guidance                  | `.agents/skills/`               |

## Placement heuristics

- Prefer `AGENTS.md` for routing only.
- Prefer `ARCHITECTURE.md` for stable code shape and extension guidance.
- Prefer `docs/agents/` for continuity, maintenance, and context strategy.
- Prefer `docs/plans/` for cross-cutting direction that should outlive a single
  implementation slice.
- Prefer `docs/todos/` for narrower work items that still need to survive across
  sessions.
- Prefer a skill when the content reads like a reusable procedure.
- Prefer deleting stale text over documenting around it.
