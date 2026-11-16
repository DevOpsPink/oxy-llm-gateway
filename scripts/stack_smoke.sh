#!/usr/bin/env bash
# End-to-end smoke test of the local stack, as a new user meets it:
#   docker compose up -d --build --wait && sh scripts/stack_smoke.sh
#
# 1. the engine, the REST adapter and GoTrue answer;
# 2. a browser origin passes the adapter's CORS preflight;
# 3. a magic link is sent, lands in Mailpit, and GoTrue accepts it;
# 4. a password sign-up is onboarded and receives an Oxy API key;
# 5. every engine route the dashboard reads answers that user's session;
# 6. the key gets "pong from Oxy Gateway" through /v1/chat/completions.
#
# Tokens stay in shell variables and reach curl on stdin, never on its command line.
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
SUPA_URL="${SUPA_URL:-http://localhost:8080}"
MAIL_URL="${MAIL_URL:-http://localhost:8025}"
SITE_URL="${SITE_URL:-http://localhost:3000}"
RUN_ID="$(date +%s)$$"

step() { printf '\n== %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }
# curl with headers read from stdin, so tokens never appear in the process list
curl_h() { curl --silent --show-error --max-time 20 --config - "$@"; }

ANON_KEY="$(docker compose config --format json | json "d['services']['ui']['environment']['NEXT_PUBLIC_SUPABASE_ANON_KEY']")"
[ -n "$ANON_KEY" ] || fail "could not read the anon key from docker compose config"

step "services answer"
for i in $(seq 1 60); do
  curl -fsS -m 5 "$API_URL/health" >/dev/null 2>&1 && break
  [ "$i" = 60 ] && fail "engine /health did not answer within 120 s"
  sleep 2
done
curl -fsS -m 5 "$API_URL/health" | json "d['status']" | grep -qx healthy || fail "engine is not healthy"
curl -fsS -m 5 -o /dev/null "$SUPA_URL/rest/v1/" || fail "PostgREST behind the adapter does not answer"
curl -fsS -m 5 -o /dev/null "$SUPA_URL/auth/v1/health" || fail "GoTrue behind the adapter does not answer"
echo "engine, REST and auth answer"

step "CORS preflight from the UI origin"
curl -sS -m 5 -o /dev/null -D - -X OPTIONS "$SUPA_URL/auth/v1/otp" \
  -H "Origin: $SITE_URL" -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: apikey,authorization,content-type,x-client-info' \
  | grep -qi '^access-control-allow-origin:' || fail "no Access-Control-Allow-Origin on the auth preflight"
echo "preflight allowed"

step "magic link through Mailpit"
MAGIC_EMAIL="smoke-magic-$RUN_ID@example.com"
printf 'header = "apikey: %s"\n' "$ANON_KEY" | curl_h -o /dev/null -w '%{http_code}\n' \
  -X POST "$SUPA_URL/auth/v1/otp" -H 'Content-Type: application/json' \
  --data "{\"email\":\"$MAGIC_EMAIL\",\"create_user\":true}" | grep -qx 200 || fail "GoTrue refused to send a magic link"
MSG_ID=""
for i in $(seq 1 20); do
  MSG_ID="$(curl -fsS -m 5 "$MAIL_URL/api/v1/search?query=to:$MAGIC_EMAIL" | json "(d.get('messages') or [{}])[0].get('ID','')")"
  [ -n "$MSG_ID" ] && break
  sleep 1
done
[ -n "$MSG_ID" ] || fail "the magic link never reached Mailpit"
LINK="$(curl -fsS -m 5 "$MAIL_URL/api/v1/message/$MSG_ID" \
  | python3 -c "import json,re,sys; t=json.load(sys.stdin)['Text']; m=re.search(r'https?://\S+/auth/v1/verify\S+', t); print(m.group(0) if m else '')")"
[ -n "$LINK" ] || fail "the magic-link mail has no /auth/v1/verify link"
VERIFY="$(printf 'url = "%s"\n' "$LINK" | curl_h -o /dev/null -w '%{http_code} %{redirect_url}')"
case "$VERIFY" in
  30[2-3]\ "$SITE_URL"*access_token=*) echo "GoTrue accepted the link and redirects to $SITE_URL" ;;
  *) fail "verify link answered '${VERIFY%%#*}', expected a redirect to $SITE_URL with a session" ;;
esac

step "sign-up, onboarding and an Oxy API key"
USER_EMAIL="smoke-$RUN_ID@example.com"
USER_PASS="smoke-$RUN_ID-local-only"
ACCESS_TOKEN="$(printf 'header = "apikey: %s"\n' "$ANON_KEY" | curl_h -X POST "$SUPA_URL/auth/v1/signup" \
  -H 'Content-Type: application/json' --data "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\"}" \
  | json "d.get('access_token','')")"
[ -n "$ACCESS_TOKEN" ] || fail "sign-up returned no session"
CSRF="smoke$RUN_ID"
OXY_API_KEY="$(printf 'header = "Authorization: Bearer %s"\n' "$ACCESS_TOKEN" | curl_h -X POST "$API_URL/management/onboard" \
  -H "X-CSRF-Token: $CSRF" -b "csrf_token=$CSRF" -H 'Content-Type: application/json' \
  --data "{\"full_name\":\"Smoke Test\",\"email\":\"$USER_EMAIL\"}" | json "d.get('api_key','')")"
case "$OXY_API_KEY" in oxy_*) echo "onboarded; got an Oxy API key" ;; *) fail "onboarding returned no Oxy API key" ;; esac

step "the dashboard's API answers a signed-in session"
# Every engine route a dashboard page reads, called the way the page calls it:
# with the user's session, not an Oxy API key. A 401 or 500 here is a broken page.
ORG_ID="$(printf 'header = "Authorization: Bearer %s"\n' "$ACCESS_TOKEN" | curl_h "$API_URL/organizations" | json "d[0]['id']")"
PAGES_FAILED=0
for path in \
  /management/status /management/projects /management/keys /management/stats /management/credits/referral-link \
  /organizations "/add-ons/catalog?organization_id=$ORG_ID" "/auth/sso/status/$ORG_ID" /billing/subscription-status \
  "/v1/audit/logs?limit=5" /v1/requests /v1/attribution/summary /v1/billing/overview /v1/guardrails \
  /v1/notifications/settings /v1/webhooks /v1/org /v1/privacy /v1/providers/config /v1/setup/status \
  /v1/intelligence/overview /v1/intelligence/anomalies /v1/intelligence/security-score /v1/intelligence/cost-insights \
  /v1/exports/requests.csv /v1/cost-optimizer/recommendations /v1/team /v1/prompts/ /v1/agents; do
  code="$(printf 'header = "Authorization: Bearer %s"\n' "$ACCESS_TOKEN" | curl_h -o /dev/null -w '%{http_code}' "$API_URL$path")"
  if [ "$code" != 200 ]; then echo "  $path -> HTTP $code"; PAGES_FAILED=$((PAGES_FAILED + 1)); fi
done
[ "$PAGES_FAILED" = 0 ] || fail "$PAGES_FAILED dashboard routes refused a signed-in session"
echo "every route the dashboard reads answers the session"
# Organization settings change only by an owner or admin; the onboarded user owns the organization.
code="$(printf 'header = "Authorization: Bearer %s"\n' "$ACCESS_TOKEN" | curl_h -o /dev/null -w '%{http_code}' \
  -X POST "$API_URL/v1/guardrails" -H "X-CSRF-Token: $CSRF" -b "csrf_token=$CSRF" -H 'Content-Type: application/json' --data '{}')"
[ "$code" = 200 ] || fail "the organization's owner could not save its guardrails with a session (HTTP $code)"
echo "the owner's session saves organization settings"

step "request through the gateway"
REPLY="$(printf 'header = "Authorization: Bearer %s"\n' "$OXY_API_KEY" | curl_h -X POST "$API_URL/v1/chat/completions" \
  -H 'Content-Type: application/json' --data '{"model":"gpt-4.1-mini","stream":false,"messages":[{"role":"system","content":"You are a healthcheck bot for the Oxy Gateway. Always respond with exactly: pong from Oxy Gateway."},{"role":"user","content":"ping"}]}' \
  | json "d['choices'][0]['message']['content']")"
[ "$REPLY" = "pong from Oxy Gateway" ] || fail "gateway answered '$REPLY'"
echo "gateway answered: $REPLY"

step "the key's last use reaches the API Keys page"
# The gateway writes api_keys.last_used_at in the background, once a minute at
# most; before 1.0.5 nothing wrote it and the page said "Never" for every key.
session() { printf 'header = "Authorization: Bearer %s"\n' "$ACCESS_TOKEN"; }
PROJECT_ID="$(session | curl_h "$API_URL/management/projects" | json "d[0]['id']")"
LAST_USED=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  LAST_USED="$(session | curl_h "$API_URL/management/keys?projectId=$PROJECT_ID" \
    | json "next((k['last_used_at'] for k in d if k.get('last_used_at')), '')")"
  [ -n "$LAST_USED" ] && break
  sleep 1
done
[ -n "$LAST_USED" ] || fail "the key that just made a request still shows no last use"
echo "the key's last use is on the API Keys page"

step "the dashboard's project buttons write the database"
# Set Budget Limit, Delete and Create New Project, called the way the dashboard
# calls them. In v1.0.1 all three answered 500: they called database functions
# the schema never had, and nothing here wrote through them.
code="$(session | curl_h -o /dev/null -w '%{http_code}' -X PUT "$API_URL/management/project/$PROJECT_ID" \
  -H "X-CSRF-Token: $CSRF" -b "csrf_token=$CSRF" -H 'Content-Type: application/json' \
  --data '{"name":"Smoke budget","budget_limit":"12.50"}')"
[ "$code" = 200 ] || fail "Set Budget Limit (PUT /management/project/{id}) answered HTTP $code"
BUDGET="$(session | curl_h "$API_URL/management/projects" \
  | json "[float(p['budget_limit']) for p in d if p['id'] == '$PROJECT_ID'][0]")"
[ "$BUDGET" = "12.5" ] || fail "the project's budget reads '$BUDGET' after Set Budget Limit 12.50"
echo "Set Budget Limit saved \$12.50"
code="$(session | curl_h -o /dev/null -w '%{http_code}' -X DELETE "$API_URL/management/project/$PROJECT_ID" \
  -H "X-CSRF-Token: $CSRF" -b "csrf_token=$CSRF")"
[ "$code" = 200 ] || fail "Delete project answered HTTP $code"
code="$(printf 'header = "Authorization: Bearer %s"\n' "$OXY_API_KEY" | curl_h -o /dev/null -w '%{http_code}' \
  -X POST "$API_URL/v1/chat/completions" -H 'Content-Type: application/json' \
  --data '{"model":"gpt-4.1-mini","stream":false,"messages":[{"role":"user","content":"ping"}]}')"
[ "$code" = 401 ] || fail "the deleted project's key, used a moment before, answered HTTP $code instead of 401"
echo "deleting the project stopped its key at once"
NEW_ID="$(session | curl_h -X POST "$API_URL/management/project" -H "X-CSRF-Token: $CSRF" -b "csrf_token=$CSRF" \
  -H 'Content-Type: application/json' --data '{"name":"Smoke second"}' | json "d.get('id') or ''")"
[ -n "$NEW_ID" ] || fail "Create New Project returned no project"
echo "Create New Project made a project (the deleted one no longer counts toward the plan's cap)"

printf '\nAll smoke checks passed.\n'
