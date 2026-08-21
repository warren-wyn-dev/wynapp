#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to an isolated non-production database}"
case "${WYN_ENV:-}" in test|staging) ;; *) echo "Refusing backup test unless WYN_ENV is test or staging" >&2; exit 2;; esac
case "$DATABASE_URL" in *prod*|*production*) echo "Refusing production-like DATABASE_URL" >&2; exit 2;; esac

for tool in pg_dump createdb dropdb pg_restore psql; do command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 2; }; done

archive="$(mktemp --suffix=.dump)"
restore_db="wyn_restore_test_$(date +%s)_$$"
trap 'rm -f "$archive"; dropdb --if-exists "$restore_db" >/dev/null 2>&1 || true' EXIT

pg_dump --format=custom --no-owner --no-acl --file="$archive" "$DATABASE_URL"
createdb "$restore_db"
pg_restore --exit-on-error --no-owner --no-acl --dbname="$restore_db" "$archive"
psql --dbname="$restore_db" --set=ON_ERROR_STOP=1 --tuples-only --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | grep -Eq '[1-9][0-9]*'
echo "Backup and isolated restore integrity check passed."
