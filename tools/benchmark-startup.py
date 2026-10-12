#!/usr/bin/env python3
"""Measure the built CLI in a real PTY without printing terminal content or credentials."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import pty
import select
import struct
import subprocess
import termios
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--timeout", type=float, default=30)
    parser.add_argument(
        "--cli", help="Optional installed diffdiff executable to benchmark"
    )
    parser.add_argument("target", nargs="?")
    parser.add_argument("--repo")
    args = parser.parse_args()
    cli = Path(__file__).resolve().parent.parent / "packages/tui/dist/cli.mjs"
    if args.runs < 1 or args.timeout <= 0:
        parser.error("--runs and --timeout must be positive")
    command = [args.cli] if args.cli else ["bun", str(cli)]
    if args.repo:
        command += ["--repo", args.repo]
    if args.target:
        command += [args.target]
    results = []
    for _ in range(args.runs):
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
        process = subprocess.Popen(
            command,
            stdin=slave,
            stdout=slave,
            stderr=slave,
            env={**os.environ, "TERM": "xterm-256color"},
        )
        os.close(slave)
        deadline = time.monotonic() + args.timeout
        log_path = None
        result = None
        try:
            while time.monotonic() < deadline and process.poll() is None:
                readable, _, _ = select.select([master], [], [], 0.05)
                if readable:
                    os.read(
                        master, 65536
                    )  # Drain the PTY so writes never block startup.
                if log_path is None:
                    sessions = json.loads(
                        subprocess.check_output(
                            ["bun", str(cli), "session", "list", "--json"]
                        )
                    )
                    session = next(
                        (s for s in sessions if s["pid"] == process.pid), None
                    )
                    if session:
                        log_path = Path(session["logFilePath"])
                if log_path and log_path.exists():
                    for line in log_path.read_text().splitlines():
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError:
                            continue  # A queued append may still be in flight.
                        if event["event"] == "startup_first_diff_frame":
                            result = event["data"]
                            break
                if result:
                    break
            if result is None:
                raise RuntimeError(
                    f"No first diff frame within {args.timeout}s; log: {log_path}"
                )
            results.append(result)
            print(
                json.dumps(
                    {"run": len(results), "logFilePath": str(log_path), **result}
                ),
                flush=True,
            )
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            os.close(master)
    if any(result["localBudgetExceeded"] for result in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
