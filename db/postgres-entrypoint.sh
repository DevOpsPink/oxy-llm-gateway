#!/bin/sh
# Postgres for Oxy: runs as root before the image's own entrypoint, which drops
# to the postgres user and starts the server with the compose file's command.
set -eu

# The shared secrets volume starts root-owned; the init scripts run as postgres.
mkdir -p /run/oxy-secrets
chown postgres:postgres /run/oxy-secrets

# The vault key reaches Postgres through postgresql.auto.conf, written from
# SUPABASE_VAULT_KEY: on the first boot by 00-vault-key.sh (the same awk), on
# every later boot here, so a database made before 1.0.4 keeps its key. Never
# `postgres -c app.vault_key=...`: the postmaster's command line is in `ps` for
# every user of the host. awk reads the key from its environment, not its argv.
auto="${PGDATA:-/var/lib/postgresql/data}/postgresql.auto.conf"
if [ -n "${SUPABASE_VAULT_KEY:-}" ] && [ -f "$auto" ]; then
  awk -v q="'" '
    BEGIN { k = ENVIRON["SUPABASE_VAULT_KEY"]; gsub(q, q q, k); line = "app.vault_key = " q k q }
    /^[ \t]*app\.vault_key[ \t]*=/ { if (!done) print line; done = 1; next }
    { print }
    END { if (!done) print line }
  ' "$auto" > "$auto.oxy"
  chown postgres:postgres "$auto.oxy"
  chmod 0600 "$auto.oxy"
  mv -f "$auto.oxy" "$auto"
fi

exec docker-entrypoint.sh "$@"
