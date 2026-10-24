# TorobTicket

A demo-only Persian travel comparison product. This foundation contains two React/Vite applications, a Nest API, and eight bounded libraries. The current foundation includes PostgreSQL persistence, isolated reviewer sessions, contract/domain primitives, an RTL design system and gallery, early one-command Docker packaging, and the T05 versioned fictional catalog. Provider/search comparison journeys and the full demo remain later tasks.

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

T05 supplies 22 cities, 104 directed mode/scope connections, six fictional providers,
308 fictional hotels and 924 relative room-rate templates. New sessions use
`showcase-v1` / `catalog-v1`; `GET /api/v1/catalog` requires the session cookie.
Legacy foundation sessions retain an explicitly empty catalog until reset.
`generateProviderRecords(FixtureQuery)` and `fixtureCase(id)` are server-only
fixture interfaces; transport search and provider adapters remain future work.

Local geographic assets and their primary-source licenses are recorded in
[assets/provenance.json](assets/provenance.json). Schedules, providers, hotels,
station/terminal points and destination display extents are fictional or
illustrative. For coverage, source extracts and checks see
[the T05 evidence](docs/evidence/T05/README.md).
