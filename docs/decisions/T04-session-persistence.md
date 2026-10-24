# T04 — PostgreSQL and reviewer session foundation

## Ownership and lifecycle

`SessionContext` stays in API. Its `scope` is the data-access-owned `DataScope` and
is constructed only after `SessionGuard` resolves the cookie. Future application
controllers must use this guard and pass its scope to repositories. No client
body/query selects a session. Test-only audit controllers live exclusively in
integration test files; search/referral business endpoints remain later tasks.

The public T02 `SessionInfo` does not expose a session ID. The cookie contains 32
random bytes encoded as base64url; PostgreSQL stores only its SHA-256 hash, separate
from the internal UUID. Cookies use HttpOnly, SameSite=Strict and Path=/api, with
Secure on HTTPS requests. The local HTTP demo works without TLS; a future TLS
proxy must configure trusted proxy handling before relying on `request.secure`.
Successful guarded requests atomically extend the server expiry and browser cookie
by 24 hours. At the expiry boundary the credential is rejected and cleared.

Create without a cookie starts a sandbox. Create with a current cookie resumes;
matching overrides are allowed, conflicting overrides return HTTP 409 with the
existing `INVALID_QUERY` wire code. Reset is the explicit way to change them.
Reset without overrides preserves seed, frozen anchor and scenario, restores the
initial mapping/scenario revisions, deletes the old session with cascading owned
data, and creates a new internal ID and credential in one transaction. Rotation
fences late writes from old asynchronous work. Only that session's registered
AbortControllers are cancelled. Jobs register their controller before work and
release it in `finally`. Optional simulated identity and saved data are deleted by
reset along with searches, overrides and referral evidence.

Domain owns the pure `DemoClock`/`RealClock` interfaces. API supplies
`FrozenDemoClock` and `SystemRealClock`; tests replace the real-clock provider
through Nest dependency injection. There is no production test override route.
Demo time is frozen at creation; timestamps, inactivity and expiry use real time.
Initial mapping revision is the deterministic, session-scoped `mapping-v1`.

A single API process owns work. Startup (or the first successful storage recovery
before readiness) expires inactive sessions, changes abandoned collecting searches
to interrupted, preserves their snapshot fields and appends one terminal event.
Already completed evidence is unchanged. Existing-cookie authentication waits for
the same initial reconciliation barrier after a failed bootstrap, before admitting
resumed or guarded work. Readiness checks storage, successful
required migrations and the foundation seed every time; liveness needs none of
those. A 60-second maintenance timer removes expired sessions and aborts their
controllers. Shutdown aborts registered work and closes the Prisma pool.

## Storage and transaction boundaries

The schema contains the full T04 entity inventory. All mutable entities carry
sessionId and scoped compound identifiers/indexes. Composite foreign keys prevent
cross-session ancestry, quote/intent references and identity ownership.
`FixtureVersion`, `Place`, `Hotel` and `RoomRate` are global versioned immutable
records. The idempotent seed inserts only the `foundation-v1` root and
`foundation-catalog-v1` revision; rich authored inventory belongs to T05.

Database triggers reject fixture changes, updates/deletes of append-only raw,
normalization, mapping, offer, quote, event, intent and audit evidence, and changes
to a terminal search. Session deletion is the sole evidence-deletion boundary.
Collecting search updates cannot replace the original query, source revisions or
predecessor. Custom checks/triggers are kept in the SQL migration; modeled foreign
keys are also represented in the Prisma schema.

Scoped mutation transactions lock the owning session row, serializing reset with
writes and rejecting stale scopes. Search creation captures the current immutable
fixture/mapping revisions. Quote rechecks append a new version and ordered search
event in one transaction. Mapping application compares the base revision, appends
a new revision plus audit, and changes the session's current pointer atomically.
Referral confirmation stores the exact handoff and its idempotency record in the
same row/transaction; identical client input returns that original row, conflicting
input is rejected. Confirmation checks intent expiry and current quote version/
expiry; T11 remains responsible for eligibility and provider recheck semantics.

Repositories expose backend persistence records, never public HTTP response types.
Application business services must translate those records to validated domain DTOs.

## Prisma and build integration

Prisma client/CLI and adapter are pinned to 7.10.1. The adapter's npm metadata
requires pg ^8.16.3; the existing exact pg 8.23.1 satisfies it. Official references:

- https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql
- https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- https://registry.npmjs.org/@prisma/adapter-pg/7.10.1

The generated client uses Prisma's `prisma-client` generator with CommonJS output
to match the existing Nest build. Generated sources are ignored and restored by
Nx's cached `data-access:generate` target before API/data-access compilation and
tests. Root Prisma files, config and integration config participate in shared
cache inputs. The cache test mutates a copied root schema and proves a previously
cached consumer actually reruns. The seed compiles TypeScript then executes the
compiled CommonJS file; no extra runtime transpiler is required.

With DATABASE_URL pointing at the intended local database:

```sh
pnpm db:migrate
pnpm db:seed
pnpm nx run api:test-integration # requires separate TEST_DATABASE_URL ending _test
```

Integration discovery includes both apps/api/src/**/*.integration.spec.ts and the
existing apps/api/test/**/*.integration.spec.ts. Normal unit discovery excludes
integration files. The integration suite fails without TEST_DATABASE_URL; it never
falls back to a user's DATABASE_URL or an in-memory substitute.
