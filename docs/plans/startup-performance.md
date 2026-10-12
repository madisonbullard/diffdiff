# Startup performance

## Budget and measurement

The startup target is **less than 1,000 ms of non-network wall time** from Bun's
process origin through the first committed review frame. This includes static
imports, CLI parsing, repository discovery, local Git commands, terminal probes,
patch preparation, and layout. It does not measure the invoking shell's `gh auth
token` substitution or package-manager shim before Bun starts.

Telemetry is local-only in existing session JSONL logs. It needs no opt-in and
sends no analytics to a remote service. Locate logs with `diffdiff session list
--json`, not guessed filesystem paths.

- `startup_phase_completed`: existing phase timings plus a cumulative
  `performance` snapshot.
- `operation_completed`: monotonic start/duration and `local`/`network` kind for
  child commands and GitHub API operations, including failures. Existing command
  and API events provide details; these spans add no tokens or response bodies.
- `startup_first_diff_frame`: process-origin total, `networkWaitDurationMs`,
  `nonNetworkDurationMs`, `localBudgetMs`, and `localBudgetExceeded`. Recorded from
  the renderer's post-process hook after the app commits, not from a timer after
  `root.render`. This measures the prepared terminal frame, not physical display
  latency or completion of background syntax/Markdown workers.

Network waits include GitHub requests/pagination and Git fetch/ls-remote/push
operations. Concurrent waits are counted **once**, using their interval union.
Non-network time is total minus that union, **not summed CPU time**: local work
overlapping network I/O is hidden in this critical-path metric. Inspect operation
and preparation timings as well; overlapping a slow local stage with network I/O
is not proof that the local stage itself is fast. API retries/backoff and Git
transport/authentication are part of the network-operation intervals. Terminal
timeouts, disk I/O, and repository discovery are never classified as network.

## Startup structure

- Resolve the launch target with a per-launch remote cache and bounded parallel
  clone discovery; preserve repository boundaries, skip rules, and ambiguity
  prompts. For URLs, overlap the initial PR refs request with clone discovery.
  Resolve base/head availability concurrently.
- Load the core review session concurrently with runtime imports and terminal
  color probes. Reuse that promise for preparation; do not load a second session
  or repeat the CLI's former ref-availability pass.
- Keep GitHub branch metadata and review state loading intact. The TUI sets
  `loadComparisonDetails: false` to skip **local branch summaries only**. Core
  callers retain full enrichment by default.
- Load branch-browser enrichment when the branch dialog opens, not in a startup
  prefetch. Limit summary Git processes to four concurrent branches so on-demand
  loading cannot saturate the machine with hundreds of processes.
- Expand untracked directories with bounded concurrency; retain nested-clone
  behavior and deterministic file ordering.
- Prepare cheap diff metadata first; hydrate syntax near the viewport as before.
  Terminal background/palette probes have explicit 150 ms timeout settings.

## Repeating the benchmark

Build first (`vp run build -r`), then run from the same directory you normally
launch from:

```bash
DIFFDIFF_GITHUB_TOKEN="$(gh auth token --hostname github.com)" \
  python3 /path/to/diffdiff/tools/benchmark-startup.py --runs 5 \
  https://github.com/owner/repo/pull/42
```

Use `--repo /path/to/clone` to isolate discovery, `--cli /path/to/diffdiff` to
include the installed shim, or omit the target to benchmark a local working tree.
The macOS/Linux Python-stdlib harness opens a 120×40 PTY, drains terminal output,
discovers the child log via `session list`, waits for the first review frame,
prints JSON, and terminates only its own child. It never prints the token or
terminal contents. It exits nonzero if any run meets/exceeds 1,000 ms local time,
or no frame arrives before `--timeout` (default 30 seconds).

Treat this as a repeatable machine-specific regression gate, not a guarantee for
arbitrary repository sizes, cold filesystem caches, or host load. Unit tests
cover overlap accounting, idempotent network completion, bounded concurrency,
summary deferral, remote-cache reuse, and lazy browser loading. The visual suite
continues to cover real layouts and navigation.
