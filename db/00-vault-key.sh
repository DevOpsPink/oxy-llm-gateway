#!/bin/sh
# The vault's AES key, which vault._key() reads as current_setting('app.vault_key').
#
# Set on this install's first boot with ALTER SYSTEM, from SUPABASE_VAULT_KEY in
# the container's environment, so it is kept in postgresql.auto.conf (readable by
# the postgres user only) and never stands on the postmaster's command line, where
# `ps` showed it to every user of the host up to 1.0.3. Every later boot keeps the
# file in step with the variable: db/postgres-entrypoint.sh. Runs from
# /docker-entrypoint-initdb.d before 01-compat.sql. psql reads the key with
# \getenv, so it is on no command line here either.
set -eu

if [ -n "${SUPABASE_VAULT_KEY:-}" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --quiet <<'SQL'
\getenv key SUPABASE_VAULT_KEY
ALTER SYSTEM SET app.vault_key = :'key';
SELECT pg_reload_conf();
SQL
fi
