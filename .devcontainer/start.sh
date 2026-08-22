#!/usr/bin/env bash
set -euo pipefail
cd /workspace

mkdir -p .devcontainer
: > .devcontainer/dev-emails.jsonl

mkdir -p /tmp/wyn-logs

nohup pnpm --filter @wyn/api dev > /tmp/wyn-logs/api.log 2>&1 &
nohup pnpm --filter @wyn/worker dev > /tmp/wyn-logs/worker.log 2>&1 &
nohup pnpm --filter @wyn/web dev > /tmp/wyn-logs/web.log 2>&1 &

echo "Started API (4000), Worker (4100), Web (3000) in the background."
echo "Logs: /tmp/wyn-logs/{api,worker,web}.log"
echo "Verify-email/reset-password links land in .devcontainer/dev-emails.jsonl (as JSON: {to, template, token})."
