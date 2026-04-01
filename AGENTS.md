<!--VITE PLUS START-->

# Agent Notes

- Read `README.md` early in each session to understand `diffdiff` capabilities and expected behavior.
- This repo uses Vite+ via the `vp` CLI.
- Use `vp` for package management and tooling. Do not use `npm`, `pnpm`, `yarn`, or `npx` directly.
- `vp dev`, `vp build`, `vp test`, `vp lint`, and similar commands run Vite+ built-ins, not `package.json` scripts. Use `vp run <script>` for custom scripts.
- Import tooling APIs from `vite-plus` and `vite-plus/test`, not from `vite` or `vitest`.
- Do not install wrapped tools like `vitest`, `oxlint`, or `oxfmt` directly.
<!--VITE PLUS END-->

## Diffdiff Sessions

- Use `diffdiff -h` to see the CLI surface area before guessing commands.
- `diffdiff` writes per-session JSONL logs to `~/.diffdiff/logs/log-<session-id>.jsonl`.
- When you need to inspect logs, first run `diffdiff session list --json` to get the right session id and log file path, then read that specific JSONL file.
- Use `diffdiff session list --json` when you need machine-readable access to the current local sessions, their ids, current activity, selected file, comparison, and log file path.
- Use `diffdiff session list` for a human-readable summary of active and stale sessions.
- Use `diffdiff session remove <session-id>` to delete one session's metadata and log file.
- Use `diffdiff session remove-all` to clear every recorded local session and its logs.
- Prefer the session commands over guessing the current log file path from the filesystem.

## Running Diffdiff Locally

To run the TUI locally after making changes:

1. Build the packages: `vp run build -r`
2. Launch the TUI: `bun packages/tui/dist/cli.mjs tui`

When you need to visually inspect the TUI (e.g. to verify layout changes), use `interactive-terminal` to spawn a bash session, build, and launch the TUI. Note that the terminal output will contain raw ANSI escape sequences — parse cursor position codes (`[row;colH`) and color codes (`[48;2;r;g;bm` for background) to determine element positions and boundaries.
