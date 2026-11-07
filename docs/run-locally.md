# Run TorobTicket locally

Install Docker Engine/Desktop with the Docker Compose plugin (tested Engine
29.5.3 and Compose 5.1.4).
From the repository root, run:

```sh
pnpm docker:up
```

This builds the applications inside Docker, waits for PostgreSQL, runs
migrations and the idempotent versioned seed, starts the API, waits for readiness,
and serves the consumer at <http://localhost:4300/> and admin at
<http://localhost:4301/admin/> (separate container), plus the provider on the other
loopback hostname at port4310. No `.env` copy, local database, manual migration,
seed, login, or local compilation is required. The runner needs Node 24.17.0
and pnpm 11.9.0, but does not need host `node_modules` or a host install.
First build downloads images, Debian packages and dependencies;
the comparison/referral runtime then uses local inventory, fonts, artwork and geography. The on-demand hotel street-map picker is the explicit exception: it requests public OpenStreetMap vector styles/tiles/glyphs/sprites when opened. No account/key is required; if those requests fail, the local landmark list and coordinate selection remain usable. Essential comparison and referral do not require that map service.

Without local Node/pnpm, the equivalent is:

```sh
docker compose up --build --wait --wait-timeout 120
```

Use the Node runner once when upgrading from the previous combined gateway;
it retires only that owned legacy container before taking its port. Fresh
Node-free startup can use the command above. Use the URLs after it succeeds. Logs and exit status report
initialization/readiness failure; inspect `docker compose ps --all` and
`docker compose logs --tail 80`. The Node runner also prints those diagnostics
and checks API/frontend readiness through both frontend ports before printing the effective URLs.

Optional shell overrides (or `.env`, see `.env.example`):

```sh
TOROBTICKET_PORT=4399 TOROBTICKET_ADMIN_PORT=4401 TOROBTICKET_EXAMPLE_PROVIDER_PORT=4410 COMPOSE_PROJECT_NAME=torobticket-review pnpm docker:up
```

All three published ports bind `127.0.0.1`; web4300, admin4301 and provider4310
run in separate containers. Web/admin use the same canonical hostname to share
the reviewer workspace across ports; the provider uses a different hostname. API port 4302 and PostgreSQL port
5432 remain internal to Compose. Database credentials are fixed local demo
credentials in `compose.yaml`; this stack is for local review. A different
Compose project name creates an independent named database volume. Use the
same overrides for every lifecycle command so they target the intended project.

```sh
pnpm docker:down    # remove project containers/network; preserve database volume
pnpm docker:up      # rerun initialization safely; retain reviewer sessions
pnpm docker:reset   # explicitly remove project containers AND database volume
```

Node-free packaged shutdown/reset equivalents are `docker compose down` and
`docker compose down --volumes`. Startup never removes volumes. Reset is
irreversible for that project's local reviewer data. No prune command is used.

## Docker development with hot reload

With Docker running, use:

```sh
pnpm docker:dev
```

This uses `compose.yaml` plus `compose.dev.yaml`. It starts Vite for the consumer
and admin and a TypeScript source watcher for Nest, all inside Docker. The command
returns after readiness; the container watchers continue running. The consumer uses port4300, admin4301 and provider4310, with the same database
and provider volumes as packaged mode. Each frontend proxies its own `/api` path.
The published port overrides and `COMPOSE_PROJECT_NAME` work in both modes.

Save files under `apps/` or `libs/` to refresh the relevant frontend or recompile
and restart the API. Each frontend WebSocket connects directly to its own published port. Shared library directories are watched for
replacement saves and newly added modules. The API watches its actual TypeScript
dependency graph, emits and resolves aliases inside the container, and restarts
after a successful compilation. A type error leaves the last working process
running and prints the diagnostic to its logs. API restarts retain completed
server evidence; in-flight searches follow the existing interrupted-search recovery.

Source binds are read-only. Linux `node_modules`, per-container `.dev` caches and
the named `dev_prisma` generated-client volume never use host build artifacts.
The runner creates only the empty ignored `libs/data-access/src/generated`
mountpoint when absent; it does not remove or rewrite existing host contents.

Without local Node/pnpm, prepare that empty mountpoint before direct Compose:

```sh
mkdir -p libs/data-access/src/generated
docker compose -f compose.yaml -f compose.dev.yaml up --build --wait --wait-timeout 120
```

For Node-free development shutdown, use `docker compose -f compose.yaml -f
compose.dev.yaml down`. The frontend services now exist in both Compose modes.

The first development build installs the pinned dependencies. Ordinary source
saves do not build images or recreate containers. After changing dependencies,
lockfiles, Prisma schema/migrations or runtime tools, rerun `pnpm docker:dev`.
Author migrations explicitly; startup applies committed migrations and the
idempotent seed. It never creates a migration or resets the database.

For Docker hosts that do not deliver file notifications reliably:

```sh
TOROBTICKET_DEV_POLLING=true pnpm docker:dev
```

Polling increases file-check activity; normal notification-based watching is the
default. Inspect both frontend and compiler logs with:

```sh
docker compose -f compose.yaml -f compose.dev.yaml logs --follow web admin api
```

Switch back with `pnpm docker:up`; Compose replaces the same web/admin services
with their independent packaged images. The runner retires only a labelled,
same-project legacy gateway after builds succeed and before binding its old port.
`pnpm docker:down` stops either mode and preserves volumes. The explicit
`pnpm docker:reset` also removes only the labelled generated-client cache along
with its already-documented project database reset. These lifecycle commands
honor the selected project; there is no global container or volume prune.

## Packaging and architecture

`infra/Dockerfile` has initializer, API and provider targets.
`infra/Dockerfile.frontends` builds web/admin independently of Prisma and Debian
packages, with separate Caddy images containing only their own assets. App builds
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

Separate Caddy containers serve `/` on4300 and `/admin/` on4301, including consumer
`/provider-demo/*` routes; API paths always proxy to Nest and retain JSON errors.
Hashed Vite assets are immutable for a year. HTML, theme bootstrap and currently
unhashed local fonts require revalidation. Missing font/script assets return
404. API proxy flushing is immediate (`flush_interval -1`) for actual search SSE. Local geography, license and provenance paths are served as files; missing files return404 instead of an HTML application shell.

## Current product and packaging verification

The seed preserves `foundation-v1` and all three immutable showcase versions.
New sessions use `showcase-v3` / `catalog-v3`:34 cities,348 directed mode/scope
connections,476 hotels,114 places and1,428 relative room templates, with12 distinct
services and four sellers for ordinary supported searches. Existing sessions keep
their original catalog. Search, date-price exploration,
provider comparison, hotel discovery, referral handoff and session-isolated
admin evidence are implemented. Normal, delayed, failed, changed-price, sold-out,
conflicting-source and empty profiles are available through admin controls;
traveler UI remains ordinary product copy. Sessions preserve completed evidence
across container recreation. Previously collecting searches become interrupted
on API restart and expose explicit retry; they do not pretend in-memory work resumed.

The build packages all app-owned fonts, geography, shader code and authored flat
art. The lazy MapLibre SDK/worker/CSS are bundled; the optional street-map content
comes from OpenFreeMap (`tiles.openfreemap.org`), using OpenStreetMap data and
OpenMapTiles. There is no tile proxy, background download,
external OAuth/provider connection or runtime model dependency. A blocked map
service produces an explicit unavailable state alongside local location controls.

Behavior tests: `pnpm test:docker-runner`. Current packaged verification uses
`pnpm verify:release`, documented below, against an explicitly selected running
loopback stack. It checks HTTP/assets and selected browser behavior without
resetting or replacing that stack's data.

The older `tools/verify-docker-foundation.mjs` and T29 ownership override belong
to the historical gateway-layout rehearsal. Its original commands and override
are available in the archived T29 snapshot.
They are not the startup instructions for the current separate web/admin/provider
layout. Use `pnpm docker:down` to stop current services while retaining data.

## Bounded release verification

With the packaged stack already ready, install the pinned host verification
dependencies once using `pnpm install --frozen-lockfile`, then run:

```sh
pnpm verify:release --base-url http://localhost:4300 --report-dir .local/evidence/release/local-smoke-001 --browser-channel chrome
pnpm verify:release --base-url http://localhost:4300 --report-dir .local/evidence/release/local-quality-001 --profile quality --browser-channel chrome
```

Each report directory must be new. Omit `--browser-channel` to use installed
Playwright Chromium. For custom origins use the canonical traveler URL printed by
startup (`TOROBTICKET_SSO_ORIGIN`), with the matching admin origin. Frontend page
navigation redirects aliases before bootstrap; direct API verification requires
the canonical origin so its cookies match the browser's workspace.
Smoke checks readiness, exact packaged local assets, strict
host dependency state and seven real browser journeys. Quality also runs serial
lint/type/unit/build and fixed tooling checks. Both create fresh reviewer
namespaces and clean up those namespaces; they do not restart Docker, reset
existing reviewer data, provision databases or install missing dependencies.
The optional `--postgres` gate requires an explicit existing validated
`TEST_DATABASE_URL` ending in `_test`; without it the gate is reported skipped.
The JSON report records selected scope, source state, timeouts and sanitized
bounded logs. Passing smoke is not full release certification.

Workspace `verifyDepsBeforeRun` is disabled so the built-ins-only Docker
shortcut can run from an uninstalled checkout. Verification explicitly restores
the strict dependency check before running source checks; an ordinary bare
source script no longer provides that check. Real restart/failure injection is
separate from this verifier; see the [Docker rehearsal](evidence/release/docker-rehearsal.md)
and [offline-runtime record](evidence/release/offline-runtime.md).

For a port conflict choose an unused `TOROBTICKET_PORT` and keep the same
`COMPOSE_PROJECT_NAME`/`COMPOSE_FILE` throughout that stack's lifecycle. For
registry or image download failures, inspect the actual build output and retry
with the documented public registry mirror overrides in `.env.example`; retain
the frozen lockfile. No automatic volume deletion is needed for either issue.
Architecture support is described above; a successful arm64 rehearsal does not
establish an amd64 run.


## Separate provider website

The fourth app, `example-provider`, runs its Node backend on4310 with a separate
hostname from the canonical `TOROBTICKET_SSO_ORIGIN`. It is included in normal
build/start and both Compose modes. Setup, environment settings, persistent local
store and the traveler consent walkthrough are in
[Direct Login integration](direct-login-integration.md#separate-provider-website-and-traveler-profile).


## Separate frontend navigation

Legacy main-site `/admin/*` links redirect to the admin port. Admin `/` redirects
to `/admin/`, and its **Open travel search** links use `/travel` to return to the
configured canonical web origin. Stored consumer handoff/reference links also
redirect to that origin. Admin does not serve the consumer app, and the consumer
container has no admin assets. For public custom origins use
`TOROBTICKET_SSO_ORIGIN` and optional `TOROBTICKET_ADMIN_ORIGIN`; admin must retain
the web hostname and scheme, with its own port. The provider still requires a
different hostname. API Direct Login admin writes allow only those exact admin/web
origins; phone/profile/consent remain restricted to the web origin.

Release verification accepts `--admin-url http://127.0.0.1:4301` (default4301 on
the selected web hostname). For isolated stacks set that argument to the actual
admin port; startup scripts/assets are verified at their respective origins.
