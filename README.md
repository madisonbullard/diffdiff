# diffdiff

`diffdiff` is a git-backed terminal code review tool. It opens a TUI for reviewing working tree changes or ref-to-ref comparisons, and it can submit GitHub PR review actions when authenticated.

## Agent Summary

- Primary workflow: review the current repository's staged, unstaged, and untracked changes against `HEAD`.
- Explicit comparison workflow: launch with `--base <ref>` and `--head <ref>`.
- GitHub review actions require a stored token from `diffdiff auth login --token-stdin`.
- Local session metadata and JSONL logs are available through `diffdiff session` commands.
- Use `vp` for repo tasks.

## Common Commands

```bash
diffdiff
diffdiff --repo packages/tui --base origin/main --head HEAD
diffdiff auth login --token-stdin
diffdiff session list --json
```

## Development

```bash
vp run dev
vp run test -r
vp run build -r
vp run ready
```

## Environment

- `DIFFDIFF_REPO`: repository path to review
- `DIFFDIFF_BASE`: base ref for comparisons
- `DIFFDIFF_HEAD`: head ref for comparisons
- `DIFFDIFF_GITHUB_TOKEN`: GitHub token for PR review actions

## Repository Layout

- `packages/core`: git, repository, session, logging, and GitHub integrations
- `packages/tui`: CLI entrypoint and terminal UI
