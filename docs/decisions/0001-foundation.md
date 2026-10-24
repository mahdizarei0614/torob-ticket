# 0001 — Runnable Nx foundation

Date: 2026-10-24 · Status: accepted implementation ruling for T01.

Use the approved Option A: pnpm/Nx, strict TypeScript, React/Vite web and admin, and one modular Nest API. T01 introduces no product schemas, domain rules, Prisma models, session handling, provider integration, graphics implementation, or design-system components.

## Compatibility and exact pins

Primary registry records for **every direct dependency** (including peer ranges and engine requirements) are captured in `docs/evidence/T01/registry-compatibility.json`. All direct dependency versions and the package manager are exact; transitive resolutions are committed in `pnpm-lock.yaml`.

| Tool or package family | Selected version | Compatibility evidence |
| --- | --- | --- |
| Node LTS | 24.17.0 | [Node release table](https://nodejs.org/en/about/previous-releases) identifies Node 24 as LTS; existing local executable verified. Same exact version in `.nvmrc`, `.node-version`, package engine and container recommendation. |
| pnpm | 11.9.0 | [Registry record](https://registry.npmjs.org/pnpm/11.9.0) requires Node ≥22.13. Pin matches local installed package manager. |
| Nx, @nx/devkit, @nx/js, @nx/eslint-plugin | 23.3.1 | [Nx Node support](https://nx.dev/docs/technologies/node/introduction) includes Node 24 for Nx 23; [TypeScript support](https://nx.dev/docs/technologies/typescript/introduction) includes ≥5.8 and <7.1. Aligned packages avoid plugin drift. |
| TypeScript | 5.9.3 | Inside Nx 23 and typescript-eslint 8 supported ranges; stable compiler API, rather than TypeScript 7 which lacks the API required by some tools. |
| React / React DOM | 19.3.1 | Matched exact versions; React DOM peer range requires React ^19.3.1. |
| Three / R3F / Drei | 0.186.1 / 9.8.2 / 10.7.9 | [R3F compatibility](https://r3f.docs.pmnd.rs/getting-started/introduction) pairs R3F 9 with React 19. Registry peers accept React ≥19 <19.4 and Three ≥0.156; Drei 10 accepts R3F 9 and React 19. |
| Nest common/core/platform-express/testing | 11.2.8 | Matched exact release; core Node engine ≥20; Nx Nest 23.3.1 registry peers require Nest ≥10 <12. Nest 12 latest is therefore rejected for this toolchain. Nx Nest generator plugin is not needed for our explicit Nest targets; compatibility is checked for future use. |
| Vite / React plugin | 8.3.5 / 5.2.0 | Node ^20.19 or ≥22.12; React plugin peer explicitly includes Vite 8. |
| Vitest | 5.0.5 | Node ^22.12, ^24, or ≥26; Vite peer includes Vite 8. |
| ESLint / typescript-eslint | 10.13.0 / 8.72.0 | Matching ESLint 10 peer range; [ESLint 9 is EOL](https://eslint.org/version-support/), TypeScript ≥4.8.4 <6.1. |
| Prisma / Prisma Client | 7.10.1 | Stable matched release; [Prisma 7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements) support Node 24 and TypeScript 5.4+. Registry `prisma@latest` pointed to 8.0.0-rc.27; reject the prerelease for foundation. Client is pinned but not generated until schema ownership in T04. |
| Playwright | 1.64.1 | Registry engine Node ≥20. Browser binaries are installed with the matching local Playwright command. |
| jsdom | 26.1.0 | Node ≥18. Current jsdom 30.1.3 failed dependency resolution because it referenced unpublished `undici@^8.12.1` while registry latest was 8.11.2. Use the verified resolvable stable release; initial failure preserved in evidence. |

Other approved runtime building blocks are pinned in package.json, including React Router, TanStack Query, Zod, React Aria, internationalized dates, and Motion. They are installed, without implementing their future product features.

## Container architecture

The exact recommended build/runtime base is `node:24.17.0-bookworm-slim`, manifest digest `sha256:862263c612aa437e3037674b85419622a9d93bff80aa1eee5398dfe686375532`. `docker buildx imagetools inspect` confirmed **linux/amd64** and **linux/arm64/v8** (also ppc64le/s390x); raw manifest evidence is saved in T01 evidence. Debian Bookworm is compatible with Prisma's documented OpenSSL/glibc support on amd64 and arm64. The later Dockerfile must install required runtime OpenSSL libraries explicitly.

PostgreSQL CI uses exact `postgres:17.11-bookworm`. Official [image source](https://raw.githubusercontent.com/docker-library/official-images/master/library/postgres) lists amd64 and arm64v8; its registry manifest is captured in evidence. This foundation does not claim a production Docker stack has been implemented or tested across architectures. Local real-database testing uses the cached official `postgres:17-alpine` **17.11 arm64** image, whose content digest is recorded with verification. It is disposable and has no product schema.

## Project tags and allowed imports

| Project | Scope tag | Type tag | Internal dependencies allowed |
| --- | --- | --- | --- |
| web | scope:web | type:app | shared client/data helpers, UI, graphics, contracts, domain |
| admin | scope:admin | type:app | same browser-safe set |
| api | scope:server | type:app | contracts, domain, data-access/client, fixtures, provider-adapters |
| contracts | scope:shared | type:contracts | none; Zod only at runtime |
| domain | scope:shared | type:domain | contracts; date utilities only externally |
| fixtures | scope:server | type:fixtures | domain, contracts |
| provider-adapters | scope:server | type:provider | domain, contracts, fixtures |
| data-access | scope:server | type:data | domain, contracts |
| client | scope:shared | type:data | shared data/client helpers, domain, contracts |
| ui | scope:shared | type:ui | UI, domain, contracts; never graphics |
| graphics | scope:shared | type:graphics | graphics, UI, domain, contracts |
| e2e | scope:server | type:test | server/shared libraries for integration fixtures; not a shipping application |

Nx ESLint constraints combine scope and type restrictions, reject app imports from shared/server libraries, and reject server/database external packages in browser code. Contracts/domain allow Vitest for their own unit tests; they contain no test runtime in their public production exports. Domain tests retain the same no-fixtures/no-provider/no-persistence rules. Boundary verification creates a real temporary browser import of `@torob-ticket/data-access`, requires an Nx rule error, records the failure, and always removes the probe.

A reusable local library scaffold validates names, refuses overwrites, applies tags, adds the public alias, and supplies lint/typecheck/declaration-build/test targets. The aligned `@nx/js` library generator is also installed. Empty libraries intentionally have no fabricated tests; their standard test targets report no tests until each owning task implements behavior and its tests.

## Health and verification ownership

`GET /api/health/live` reports process liveness in explicit demo mode and does not contact a database. `/api/health/ready` belongs to T04 and must reflect real database/schema/seed readiness. Application APIs will use `/api/v1`; no product APIs are introduced in T01.

Current app units run on Vitest; the root configuration also defines pure/client and UI environments. API integration requires an explicit `TEST_DATABASE_URL` and executes real PostgreSQL queries/transaction rollback. Playwright launches the three local servers and verifies visible consumer/admin entries and the API proxy. CI uses Nx affected lint/typecheck/test/build plus the boundary probe, PostgreSQL target, and Playwright. Future release packaging adds a dedicated full release target and the approved same-origin gateway.

API builds use TypeScript decorator metadata emission followed by `tsc-alias` 1.9.9 to rewrite workspace imports into their compiled relative paths. The output entry is `dist/apps/api/apps/api/src/main.js`; library code is emitted under `dist/apps/api/libs/`. Vite and Vitest resolve the same root alias table. This keeps the first real cross-library API import runnable without shipping TypeScript sources or relying on unresolved runtime aliases.

pnpm 11 reads project settings from `pnpm-workspace.yaml`; save-exact, engine checks, and disabled automatic peer installation are configured there. No global configuration is changed.

Root package scripts are excluded from automatic Nx project target inference (`nx.includedScripts: []`) so root convenience commands cannot recursively invoke themselves during `run-many`. Empty-library test targets use the explicit CLI `--passWithNoTests`; app tests do not. Configs use `.mts` and JSON import attributes for Vite's native-loader compatibility. `verifyDepsBeforeRun: error` makes pnpm report an out-of-sync install rather than unexpectedly mutating dependencies during a test/build command. CI uses pinned official v6 action commit references, recorded in `ci-action-refs.json`, with Node installed before pnpm.
