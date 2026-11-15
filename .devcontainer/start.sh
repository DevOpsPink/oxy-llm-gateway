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

# Docker inside the container may still be (re)starting when this runs.
for _ in $(seq 1 90); do docker info >/dev/null 2>&1 && break; sleep 2; done
docker info >/dev/null 2>&1 || { echo "Docker inside the container did not start" >&2; exit 1; }

# This codespace's own secrets (first start) and URLs, in .devcontainer/.stack.env;
# with COMPOSE_FILE and COMPOSE_ENV_FILES every docker compose command here uses them.
python3 .devcontainer/stack_env.py "$ORIGIN"
export COMPOSE_FILE="$PWD/docker-compose.yml:$PWD/proofs/docker-compose.proofs.yml:$PWD/.devcontainer/compose.codespaces.yml"
export COMPOSE_ENV_FILES="$PWD/.devcontainer/.stack.env"
echo "Starting the stack (the first start builds two images: a few minutes)..."
docker compose up -d --build --wait --wait-timeout 900

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
