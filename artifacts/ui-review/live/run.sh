#!/bin/bash
# Live-terminal fixture for the menu/modal audit (no GitHub writes, isolated HOME).
# usage: artifacts/ui-review/live/run.sh <cols> <rows> <pr|pr-long|local>
# Keypresses are logged to $TMPDIR/diffdiff-live-keys.log and attempted writes to
# $TMPDIR/diffdiff-live-writes.log. Run it inside a real terminal or ht-mcp.
stty cols "$1" rows "$2"
rm -f "$TMPDIR/diffdiff-live-keys.log" "$TMPDIR/diffdiff-live-writes.log"
clear
exec bun "$(dirname "$0")/live.ts" "$3" 2>"${TMPDIR:-/tmp}/diffdiff-live-err.log"
