# TorobTicket

A demo-only Persian travel comparison product. This foundation contains two React/Vite applications, a Nest API, and eight bounded libraries. Comparison, providers, persistence, sessions, and the design system are implemented in subsequent tasks.

## Local development

Use Node **24.17.0** (`nvm use`) and pnpm **11.9.0**. The package manager is pinned in `package.json`; an existing Corepack installation can activate that exact version. No global configuration change is required.

```sh
pnpm install --frozen-lockfile
pnpm start
```

Consumer: http://127.0.0.1:4300/ · Admin: http://127.0.0.1:4301/admin/ · API liveness: http://127.0.0.1:4302/api/health/live.

The development frontends proxy `/api` to Nest. The eventual same-origin gateway will host admin at `/admin/` on the consumer origin; until that packaging task, open the separate admin URL above. Liveness confirms the API process responds; it makes no database/readiness claim. Database-backed readiness and one-command Docker startup belong to the persistence and packaging tasks.

## Verification

```sh
pnpm nx run-many -t lint,typecheck,build --projects=web,admin,api
pnpm test
pnpm verify:boundaries
pnpm exec playwright install chromium
pnpm nx e2e e2e
pnpm nx run-many -t lint,typecheck,build
```

`pnpm test` runs every current application unit suite. Vitest's root configuration also defines pure/client, UI, and server-library environments; empty library targets report no tests until their owning task introduces behavior. Empty libraries contain no placeholder tests. Set `PLAYWRIGHT_CHANNEL=chrome` to use an already installed Chrome instead of bundled Chromium. E2E starts and stops its own three local servers; their ports must be available.

Real PostgreSQL integration checks use a **dedicated disposable test database** with no schema requirements:

```sh
TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/TEST_DATABASE pnpm nx run api:test-integration
```

The target fails explicitly if the URL is missing or PostgreSQL is unreachable. It does not substitute an in-memory database or silently skip tests. It verifies a parameterized query and transaction rollback; product schema/session checks are added by the persistence task.

For changed projects, use `pnpm nx affected -t lint,typecheck,test,build --base=main --head=HEAD`, with the appropriate existing base ref. CI chooses the PR base or preceding commit and falls back to all projects on the first commit. `pnpm verify` runs all currently defined targets; a dedicated full release pipeline belongs to packaging.

## Libraries and boundaries

The public aliases are `@torob-ticket/{contracts,domain,fixtures,provider-adapters,data-access,client,ui,graphics}`. Each has lint/typecheck/declaration-build/test targets. Exact tags and allowed dependencies are documented in [decision 0001](docs/decisions/0001-foundation.md).

Create a tagged library with the reusable local scaffold:

```sh
pnpm generate:library example-helper domain shared
pnpm generate:library example-repository data server
```

The generator refuses existing names and invalid scope/type combinations. Add its first behavior test alongside the implementation. The aligned installed `@nx/js` generator is also available (`pnpm nx g @nx/js:library --help`) for larger standard scaffolds; use the documented tags and verify boundaries afterward.

See the approved specification in `docs/superpowers/specs`, task verification in `docs/evidence/T01`, and architecture decisions in `docs/decisions`.
