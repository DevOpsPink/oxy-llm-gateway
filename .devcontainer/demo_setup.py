#!/usr/bin/env python3
"""demo_setup.py OUT_ENV - a fresh demo organization for the devcontainer.

Signs up a throwaway user (random address and password; the password is never
written anywhere), onboards it (organization, project, Oxy API key), gives the
project a $1.00 budget, registers an agent, starts a session for it, and writes
OXY_API_KEY, OXY_AGENT_ID, OXY_SESSION_ID and OXY_DEMO_EMAIL to OUT_ENV (mode
600, outside the repository). Run by start.sh on every start, so each start has
its own key; nothing here is a standing credential.
"""
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API, SUPA = "http://localhost:8000", "http://localhost:8080"


def setting(name):
    """The stack's value: this codespace's .stack.env, else docker-compose.yml's default."""
    env = ROOT / ".devcontainer" / ".stack.env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip()
    m = re.search(r"\$\{%s:-([^}]+)\}" % re.escape(name), (ROOT / "docker-compose.yml").read_text())
    if not m:
        sys.exit("cannot find %s" % name)
    return m.group(1)


def call(method, url, body=None, headers=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, None


def main(out):
    anon, service = setting("NEXT_PUBLIC_SUPABASE_ANON_KEY"), setting("SUPABASE_SERVICE_KEY")
    run = secrets.token_hex(4)
    email = "demo-%s@example.com" % run
    st, body = call("POST", SUPA + "/auth/v1/signup", {"email": email, "password": secrets.token_urlsafe(24)}, {"apikey": anon})
    if st != 200 or not (body or {}).get("access_token"):
        sys.exit("sign-up failed: HTTP %s" % st)
    jwt, csrf = body["access_token"], "demo" + run
    auth = {"Authorization": "Bearer " + jwt, "X-CSRF-Token": csrf, "Cookie": "csrf_token=" + csrf}
    st, body = call("POST", API + "/management/onboard", {"full_name": "Oxy Demo", "email": email}, auth)
    if st != 200 or not str((body or {}).get("api_key", "")).startswith("oxy_"):
        sys.exit("onboarding failed: HTTP %s" % st)
    key, project = body["api_key"], body["project_id"]
    st, _ = call("PATCH", "%s/rest/v1/projects?id=eq.%s" % (SUPA, project), {"budget_limit": "1.00"},
                 {"apikey": service, "Authorization": "Bearer " + service, "Prefer": "return=minimal"})
    if st not in (200, 204):
        sys.exit("setting the budget failed: HTTP %s" % st)
    st, agent = call("POST", API + "/v1/agents", {"name": "demo-agent", "project_id": project, "default_model": "gpt-4o-mini"}, auth)
    if st not in (200, 201):
        sys.exit("creating the agent failed: HTTP %s" % st)
    agent_id = (agent.get("agent") or agent)["id"]
    st, sess = call("POST", "%s/v1/agents/%s/sessions" % (API, agent_id), {}, auth)
    if st not in (200, 201):
        sys.exit("starting the session failed: HTTP %s" % st)
    s = sess.get("session") or sess
    session_id = s.get("id") or s.get("session_id")

    text = ("# Oxy demo, made by .devcontainer/demo_setup.py on this start; not a standing credential.\n"
            "export OXY_API_KEY=%s\nexport OXY_AGENT_ID=%s\nexport OXY_SESSION_ID=%s\nexport OXY_DEMO_EMAIL=%s\n"
            "export COMPOSE_FILE=%s\nexport COMPOSE_ENV_FILES=%s\n"
            % (key, agent_id, session_id, email, os.environ.get("COMPOSE_FILE", ""), os.environ.get("COMPOSE_ENV_FILES", "")))
    fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)  # created 600, never readable by others
    with os.fdopen(fd, "w") as f:
        f.write(text)
    os.chmod(out, 0o600)
    print("demo organization ready: %s, key %s..., agent session %s" % (email, key[:13], session_id))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
