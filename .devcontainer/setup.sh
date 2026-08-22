#!/usr/bin/env bash
set -euo pipefail
cd /workspace

corepack enable
corepack prepare pnpm@10.28.1 --activate

pnpm install

echo "Waiting for Postgres..."
until bash -c 'echo > /dev/tcp/db/5432' >/dev/null 2>&1; do sleep 1; done

pnpm db:migrate:deploy -- --yes

echo "Setup complete."
