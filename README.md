# TorobTicket

Compare flight, train and bus journeys, inspect the route, find a hotel near the
arrival terminal, and continue with a seller. The Persian/RTL traveler app pairs
a compact comparison list with a WebGL map; the English admin shows the source,
normalization, ranking and referral evidence behind each result.

## Start the complete app

With Docker Engine/Desktop and Compose running, from the repository root:

```sh
pnpm docker:up
```

**Traveler:** <http://localhost:4300/> · **Admin:** <http://localhost:4300/admin/>

The command builds and serves both frontends, the API and PostgreSQL, applies
migrations/seeds and waits for readiness. No host `node_modules`, `.env` copy,
manual database setup or API key is required. The shortcut uses pinned Node
24.17.0 and pnpm 11.9.0. Without host Node/pnpm, use this single Docker command:

```sh
docker compose up --build --wait --wait-timeout 120
```

First build needs internet for images and dependencies. Comparison assets and
inventory are local; the optional hotel street map requests public OpenStreetMap
content and retains local hotel/coordinate controls if that service is unavailable.
Ports, registry mirrors, architecture support and startup diagnostics are in
[Run locally](docs/run-locally.md).

## Try the reviewer path

1. Open the traveler app and choose **سفرهای پیشنهادی** for a supported route.
2. Compare nearby dates with the wheel/chart; use the calendar to jump ahead.
   **اعمال تاریخ‌ها** commits the dates and starts the comparison.
3. Inspect the resulting comparison, switch cheapest/fastest/fewest stops, and
   select a compact ticket card. If you edited the form without committing a
   date, use **جست‌وجوی سفر** to start it.
4. Inspect its supplied route and stops. Open destination hotels, compare room
   capacity and ordering, and select the same hotel in the list/map.
5. Continue through a seller action; an exact recheck precedes the handoff.
6. Open admin in the same browser and inspect **Searches** and **Referrals**.

[Reviewer guide](docs/reviewer-guide.md) gives the exact labels and optional
scenario controls. [Walkthrough](docs/walkthrough.md) contains the 4:30 script,
reproducible preparation and passed **4:30.006 paced operator rehearsal**. Startup
is separate from the presentation; no video was recorded by that rehearsal.

## What is implemented

- Equivalent-journey grouping and same-price seller choices, complete
  provider-owned round trips, eligibility and factual ranking explanations.
- Linked Jalali dates and prices, route-aware WebGL/GLSL motion, distinct supplied
  outbound/return paths, responsive semantic controls and reduced-motion fallback.
- Arrival-based one-night hotel discovery, real sourced property locations,
  authored room prices, two-way map/card selection and coordinate fallback.
- Exact-version recheck/consent, idempotent confirmed referrals and immutable
  admin evidence, isolated per reviewer session.

This is an independent local demonstration inspired by Torob. Provider inventory,
room prices/availability and authentication are controlled implementations. The
current seller handoff opens `https://zarei.xyz` as an authorized placeholder;
a recorded referral is not a purchase. There is no real provider/OAuth integration,
payment, ticket issuance or runtime LLM. See [limitations](docs/limitations.md)
and [AI development evidence](docs/ai-development-log.md).

## Verify and explore the implementation

T33's selected quality run passed 48 uncached source tasks, 60 tool contracts and
7 single-attempt Chrome journeys. T34 adds a fresh README/browser check and the
paced reviewer rehearsal. The original stack/inventory were preserved.
These are scoped local results, not universal browser/device or live-service
certification: [release evidence](docs/evidence/release/README.md).

For maintainer checks, install the pinned host dependencies and use a new report
folder for each invocation:

```sh
pnpm install --frozen-lockfile
pnpm verify:release --base-url http://localhost:4300 --report-dir docs/evidence/release/local-quality-001 --profile quality --browser-channel chrome
```

Omit `--profile quality` for the shorter health/assets/critical-browser profile.
Omit `--browser-channel` to use installed Playwright Chromium. Verification does
not provision/reset Docker or an existing reviewer session. PostgreSQL integration
is a separate explicit `--postgres` gate with a validated existing test database;
see [verification details](docs/run-locally.md#bounded-release-verification).

| Read next | Purpose |
| --- | --- |
| [Architecture](docs/architecture.md) | Nx boundaries, processing pipeline and rendering choices |
| [Decisions](docs/decisions/README.md) | Product tradeoffs and implementation rulings |
| [AI log](docs/ai-development-log.md) | Actual assistance, human corrections and verification |
| [Reviewer guide](docs/reviewer-guide.md) | An immediately usable product review path |
| [Master tracker](docs/superpowers/plans/2026-10-24-torobticket-master-plan.md) | Task status, commits and evidence |

## Development reference

`pnpm docker:dev` enables frontend Fast Refresh and successful-build API restart
inside Docker, using the same URLs and selected project's database. Saved source
edits update the app without rebuilding everything. `pnpm docker:up` returns to
packaged mode; `pnpm docker:down` preserves data. [Development details](docs/run-locally.md#docker-development-with-hot-reload)
cover dependency/schema changes, polling fallback and explicit destructive reset.

For direct host development use the pinned tools, `pnpm install --frozen-lockfile`
and `pnpm start`; database setup and the three development ports are documented
in [Run locally](docs/run-locally.md). `pnpm test` runs the common tool checks and
Nx unit suites; `pnpm verify` runs lint/type/unit/build. The strict release runner
checks installed dependency state explicitly. Real database tests require an
owned disposable database ending in `_test`; they never fall back to `DATABASE_URL`.

The eight public library aliases are
`@torob-ticket/{contracts,domain,fixtures,provider-adapters,data-access,client,ui,graphics}`.
[Foundation boundaries](docs/decisions/0001-foundation.md) explain tags and imports.
`pnpm verify:boundaries` checks those rules; `pnpm generate:library example-helper domain shared`
creates a tagged library and rejects duplicate names or invalid scope/type pairs.
See [architecture](docs/architecture.md) for the component and data flows.
