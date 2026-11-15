#!/bin/sh
# The password PostgREST logs in with as the `authenticator` role.
#
# Generated on this install's first boot (32 random bytes), never a constant in
# the repository; AUTHENTICATOR_PASSWORD overrides it. Runs once, from
# /docker-entrypoint-initdb.d, after 01-compat.sql created the role. PostgREST
# reads the connection string from the shared volume (PGRST_DB_URI=@file), so
# the password is never on a command line or in the compose file.
set -eu

secret_dir=/run/oxy-secrets
umask 022

if [ -n "${AUTHENTICATOR_PASSWORD:-}" ]; then
  pw=$AUTHENTICATOR_PASSWORD
elif [ -s "$secret_dir/authenticator_password" ]; then
  pw=$(cat "$secret_dir/authenticator_password")
else
  pw=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
fi

printf '%s' "$pw" > "$secret_dir/authenticator_password"
printf 'postgres://authenticator:%s@postgres:5432/%s' "$pw" "${POSTGRES_DB:-oxy}" > "$secret_dir/pgrst_db_uri"
# PostgREST runs as uid 1000 and reads the URI; nothing else mounts this volume.
chmod 0444 "$secret_dir/authenticator_password" "$secret_dir/pgrst_db_uri"

OXY_AUTHENTICATOR_PW=$pw psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --quiet <<'SQL'
\getenv pw OXY_AUTHENTICATOR_PW
ALTER ROLE authenticator WITH LOGIN PASSWORD :'pw';
SQL
echo "authenticator password set (generated per install unless AUTHENTICATOR_PASSWORD was given)"
