# T04 verification — 2026-10-24

Environment: Node 24.17.0, pnpm 11.9.0, Prisma client/CLI/adapter 7.10.1,
pg 8.23.1. `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false`; `NO_COLOR`
unset. Tests used only an explicitly created tmpfs container named
`torobticket-t04-postgres`, PostgreSQL 17.11 (postgres:17-alpine), listening on
127.0.0.1:55434 with database `torobticket_t04_test`.

- Initial integration RED: session creation 404 vs 201, ownership selector 404 vs
  400, readiness 404 vs 200; existing PostgreSQL parameter/rollback check passed.
- Repository RED: missing SearchRepository/ReferralRepository exports, followed
  by PostgreSQL behavior checks after implementation.
- Edge RED: different initial mapping revisions for identical inputs, expired
  cookie not cleared, and terminal search evidence could be changed. All three
  were corrected and verified.
- Empty database migration: `pnpm db:migrate` applied `0001_initial` successfully.
- `pnpm db:seed` ran twice successfully; a later run also verified the final
  generated-client prerequisite. SQL confirmed exactly one foundation-v1 root.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
  --exit-code`: exit 0, “No difference detected.”
- `pnpm nx run api:test-integration --output-style=static`: 4 files, 17 tests passed,
  no skipped tests. Covers real guard HTTP isolation, cookie/hash separation,
  payload/query ownership rejection, override conflicts, reset and credential
  rotation, 24-hour touch/expiry, clocks, restart, immutable evidence,
  cross-session lookup, transaction rollback and concurrent referral idempotency.
- `pnpm test`: exit 0; generator probe, dependency/root-schema/root-test-setup cache
  probes passed; 12 Nx tasks succeeded (one cached). Integration files are
  explicitly excluded from ordinary API unit discovery.
- `pnpm nx run-many -t lint,typecheck,build --projects=api,data-access,domain
  --output-style=static`: all 12 tasks including prerequisites succeeded.
- `git diff --check`: exit 0.

The disposable container was removed with `docker rm -f torobticket-t04-postgres`;
a filtered container listing returned no rows. Its PostgreSQL data was tmpfs, with
no named volume. The isolated adapter-cache project was removed. No unrelated
container, volume or database was changed. No push or deployment occurred.

Initial package installation encountered unrelated npm metadata timeouts. An
isolated exact adapter+pg install populated the shared pnpm cache; offline workspace
installation then added only adapter-pg, driver-adapter-utils and postgres-array.
The original workspace dependency policy was restored and verified using
`pnpm install --offline --frozen-lockfile`. Final product checks had no failures.

Compiled runtime smoke: launched
`node dist/apps/api/apps/api/src/main.js` with the task database and PORT=55435.
The first newly recreated container was not yet accepting migration connections;
`pg_isready` confirmed readiness before retrying migration/seed successfully. The
already running compiled API returned live=200 and ready=503 while unmigrated,
then live=200 and ready=200 after migration/seed, proving readiness recovery and
actual generated Prisma/alias/module runtime loading. The owned API process was
stopped, and the recreated tmpfs container was removed and confirmed absent.
