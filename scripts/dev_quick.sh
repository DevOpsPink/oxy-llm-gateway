#!/bin/bash
set -euo pipefail

# Quick dev check: core tests + gateway healthcheck (no DB reset).
#
# Usage:
#   export OXY_API_KEY=oxy_live_...
#   sh scripts/dev_quick.sh

cd "$(dirname "$0")/.."

if [ -z "${OXY_API_KEY:-}" ]; then
  echo "ERROR: OXY_API_KEY is not set. Export your dev key before running this script." >&2
  exit 1
fi

echo "🚀 Oxy quick dev check (tests + healthcheck)..."
echo "ℹ️  Make sure the engine is running on http://localhost:8000."

echo "🧪 Running engine tests..."
sh scripts/test_core.sh

echo "🚦 Running Oxy Gateway dev smoke..."
sh scripts/dev_smoke.sh

