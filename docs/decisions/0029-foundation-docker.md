# 0029 — Early foundation Docker packaging

## Owner clarification — Docker serves the app, 2026-10-29

The existing gateway serves both built frontends directly from its image at `/`
and `/admin/`; a host `pnpm start` or Vite server is unnecessary. Keep this
packaged path as the primary README startup. This confirms the existing runtime
boundary and adds no service, bind mount or development-server dependency.

The Docker daemon was stopped at this check. Starting Docker Desktop and running
`pnpm docker:up` built all applications, completed initialization and brought the
database, API and gateway to healthy status. Thirteen HTTP checks passed, and
served HTML hashes matched `/srv/web/index.html` and `/srv/admin/index.html`
inside Caddy. The original database container and volume were retained. See
[the runtime checkpoint](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/docker-serving/checkpoint.md).

Date: 2026-10-24. Status: accepted implementation ruling within T29 early scope.

The four-service local stack uses immutable official multi-platform image indexes,
all app compilation inside Docker, one successful migration/idempotent foundation
seed initializer before API start, and database-backed readiness before Caddy.
Only Caddy publishes a loopback port. The API runs as the unprivileged Node user
with production dependencies and explicit Debian OpenSSL runtime support.

Caddy owns independent consumer/admin SPA fallbacks, API forwarding without HTML
error replacement and immediate proxy flush for future SSE. Existing font and
theme assets remain local and revalidate; Vite content hashes earn immutable
caching. Missing assets return 404. Provider-demo paths resolve the consumer shell
until their product route implementation arrives.

No rich catalog or search endpoint is introduced by packaging. T05 inventory,
T09 SSE delivery/replay, future geography/art integration and full T33 clean-start
acceptance remain pending. Parent T29 remains ACTIVE. Native foundation runtime
verification covers arm64 only; amd64 is a documented supported-index build path.


## M7 completion ruling — 2026-10-26

T29 finishes gateway/assets acceptance against the current M6 product rather than treating foundation404 checks as stream evidence. Geography/license/provenance paths receive explicit file handling, including404 for missing files, with revalidation; only content-hashed build assets receive immutable caching. Consumer/admin SPA fallbacks remain independent, while API errors preserve their real401/404 JSON semantics and search SSE flushes actual ordered frames.

The retained `verify-docker-foundation.mjs` maintainer command now rejects default/unowned projects before Docker operations, requires matching owner labels on all containers/volume, verifies current rich inventory/three migrations, holds the opaque cookie only in memory, consumes a real collecting stream to terminal, and recreates the owned stack without deleting its volume. It proves unchanged completed search/session evidence after the actual startup runner executes again; valid session resume correctly does not echo its captured credential. Default reviewer data is never reset by acceptance.

Runtime independence includes all app-owned assets and comparison/referral APIs. The owner-approved hotel street-map exception remains explicit: MapLibre code is local and lazy, public OSM vector content is fetched only on demand, and local list/coordinate selection survives network failure. No offline tile copy/prefetch or provider fallback is introduced. Full clean-checkout, blocked-network, reset/restart rehearsal remains T33.
