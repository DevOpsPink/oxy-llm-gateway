#!/bin/bash
set -euo pipefail

# Oxy Engine integration test suite (packages/engine).
# These tests hit live services and require:
# - Engine running on http://localhost:8000
# - Supabase
# - Stripe-like webhook secrets
# - Real OpenAI API key.
#
# Usage:
#   export OXY_API_KEY=...
#   export OPENAI_API_KEY=...
#   export SUPABASE_URL=...
#   export SUPABASE_SERVICE_KEY=...
#   export STRIPE_WEBHOOK_SECRET=...
#   sh scripts/test_integration.sh

cd "$(dirname "$0")/../packages/engine"

missing=0
for var in OXY_API_KEY OPENAI_API_KEY SUPABASE_URL SUPABASE_SERVICE_KEY STRIPE_WEBHOOK_SECRET; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set." >&2
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Aborting integration tests. Please set the required environment variables." >&2
  exit 1
fi

echo "⚠️  Oxy Engine integration tests will hit live services."
echo "   • Engine must be running at http://localhost:8000"
echo "   • Supabase/Stripe/OpenAI env vars must be valid."
echo ""

pytest \
  tests/test_chat_completions_smoke.py \
  tests/integration/gamma_billing_sim.py \
  tests/integration/omega_simulation.py \
  -v

