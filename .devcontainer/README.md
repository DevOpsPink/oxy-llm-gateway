# The devcontainer (GitHub Codespaces)

`devcontainer.json` starts an Ubuntu container with Docker inside it, then
`start.sh`, which brings up the whole stack with the recording fake provider
from `proofs/` (no model provider, no key) and makes a fresh demo
organization, project, API key and agent session with `demo_setup.py`. The
key and the session ids go to `~/.oxy-demo.env` in the container, which new
terminals load; the demo user's password is random and written nowhere. A
restart makes a new demo organization.

The dashboard, GoTrue, PostgREST and the engine share port 3080 through
`demo-proxy.conf` (`/`, `/auth/v1`, `/rest/v1`, `/engine`). Codespaces forwards
every port on its own private origin, and a dashboard page cannot call another
private origin, so one origin is the way the browser can sign in. Mailpit is on
port 8025, the engine also on 8000 inside the codespace.

`check.sh` is what CI runs inside the same devcontainer (job "Codespace
devcontainer, smoke and the README's requests"): `scripts/stack_smoke.sh`, the
proxy, and the three requests from README.md exactly as printed there, which
must answer 200, 451, 200 and 410.

## What it uses

Measured with the devcontainer CLI 0.90.0 on 2026-11-15, right after `check.sh`:

| | |
|---|---|
| containers | 16 (the stack, the fake provider, the proxy) |
| memory of the containers | about 1.5 GB (the dashboard's dev server 0.7 GB, the engine 0.16 GB) |
| memory used in the container's VM | 3.5 GB, page cache excluded |
| disk | 4.7 GB of images, 4.7 GB of build cache, 2.5 GB of volumes |

Hence `hostRequirements`: 4 cores (the build), 8 GB of memory and 32 GB of
storage; Codespaces' 4-core machine has 16 GB and 32 GB.
