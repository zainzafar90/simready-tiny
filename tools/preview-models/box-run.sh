#!/bin/sh
# usage: sh box-run.sh 1/4  (pauses the catalog worker meanwhile)
set -u
cd "$(dirname "$0")"
WORKER_PIDS=$(pgrep -f 'src/main[.]ts' | tr '\n' ' ')
resume_worker() { [ -n "$WORKER_PIDS" ] && kill -CONT $WORKER_PIDS 2>/dev/null && echo "resumed catalog worker: $WORKER_PIDS"; }
trap resume_worker EXIT
trap 'exit 130' INT TERM
[ -n "$WORKER_PIDS" ] && kill -STOP $WORKER_PIDS && echo "paused catalog worker: $WORKER_PIDS"
set -a; . ./r2.env; set +a
node src/convert.mjs --shard "$1" --concurrency 6 --work-dir "$PWD/work"
