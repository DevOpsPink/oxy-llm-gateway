#!/usr/bin/env bash
# Devcontainer start (Codespaces or the devcontainer CLI): the stack with the
# recording fake provider, one origin for the dashboard on port 3080, and a
# fresh demo organization, key and agent session in ~/.oxy-demo.env.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
  ORIGIN="https://${CODESPACE_NAME}-3080.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
else
  ORIGIN="http://localhost:3080"
fi
host="${ORIGIN#*://}"
export NEXT_PUBLIC_SITE_URL="$ORIGIN" NEXT_PUBLIC_SUPABASE_URL="$ORIGIN" NEXT_PUBLIC_API_URL="$ORIGIN/engine"
export ALLOWED_ORIGINS="$ORIGIN,http://localhost:3000" API_EXTERNAL_URL="$ORIGIN"
export GOTRUE_SITE_URL="$ORIGIN" GOTRUE_URI_ALLOW_LIST="$ORIGIN,$ORIGIN/auth/callback"
export NEXT_ALLOWED_DEV_ORIGINS="${host%%:*}"

compose=(docker compose -f docker-compose.yml -f proofs/docker-compose.proofs.yml -f .devcontainer/compose.codespaces.yml)
echo "Starting the stack (the first start builds two images: a few minutes)..."
"${compose[@]}" up -d --build --wait --wait-timeout 900

python3 .devcontainer/demo_setup.py "$HOME/.oxy-demo.env"
for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
  [ -f "$rc" ] || continue
  grep -q 'oxy-demo.env' "$rc" || printf '\n[ -f ~/.oxy-demo.env ] && . ~/.oxy-demo.env\n' >> "$rc"
done

cat <<MSG

Oxy is up. In a new terminal, \$OXY_API_KEY, \$OXY_AGENT_ID and \$OXY_SESSION_ID are set:
try the three requests in README.md ("Try it in a Codespace").
  Dashboard: $ORIGIN  (sign in as \$OXY_DEMO_EMAIL; the link arrives in Mailpit)
  Mailpit:   port 8025
  Gateway:   http://localhost:8000 inside the codespace, or $ORIGIN/engine
The model provider is the recording fake from proofs/: no request leaves the codespace.
MSG
