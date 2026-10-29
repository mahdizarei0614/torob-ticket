# TorobTicket

A Persian travel comparison and referral product in an Nx monorepo: React/Vite consumer and admin apps, a Nest API and eight bounded libraries. It includes compact flight/train/bus comparison, complete provider-owned round trips, linked date-price exploration, WebGL route animation, hotel discovery, local account flows, fresh quote checks and immutable provider handoffs. The English admin supports scoped provider controls, mapping corrections and factual evidence inspection. Providers, inventory, account authentication and provider landing pages are mocked for this local demonstration; there are no payments, real bookings, external OAuth or runtime provider integrations. See the [master tracker](docs/superpowers/plans/2026-10-24-torobticket-master-plan.md) for completed work and remaining M7 audits.

## Local development

Use Node **24.17.0** (`nvm use`) and pnpm **11.9.0**. The package manager is pinned in `package.json`; an existing Corepack installation can activate that exact version. No global configuration change is required.

```sh
pnpm install --frozen-lockfile
pnpm start
```

Consumer: http://127.0.0.1:4300/ · Admin: http://127.0.0.1:4301/admin/ · API liveness: http://127.0.0.1:4302/api/health/live.

The development frontends proxy `/api` to Nest. For the packaged same-origin gateway, database initialization, and one-command startup, see [Run locally](docs/run-locally.md). Liveness confirms the API process responds; `/api/health/ready` additionally checks the database, required migration, active showcase seed, and initial reconciliation. Direct development requires a PostgreSQL `DATABASE_URL`, followed by `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:seed` before database-backed routes are usable.

## Verification

```sh
pnpm nx run-many -t lint,typecheck,build --projects=web,admin,api
pnpm test
pnpm verify:boundaries
pnpm exec playwright install chromium
pnpm nx e2e e2e
pnpm nx run-many -t lint,typecheck,build
```

`pnpm test` runs the common standalone tool checks (`pnpm test:tools`) once, then all current Nx unit suites. Vitest defines application, pure/client, UI, and server-library environments; empty library targets report no tests until their owning task introduces behavior. Empty libraries contain no placeholder tests. Set `PLAYWRIGHT_CHANNEL=chrome` to use an already installed Chrome instead of bundled Chromium. E2E starts and stops its own three local servers; their ports must be available.

Real PostgreSQL integration checks require an **owned disposable PostgreSQL database**. Its simple database name must end in `_test`; the explicit PostgreSQL URL must have a host and no query parameters or fragment. Never point these tests at shared or valuable data: they exercise cleanup, schema constraints, and database connection recovery.

```sh
TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/torobticket_test pnpm nx run api:test-integration
```

The target first runs uncached `api:test-db-setup`: validate `TEST_DATABASE_URL`, generate the Prisma client, deploy migrations, then apply the idempotent foundation and showcase seeds. Setup assigns the verified test URL to the Prisma child processes and never falls back to `DATABASE_URL`. Both setup and every integration entrypoint validate before connecting. Tests cover real HTTP session creation/resume/reset, cookie isolation, readiness/recovery, scoped repositories, immutable evidence, transaction rollback, the guarded catalog, and legacy-session version preservation. Missing/unsafe URLs, unreachable PostgreSQL, or initialization failures fail the run rather than skipping it. To initialize separately, use the same test URL with `pnpm db:setup-test`; direct Vitest runs require that initialization first.

Session anchor inputs use UTC seconds with optional 1–3 fractional digits. Equivalent spellings resume the same session; stored/returned anchors use canonical milliseconds. Finer precision is rejected rather than truncated.

For changed projects, use `pnpm nx affected -t lint,typecheck,test,build --base=main --head=HEAD`, with the appropriate existing base ref. CI chooses the PR base or preceding commit and falls back to all projects on the first commit. `pnpm verify` runs the lint/typecheck/unit/build targets; integration and browser commands above remain separate. Remote GitHub CI and full-demo release acceptance are not established by local checks.

## Libraries and boundaries

The public aliases are `@torob-ticket/{contracts,domain,fixtures,provider-adapters,data-access,client,ui,graphics}`. Each has lint/typecheck/declaration-build/test targets. Exact tags and allowed dependencies are documented in [decision 0001](docs/decisions/0001-foundation.md).

Create a tagged library with the reusable local scaffold:

```sh
pnpm generate:library example-helper domain shared
pnpm generate:library example-repository data server
```

The generator refuses existing names and invalid scope/type combinations. Add its first behavior test alongside the implementation. The aligned installed `@nx/js` generator is also available (`pnpm nx g @nx/js:library --help`) for larger standard scaffolds; use the documented tags and verify boundaries afterward.

See the approved specification in `docs/superpowers/specs`, task verification in `docs/evidence/T01`, and architecture decisions in `docs/decisions`.

Verification regressions exercise real Nx cache hits in disposable workspaces: dependency export changes invalidate consumer typechecks, and root test-setup changes invalidate UI tests. `pnpm test` and CI `test:tools` include those checks. The boundary verifier checks production Vitest rejection, unit-test allowance, and retained server-import restrictions. Library scaffolding checks all Nx project names, including applications, before writing a new library.

## Deterministic showcase catalog

The current catalog supplies 34 cities, 114 places, 348 directed mode/scope
connections, six mock providers, 476 fictional hotels and 1,428 relative room-rate
templates. Ordinary supported dates/classes have 12 distinct services and four
sellers. New sessions use `showcase-v3` / `catalog-v3`;
`GET /api/v1/catalog` requires the session cookie. London,Paris,Frankfurt,
NewYork,LosAngeles,Toronto,Singapore,Bangkok,Tokyo,Sydney andAuckland have
complete one/two/three-stop flight alternatives and reverse/round-trip coverage.
Domestic routes include 156 directions between non-Tehran cities. International
rail beyond Van explicitly includes the Van–Tatvan road connector between trains
in the same supplied fare, with unknown protection/baggage conditions. Baku is
air-only in the new catalog. Same-day returns must depart after outbound arrival.
Public provider research calibrates bounded authored prices and conditions;
the runtime does not query those sites. Airline and bus/train brand PNGs load locally.

Existing sessions retain their original immutable catalog and quote evidence.
Use a fresh/private browser session to explore the expanded inventory; an
explicit operations reset also starts the latest version but clears that
session's mutable evidence. Reseeding inserts all three rich catalog versions without
rewriting any prior root, raw source, fare policy or hotel template. Foundation sessions retain their empty foundation catalog.
`generateProviderRecords(FixtureQuery)` and `fixtureCase(id)` remain server-only
fixture interfaces; search,date-price,normalization and referral use that same
versioned evidence pipeline.

Local geographic assets and their primary-source licenses are recorded in
[assets/provenance.json](assets/provenance.json). Schedules, providers, hotels,
station/terminal points and destination display extents are fictional or
illustrative. For coverage, source extracts and checks see
[the current research and implementation evidence](docs/evidence/adjustments/realistic-travel-catalog/fixture-research.md),
[the rich-coverage checkpoint](docs/evidence/adjustments/rich-inventory-coverage/checkpoint.md),
and [the original T05 evidence](docs/evidence/T05/README.md).

### Optional city location map

Hotel location selection uses the official [OpenStreetMap vector service](https://vector.openstreetmap.org/) with the pinned open-source MapLibre GL JS6.16.0 renderer. No account, API key, billing or environment variable is required. The existing `pnpm docker:up` command works unchanged. Opening the optional picker downloads its SDK/CSS/worker and public map style/tiles; initial ticket comparison does not request them. Offline, failed tiles or unavailable WebGL show a clear message while the local landmark list and coordinates remain usable. Hotel inventory and prices remain fictional. Distances are straight-line, with no routing service.

Map attribution to OpenStreetMap contributors remains visible. Official VersaTiles Colorful/Shadow styles provide light/dark appearances with local place names. MapLibre is BSD-3-Clause ([bundled license](assets/licenses/maplibre-gl-6.16.0.txt)); OSM data and CC0 styles retain their [license notice](assets/licenses/osm-vector-notice.md). The app uses browser-default caching and Referer, with no tile proxy, offline download, prefetch or cache-bypass headers. The community service has [usage requirements](https://operations.osmfoundation.org/policies/vector/) and no SLA. App-owned theme colors remain semantic; vendor map styles are third-party assets.
