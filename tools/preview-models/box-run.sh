#!/bin/sh
# usage: sh box-run.sh 1/4
# optional: PAUSE_PATTERN='regex' pauses matching processes meanwhile
set -u
cd "$(dirname "$0")"
PAUSED=""
if [ -n "${PAUSE_PATTERN:-}" ]; then PAUSED=$(pgrep -f "$PAUSE_PATTERN" | grep -v "^$$\$" | tr '\n' ' '); fi
resume_paused() { [ -n "$PAUSED" ] && kill -CONT $PAUSED 2>/dev/null && echo "resumed: $PAUSED"; }
trap resume_paused EXIT
trap 'exit 130' INT TERM
[ -n "$PAUSED" ] && kill -STOP $PAUSED && echo "paused: $PAUSED"
set -a; . ./r2.env; set +a
node src/convert.mjs --shard "$1" --concurrency 6 --work-dir "$PWD/work"
