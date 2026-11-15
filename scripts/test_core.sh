#!/bin/bash
set -euo pipefail

# Oxy Engine core test suite runner (packages/engine).
# Fast, offline tests only. No external services required.
#
# Usage:
#   sh scripts/test_core.sh

cd "$(dirname "$0")/../packages/engine"

echo "🔍 Running core engine test suite (offline)..."
# Every offline test: everything under tests/ but tests/integration/ (which needs
# a running engine and live services). One test skips itself without OXY_API_KEY.
pytest tests --ignore=tests/integration -v
