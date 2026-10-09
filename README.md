# diffdiff

`diffdiff` is a git-backed terminal code review tool. It opens a TUI for reviewing working tree changes or ref-to-ref comparisons, and it can submit GitHub PR review actions when authenticated.

## Agent Summary

- Primary workflow: review the current repository's staged, unstaged, and untracked changes against `HEAD`.
- Explicit comparison workflow: launch with `--base <ref>` and `--head <ref>`.
  If either ref only exists on a configured remote, diffdiff fetches it before the TUI opens.
- GitHub review actions require a stored token from `diffdiff auth login --token-stdin`.
- Local session metadata and JSONL logs are available through `diffdiff session` commands.
- Use `vp` for repo tasks.

## Common Commands

```bash
diffdiff
dfdf
diffdiff https://github.com/owner/repo/pull/42
diffdiff --repo packages/tui --base origin/main --head HEAD
diffdiff auth login --token-stdin
diffdiff session list --json
```

## Opening GitHub PRs

A PR URL uses the current clone when its GitHub remote matches; otherwise diffdiff searches
repository containers below the current directory for a same-named clone with a matching
remote. Discovery stops at Git repository boundaries rather than traversing each checkout's
source and dependencies. It also skips generated directories such as `.rifts`, `.worktrees`,
`.cache`, `.venv`, and `node_modules`. Multiple matching peer clones still prompt for a choice.

Use `--repo <path>` for a renamed clone, a repository nested inside another checkout, or a
worktree in a skipped directory. PR startup resolves the base/head refs with one GitHub
request; checks, comments, and viewed-file state load during review-session preparation.
Startup logs include launch-target resolution, before the TUI opens. Find the log path with
`diffdiff session list --json`; `targetResolutionDurationMs` reports that phase separately.

## Install

```bash
npm install -g @madisonbullard/diffdiff-tui
```

This installs both `diffdiff` and the shorter `dfdf` alias.

## Development

```bash
vp run dev
vp run test -r
vp run build -r
vp run ready
```

`ready` requires Bun for the real-layout TUI visual tests and the bundled syntax
worker smoke test. Run `vp run test:visual` or `vp run bench:visual` from
`packages/tui` to check viewport behavior or measure navigation separately.

## Environment

- `DIFFDIFF_REPO`: repository path to review
- `DIFFDIFF_BASE`: base ref for comparisons
- `DIFFDIFF_HEAD`: head ref for comparisons
- `DIFFDIFF_GITHUB_TOKEN`: GitHub token for PR review actions

## Repository Layout

- `packages/core`: git, repository, session, logging, and GitHub integrations
- `packages/tui`: CLI entrypoint and terminal UI
