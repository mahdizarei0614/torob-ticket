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
the comparison/referral runtime then uses local inventory, fonts, artwork and geography. The on-demand hotel street-map picker is the explicit exception: it requests public OpenStreetMap vector styles/tiles/glyphs/sprites when opened. No account/key is required; if those requests fail, the local landmark list and coordinate selection remain usable. Essential comparison and referral do not require that map service.

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
returns after readiness; the container watchers continue running. The consumer,
admin and API share <http://localhost:4300/> with the same database volume and
session cookies as packaged mode. Alternate `TOROBTICKET_PORT` and
`COMPOSE_PROJECT_NAME` overrides work in both modes.

Save files under `apps/` or `libs/` to refresh the relevant frontend or recompile
and restart the API. Both frontend WebSockets pass through Caddy on the published
port, with separate root/admin paths. Shared library directories are watched for
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
compose.dev.yaml down` so its two extra frontend services are also stopped.

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

Switch back with `pnpm docker:up`; its healthy packaged gateway replaces the dev
gateway before the runner removes only its labelled web/admin dev containers.
`pnpm docker:down` stops either mode and preserves volumes. The explicit
`pnpm docker:reset` also removes only the labelled generated-client cache along
with its already-documented project database reset. These lifecycle commands
honor the selected project; there is no global container or volume prune.

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
comes from `vector.openstreetmap.org`. There is no tile proxy, background download,
external OAuth/provider connection or runtime model dependency. A blocked map
service produces an explicit unavailable state alongside local location controls.

Behavior tests: `pnpm test:docker-runner`. Maintainers can run the actual HTTP
packaging verifier only against an explicitly owned disposable T29 stack. The
included override labels all four containers and its named volume:

```sh
export COMPOSE_PROJECT_NAME=torobticket-t29-m7
export TOROBTICKET_PORT=4329
export TOROBTICKET_VERIFY_OWNER=t29-m7
export COMPOSE_FILE=compose.yaml:docs/evidence/T29/m7-completion/compose-owned.yaml
pnpm docker:up
node tools/verify-docker-foundation.mjs
```

The retained verifier filename is historical; it checks the current product:
independent SPA/deep routes, real API status codes, cached hashed scripts,
revalidated exact local assets, actual ordered SSE data/terminal replay, full
search evidence and session-row persistence through container recreation, and
all three completed migrations. It refuses unowned/default targets before Docker
operations. It never prints opaque credentials. Full browser, offline-runtime,
reset and restart rehearsal is recorded separately in T33.

After inspection, remove only that disposable project/volume with the same shell
overrides via `pnpm docker:reset`; never reuse this command against a project
whose data you intend to preserve. Unset the four variables when returning to
the default4300 project.

Real database integration checks require an explicit owned disposable database
ending in `_test`; see `tools/setup-test-database.mjs` and its ownership guards.
Never point integration tests at the normal reviewer database.
