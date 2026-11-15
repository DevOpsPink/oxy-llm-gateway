#!/usr/bin/env python3
"""status.py OUT_DIR - what the proofs have shown lately, as JSON a page or a
badge can read.

    GITHUB_REPOSITORY=owner/name GITHUB_TOKEN=... CI_WORKFLOW=ci.yml \\
        scripts/status.py out/status

Reads the CI workflow's runs on main over the last 30 days (pushes, the daily
schedule, manual runs; never pull requests, never cancelled runs) and the
proofs the latest finished run uploaded (artifact `proofs`: results.json and
plants.json from proofs/run_proofs.py and proofs/plant_violations.py).
Writes:

    status.json             the window, the streak, the latest run's checks
                            (one per proof, one for the planted violations)
                            and measurements
    badge-days.json         shields.io endpoint: green days in the window
    badge-checks.json       shields.io endpoint: the latest run's checks

A day counts as green when its last finished run passed; the run count beside
it shows the failures that rule hides. The streak counts green days back from
the latest day that had a run. Nothing here is typed by hand: every number is
read from GitHub at the time it is written. The same shape as
heyvaldemar/kubernetes-llm-inference-gateway's status branch.
"""
import datetime
import io
import json
import os
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "proofs"))
import summary  # noqa: E402  (proofs/summary.py: one line per proof)

API = "https://api.github.com"
WINDOW_DAYS = 30


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def get(url, raw=False):
    req = urllib.request.Request(url if url.startswith("http") else API + url)
    req.add_header("Authorization", "Bearer " + os.environ["GITHUB_TOKEN"])
    req.add_header("Accept", "application/vnd.github+json")
    try:
        with urllib.request.build_opener(_NoRedirect).open(req, timeout=60) as r:
            body = r.read()
    except urllib.error.HTTPError as e:
        # An artifact download answers with a redirect to signed storage,
        # which rejects the API's Authorization header: follow it without.
        if e.code not in (301, 302, 303, 307, 308) or not e.headers.get("Location"):
            raise
        with urllib.request.urlopen(e.headers["Location"], timeout=120) as r:
            body = r.read()
    return body if raw else json.loads(body)


def runs(repo, workflow, since):
    out, page = [], 1
    while True:
        batch = get(f"/repos/{repo}/actions/workflows/{workflow}/runs?branch=main&per_page=100&page={page}"
                    f"&created=%3E%3D{since:%Y-%m-%d}")["workflow_runs"]
        out += batch
        if len(batch) < 100:
            return out
        page += 1


def proofs(repo, run_id):
    """results.json and plants.json from the run's `proofs` artifact; None when it has none."""
    arts = [a for a in get(f"/repos/{repo}/actions/runs/{run_id}/artifacts")["artifacts"]
            if a["name"] == "proofs" and not a["expired"]]
    if not arts:
        return None
    z = zipfile.ZipFile(io.BytesIO(get(arts[0]["archive_download_url"], raw=True)))
    names = set(z.namelist())
    read = lambda n: json.loads(z.read(n)) if n in names else {}  # noqa: E731
    return read("results.json"), read("plants.json")


def checks_and_measured(results, plants):
    checks, measured = [], []
    for key, claim, text, holds, _caught in summary.rows(results, plants):
        checks.append({"state": "PASS" if holds else "FAIL", "name": f"{claim}: {text}"})
    if plants:
        caught = sum(1 for p in plants.values() if p.get("caught"))
        checks.append({"state": "PASS" if caught == len(plants) else "FAIL",
                       "name": f"every proof shown its planted violation (proofs/plant_violations.py): "
                               f"{len(plants)} plants: {caught} caught, {len(plants) - caught} missed"})
    b, d, k = results.get("budget") or {}, results.get("dlp") or {}, results.get("kill") or {}
    if b:
        measured.append(f"budget overspend: ${b.get('overspend_usd')} ({b.get('requests')} requests, "
                        f"{b.get('concurrent')} at a time, ${b.get('budget_usd')} budget)")
    if d:
        measured.append(f"secrets past DLP: {d.get('reached_provider')} of {d.get('secret_types')}")
    if k:
        measured.append(f"requests past the kill switch: {k.get('reached_provider_after_kill')} of "
                        f"{k.get('requests_after_kill')} (first refusal {k.get('first_blocked_response_ms')} ms after the kill)")
    a = results.get("audit") or {}
    if a:
        measured.append(f"requests audited: {a.get('request_log_rows')} of {a.get('requests_sent')}")
    return checks, measured


def badge(label, message, color):
    return {"schemaVersion": 1, "label": label, "message": message, "color": color}


def main(out):
    repo, workflow = os.environ["GITHUB_REPOSITORY"], os.environ["CI_WORKFLOW"]
    now = datetime.datetime.now(datetime.timezone.utc)
    since = (now - datetime.timedelta(days=WINDOW_DAYS - 1)).date()
    finished = [r for r in runs(repo, workflow, since)
                if r["event"] in ("push", "schedule", "workflow_dispatch")
                and r["status"] == "completed" and r["conclusion"] in ("success", "failure")]
    finished.sort(key=lambda r: r["created_at"])

    last_of_day = {}
    for r in finished:
        last_of_day[r["created_at"][:10]] = r["conclusion"]
    days = sorted(last_of_day)
    green = [d for d in days if last_of_day[d] == "success"]
    streak = 0
    for d in reversed(days):
        if last_of_day[d] != "success":
            break
        streak += 1

    latest = finished[-1] if finished else None
    got = proofs(repo, latest["id"]) if latest else None
    checks, measured = checks_and_measured(*got) if got else ([], [])
    passed = sum(1 for c in checks if c["state"] == "PASS")
    failed = sum(1 for c in checks if c["state"] == "FAIL")

    status = {
        "repository": repo,
        "workflow": workflow,
        "written_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "window_days": WINDOW_DAYS,
        "days_with_runs": len(days),
        "green_days": len(green),
        "streak_days": streak,
        "runs": len(finished),
        "runs_passed": sum(1 for r in finished if r["conclusion"] == "success"),
        "latest": None if not latest else {
            "conclusion": latest["conclusion"],
            "at": latest["created_at"],
            "url": latest["html_url"],
            "commit": latest["head_sha"][:7],
            "checks_passed": passed,
            "checks_failed": failed,
            "checks": checks,
            "measured": measured,
        },
    }
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "status.json"), "w") as f:
        json.dump(status, f, indent=2)

    if days:
        color = "brightgreen" if len(green) == len(days) else ("yellow" if len(green) >= 0.9 * len(days) else "red")
        msg = f"{len(green)} of {len(days)} days green, {status['runs_passed']} of {len(finished)} runs"
    else:
        color, msg = "lightgrey", "no runs yet"
    with open(os.path.join(out, "badge-days.json"), "w") as f:
        json.dump(badge(f"proofs, last {WINDOW_DAYS} days", msg, color), f)
    if checks:
        with open(os.path.join(out, "badge-checks.json"), "w") as f:
            json.dump(badge("proofs", f"{passed} of {passed + failed} hold, {latest['created_at'][:10]}",
                            "brightgreen" if not failed else "red"), f)
    print(f"{repo}: {len(green)} of {len(days)} days green, streak {streak}, "
          f"latest {latest['conclusion'] if latest else 'none'} with {passed} of {passed + failed} checks")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
