#!/usr/bin/env bash
# Inside the devcontainer, after start.sh (CI job "Codespace devcontainer"):
# the stack's end-to-end smoke test, the one-origin proxy, then the README's
# three requests exactly as README.md prints them, with the answers they must get.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1090
. "$HOME/.oxy-demo.env"

SITE_URL=http://localhost:3080 bash scripts/stack_smoke.sh

echo; echo "== one origin on port 3080"
curl -fsS -m 10 localhost:3080/engine/health | grep -q '"healthy"' || { echo "FAIL: /engine/health through the proxy"; exit 1; }
curl -fsS -m 10 -o /dev/null localhost:3080/auth/v1/health || { echo "FAIL: /auth/v1 through the proxy"; exit 1; }
curl -fsS -m 60 -o /dev/null localhost:3080/login || { echo "FAIL: the dashboard through the proxy"; exit 1; }
echo "dashboard, auth and engine answer on one origin"

echo; echo "== the README's three requests"
python3 - README.md > "$HOME/readme-requests.sh" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
m = re.search(r"<!-- codespace-requests:start -->\s*```bash\n(.*?)```\s*<!-- codespace-requests:end -->", text, re.S)
if not m:
    sys.exit("README.md has no codespace-requests block")
print(m.group(1))
PY
bash "$HOME/readme-requests.sh" | tee "$HOME/readme-requests.out"
got="$(grep -o '^HTTP [0-9]*' "$HOME/readme-requests.out" | awk '{print $2}' | paste -sd' ' -)"
[ "$got" = "200 451 200 410" ] || { echo "FAIL: statuses '$got', expected '200 451 200 410'"; exit 1; }
printf '\nThe three requests answered %s, as the README says.\n' "$got"
