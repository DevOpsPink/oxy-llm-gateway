#!/usr/bin/env python3
"""stack_env.py ORIGIN - .devcontainer/.stack.env for the codespace's stack.

The stack's secrets are generated on the codespace's first start and kept for
its life: the JWT secret, the anon and service-role keys signed with it, the
vault key, and the Postgres and Redis passwords. docker-compose.yml's defaults
are published development values; a codespace whose port is shared must not
run on them. The public URLs (ORIGIN, the one origin on port 3080) are written
on every start. The file is mode 600, outside git, and every docker compose
command in the codespace reads it (COMPOSE_ENV_FILES, set by start.sh).
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
from pathlib import Path

PATH = Path(__file__).resolve().parent / ".stack.env"


def jwt(secret, role):
    enc = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()  # noqa: E731
    now = int(time.time())
    head = enc(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = enc(json.dumps({"role": role, "iss": "oxy-codespace", "iat": now, "exp": now + 10 * 365 * 86400},
                          separators=(",", ":")).encode())
    sig = enc(hmac.new(secret.encode(), ("%s.%s" % (head, body)).encode(), hashlib.sha256).digest())
    return "%s.%s.%s" % (head, body, sig)


def read(path):
    out = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


def main(origin):
    env = read(PATH)
    if not env.get("SUPABASE_JWT_SECRET"):
        secret = secrets.token_urlsafe(48)
        env.update({
            "SUPABASE_JWT_SECRET": secret,
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": jwt(secret, "anon"),
            "SUPABASE_SERVICE_KEY": jwt(secret, "service_role"),
            "SUPABASE_VAULT_KEY": secrets.token_urlsafe(32),
            "POSTGRES_PASSWORD": secrets.token_urlsafe(24),
            "REDIS_PASSWORD": secrets.token_hex(24),
        })
    host = origin.split("://", 1)[-1].split(":", 1)[0]
    env.update({
        "NEXT_PUBLIC_SITE_URL": origin, "NEXT_PUBLIC_SUPABASE_URL": origin, "NEXT_PUBLIC_API_URL": origin + "/engine",
        "ALLOWED_ORIGINS": origin + ",http://localhost:3000", "API_EXTERNAL_URL": origin,
        "GOTRUE_SITE_URL": origin, "GOTRUE_URI_ALLOW_LIST": "%s,%s/auth/callback" % (origin, origin),
        "NEXT_ALLOWED_DEV_ORIGINS": host,
    })
    text = "# Made by .devcontainer/stack_env.py; this codespace's own secrets. Not in git.\n" + \
        "".join("%s=%s\n" % kv for kv in sorted(env.items()))
    fd = os.open(PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(text)
    os.chmod(PATH, 0o600)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
