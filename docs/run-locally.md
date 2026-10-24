# Run TorobTicket locally

Install Docker Engine/Desktop with the Docker Compose plugin (tested Engine
29.5.3 and Compose 5.1.4).
From the repository root, run:

```sh
pnpm docker:up
```

This builds all three applications inside Docker, waits for PostgreSQL, runs
migrations and the idempotent versioned seed, starts the API, waits for readiness,
and serves the consumer at <http://localhost:4300/> and admin at
<http://localhost:4300/admin/>. No `.env` copy, local database, manual migration,
seed, login, or local compilation is required. The runner needs Node 24.17.0
and pnpm 11.9.0. First build downloads images, Debian packages and dependencies;
subsequent runtime has no external service requirement.

Without local Node/pnpm, the equivalent is:

```sh
docker compose up --build --wait --wait-timeout 120
```

Use the URLs above after this command succeeds. Logs and exit status report
initialization/readiness failure; inspect `docker compose ps --all` and
`docker compose logs --tail 80`. The Node runner also prints those diagnostics
and checks readiness through the gateway before printing the effective URLs.

Optional shell overrides (or `.env`, see `.env.example`):

```sh
TOROBTICKET_PORT=4399 COMPOSE_PROJECT_NAME=torobticket-review pnpm docker:up
```

The only published port binds `127.0.0.1`. API port 4302 and PostgreSQL port
5432 remain internal to Compose. Database credentials are fixed local demo
credentials in `compose.yaml`; this stack is for local review. A different
Compose project name creates an independent named database volume. Use the
same overrides for every lifecycle command so they target the intended project.

```sh
pnpm docker:down    # remove project containers/network; preserve database volume
pnpm docker:up      # rerun initialization safely; retain reviewer sessions
pnpm docker:reset   # explicitly remove project containers AND database volume
```

Node-free shutdown/reset equivalents are `docker compose down` and
`docker compose down --volumes`. Startup never removes volumes. Reset is
irreversible for that project's local reviewer data. No prune command is used.

## Packaging and architecture

`infra/Dockerfile` has initializer, API and Caddy gateway targets. App builds
and Prisma generation/seed compilation run inside the build stage. The API
runs as the Node user with production dependencies and explicit OpenSSL runtime
support. Immutable multi-platform Node 24.17.0, PostgreSQL 17.11 and Caddy 2.11.7
indexes are pinned in Dockerfile/Compose; source manifest evidence is recorded
under `docs/evidence/T01` and `docs/evidence/T29`.

Docker selects the native platform by default. Linux arm64 has actual foundation
runtime evidence. The approved indexes also support amd64; its build path is:

```sh
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose up --wait --wait-timeout 120
```

For explicit arm64 builds substitute `linux/arm64`. An amd64 host can run its
native build; other hosts need configured emulation. amd64 build/runtime and
cross-platform parity have not been verified by the arm64 foundation run.

Caddy serves independent `/` and `/admin/` SPA fallbacks and consumer
`/provider-demo/*` routes; API paths always proxy to Nest and retain JSON errors.
Hashed Vite assets are immutable for a year. HTML, theme bootstrap and currently
unhashed local fonts require revalidation. Missing font/script assets return
404. API proxy flushing is immediate (`flush_interval -1`) for future SSE.

## Current foundation scope and verification

The seed contains only `foundation-v1`; rich catalog inventory is authored in
T05. The consumer/admin currently expose their approved foundation UI. Real
searches, search SSE first-event/replay behavior (T09), geographic data, art and
later product routes remain pending integration. Gateway streaming configuration
is present; foundation 404 checks are not evidence of a working search stream.
Full T29 stays active; repeat complete demo acceptance in T33.

Behavior tests: `pnpm test:docker-runner`. To verify an owned disposable stack:

```sh
COMPOSE_PROJECT_NAME=torobticket-t29-review TOROBTICKET_PORT=4399 pnpm docker:up
COMPOSE_PROJECT_NAME=torobticket-t29-review TOROBTICKET_PORT=4399 node tools/verify-docker-foundation.mjs
COMPOSE_PROJECT_NAME=torobticket-t29-review pnpm docker:reset
```

The verification checks HTTP routing/cache/local asset bytes, real live/ready
responses, JSON errors and current-session persistence after complete container
recreation. It accepts only explicitly named `torobticket-t29-*` projects.
