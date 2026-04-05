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

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
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
