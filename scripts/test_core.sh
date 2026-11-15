#!/bin/bash
set -euo pipefail

# Oxy Engine core test suite runner (packages/engine).
# Fast, offline tests only. No external services required.
#
# Usage:
#   sh scripts/test_core.sh

cd "$(dirname "$0")/../packages/engine"

echo "🔍 Running core engine test suite (offline)..."
pytest \
  tests/test_dlp.py \
  tests/test_budget_logic.py \
  tests/test_workers.py \
  tests/test_routes.py \
  tests/test_providers.py \
  tests/test_middleware.py \
  tests/test_core_logic.py \
  tests/test_billing_utils.py \
  tests/test_healthcheck.py \
  tests/test_billing_gate.py \
  tests/test_request_path_security.py \
  tests/test_control.py \
  tests/test_api_keys_api.py \
  -v

