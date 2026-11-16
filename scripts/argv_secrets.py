#!/usr/bin/env python3
"""No secret on a command line: not in a compose command, an entrypoint or a
health check, and not in any process the running stack starts.

    scripts/argv_secrets.py static     render every compose stack with a random
                                       value planted in each secret-named
                                       variable; fail when one lands in a
                                       service's command, entrypoint or health
                                       check test
    scripts/argv_secrets.py selftest   the same check on a copy with the 1.0.3
                                       forms planted back (redis-cli -a, a URL
                                       with the password in a health check, the
                                       vault key in Postgres's command): it must
                                       find each of them
    scripts/argv_secrets.py runtime    on a running stack: freeze Redis, run every
                                       service's health check by hand so each
                                       stays in flight, sample the host's `ps`
                                       five times a second, and fail when a
                                       secret the stack was given shows up. A
                                       canary started in a container first must
                                       be seen, or the sampler proves nothing

A secret on a command line is readable by every user of the host with `ps`
for as long as the process runs; a health check runs every few seconds. Up to
1.0.3 the Redis password sat in four health checks and the vault key in the
postmaster's command line. Names are printed, never values.
"""
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECRET_NAME = re.compile(r"(PASSWORD|SECRET|_KEY|TOKEN|CREDENTIAL)", re.I)
STACKS = [
    ["docker-compose.yml"],
    ["docker-compose.yml", "proofs/docker-compose.proofs.yml"],
    ["docker-compose.yml", "proofs/docker-compose.proofs.yml", ".devcontainer/compose.codespaces.yml"],
    ["docker-compose.prod.yml"],
]
# env_file entries the prod stack names; absent in a clean clone. Created empty
# for the render and removed after, only when this script created them.
ENV_FILES = ["packages/engine/.env", "packages/ui/.env.local"]


def secret_names(files):
    names = set()
    for f in files:
        for m in re.finditer(r"\$\{([A-Z0-9_]+)", (ROOT / f).read_text()):
            if SECRET_NAME.search(m.group(1)):
                names.add(m.group(1))
    return sorted(names)


def render(files, env):
    args = ["docker", "compose", "--project-directory", str(ROOT)]
    for f in files:
        args += ["-f", str(ROOT / f) if not os.path.isabs(f) else f]
    r = subprocess.run(args + ["config", "--format", "json"], env=env, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("docker compose config failed for %s: %s" % (" + ".join(files), r.stderr.strip()[:300]))
    return json.loads(r.stdout)["services"]


def as_text(value):
    if value is None:
        return ""
    return " ".join(value) if isinstance(value, list) else str(value)


def allowed(service, field, text):
    # redis-server rewrites its own command line at start ("redis-server *:6379"),
    # so --requirepass does not stay in ps: the fleet's rule allows it too.
    return field == "command" and text.lstrip().startswith("redis-server")


def findings(files):
    planted = {n: "plant" + secrets.token_hex(12) for n in secret_names(files)}
    env = {**os.environ, **planted}
    out = []
    for service, spec in render(files, env).items():
        fields = {"command": as_text(spec.get("command")), "entrypoint": as_text(spec.get("entrypoint")),
                  "healthcheck": as_text((spec.get("healthcheck") or {}).get("test"))}
        for field, text in fields.items():
            for name, value in planted.items():
                if value in text and not allowed(service, field, text):
                    out.append("%s: %s: %s carries %s" % (" + ".join(Path(f).name for f in files), service, field, name))
    return out, len(planted)


def with_env_files(fn):
    made = []
    try:
        for f in ENV_FILES:
            p = ROOT / f
            if not p.exists():
                p.write_text("")
                made.append(p)
        return fn()
    finally:
        for p in made:
            p.unlink()


def static():
    def run():
        bad, total = [], 0
        for files in STACKS:
            found, n = findings(files)
            bad += found
            total += n
        return bad, total
    bad, total = with_env_files(run)
    for line in bad:
        print("FOUND  " + line)
    print("%d stacks, %d secret values planted: %d on a command line" % (len(STACKS), total, len(bad)))
    return 1 if bad else 0


PLANTED_1_0_3 = """
services:
  worker-intelligence:
    healthcheck:
      test: ["CMD", "python", "-c", "import redis; redis.from_url('redis://:${REDIS_PASSWORD}@redis:6379/0').ping()"]
  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
  postgres:
    command: ["postgres", "-c", "app.vault_key=${SUPABASE_VAULT_KEY}"]
"""


def selftest():
    with tempfile.NamedTemporaryFile("w", suffix=".yml", delete=False) as f:
        f.write(PLANTED_1_0_3)
        plant = f.name
    try:
        found, _ = with_env_files(lambda: findings(["docker-compose.yml", plant]))
    finally:
        os.unlink(plant)
    want = {("worker-intelligence", "healthcheck", "REDIS_PASSWORD"), ("redis", "healthcheck", "REDIS_PASSWORD"),
            ("postgres", "command", "SUPABASE_VAULT_KEY")}
    got = {tuple(x.split(": ", 1)[1].replace(" carries ", ": ").split(": ")) for x in found}
    missed = want - got
    for w in sorted(want):
        print("%-7s planted %s %s with %s" % ("CAUGHT" if w not in missed else "MISSED", w[0], w[1], w[2]))
    return 1 if missed else 0


def compose(*args, **kw):
    files = os.environ.get("COMPOSE_FILE", "docker-compose.yml").split(os.pathsep)
    cmd = ["docker", "compose", "--project-directory", str(ROOT)]
    for f in files:
        cmd += ["-f", str(ROOT / f)]
    return subprocess.run(cmd + list(args), capture_output=True, text=True, **kw)


def runtime():
    services = json.loads(compose("config", "--format", "json").stdout)["services"]
    values = {}
    for spec in services.values():
        env = spec.get("environment") or {}
        for name, value in (env.items() if isinstance(env, dict) else []):
            if SECRET_NAME.search(name) and value and len(str(value)) >= 8:
                values.setdefault(str(value), name)
    canary = "canary" + secrets.token_hex(12)
    values[canary] = "the canary"
    fd, pattern_file = tempfile.mkstemp()
    os.chmod(pattern_file, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write("\n".join(values) + "\n")
    seen = set()

    def sample(seconds):
        end = time.time() + seconds
        while time.time() < end:
            ps = subprocess.run(["ps", "-eo", "args"], capture_output=True, text=True).stdout
            hit = subprocess.run(["grep", "-oF", "-f", pattern_file], input=ps, capture_output=True, text=True).stdout
            seen.update(h for h in hit.splitlines() if h)
            time.sleep(0.2)

    try:
        # The canary: a process in a container whose command line carries it. Two
        # commands, so the shell stays: with one, sh execs it and $0 is gone.
        started = compose("exec", "-d", "-T", "redis", "sh", "-c", "sleep 20; true", canary)
        sample(4)
        if canary not in seen:
            print("FAIL: the sampler did not see the canary in a container's command line; it proves nothing"
                  + ("" if started.returncode == 0 else " (starting it failed: %s)" % started.stderr.strip()[:200]))
            return 1
        # Redis frozen, every other service's health check run by hand: each one
        # blocks on Redis and stays on the process table while ps is read.
        compose("pause", "redis")
        checks = []
        for name, spec in services.items():
            test = (spec.get("healthcheck") or {}).get("test")
            if name == "redis" or not test or test[0] not in ("CMD", "CMD-SHELL"):
                continue
            args = test[1:] if test[0] == "CMD" else ["sh", "-c", test[1]]
            checks.append(name)
            subprocess.Popen(["docker", "compose", "--project-directory", str(ROOT)]
                             + sum((["-f", str(ROOT / f)] for f in os.environ.get("COMPOSE_FILE", "docker-compose.yml").split(os.pathsep)), [])
                             + ["exec", "-T", name] + args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        sample(8)
    finally:
        compose("unpause", "redis")
        os.unlink(pattern_file)
    leaked = sorted({values[v] for v in seen if v != canary})
    for name in leaked:
        print("FOUND  %s on a command line" % name)
    print("%d secret values watched, %d health checks held in flight (%s), canary seen: %d leaked"
          % (len(values) - 1, len(checks), ", ".join(sorted(checks)), len(leaked)))
    return 1 if leaked else 0


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode not in ("static", "selftest", "runtime"):
        sys.exit(__doc__)
    sys.exit({"static": static, "selftest": selftest, "runtime": runtime}[mode]())
