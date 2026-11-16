#!/bin/sh
# The vault's AES key, which vault._key() reads as current_setting('app.vault_key').
#
# Written on this install's first boot into postgresql.auto.conf (readable by the
# postgres user only), from SUPABASE_VAULT_KEY in the container's environment,
# so it never stands on the postmaster's command line, where `ps` showed it to
# every user of the host up to 1.0.3. Every later boot keeps the file in step
# with the variable: db/postgres-entrypoint.sh, the same awk. ALTER SYSTEM would
# be the usual way, and it refuses a custom parameter ("unrecognized
# configuration parameter"). awk reads the key from its environment, not argv.
# Runs from /docker-entrypoint-initdb.d before 01-compat.sql, as postgres.
set -eu

if [ -n "${SUPABASE_VAULT_KEY:-}" ]; then
  auto="$PGDATA/postgresql.auto.conf"
  awk -v q="'" '
    BEGIN { k = ENVIRON["SUPABASE_VAULT_KEY"]; gsub(q, q q, k); line = "app.vault_key = " q k q }
    /^[ \t]*app\.vault_key[ \t]*=/ { if (!done) print line; done = 1; next }
    { print }
    END { if (!done) print line }
  ' "$auto" > "$auto.oxy"
  chmod 0600 "$auto.oxy"
  mv -f "$auto.oxy" "$auto"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --quiet -c "SELECT pg_reload_conf();" > /dev/null
fi
