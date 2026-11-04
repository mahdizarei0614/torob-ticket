# TorobTicket

Compare flight, train and bus journeys, inspect the route, find a hotel near the
arrival terminal, and continue with a seller. The Persian/RTL traveler app pairs
a compact comparison list with a WebGL map. The English admin starts with
provider traffic and referral fees, with source, normalization, ranking and
accepted-offer evidence available behind each result.

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
6. Open admin in the same browser. **Traffic** shows outbound referrals, unique
   visitor sessions, billable/repeat counts and provider fees. Open a referral
   record for **Referrals** evidence, then follow its source into **Searches**.

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
- Exact-version recheck/consent and immutable accepted-offer receipts, followed
  by separately recorded, idempotent outbound redirects.
- Provider traffic, daily trends and graduated referral-fee settings in the
  default admin view, isolated per reviewer workspace.

This is an independent local demonstration inspired by Torob. Provider inventory,
room prices/availability and authentication are controlled implementations. The
current seller handoff uses a tracked same-origin redirect before opening
`https://zarei.xyz` as the authorized placeholder. A redirect record is not proof
of external page load or purchase. There is no real provider/OAuth integration,
payment, ticket issuance or runtime LLM. See [limitations](docs/limitations.md)
and [AI development evidence](docs/ai-development-log.md).

## Referral-based monetization

Providers pay for qualified outbound referrals, regardless of purchase. The
server counts a redirect only when the browser requests the tracked outbound
route; accepting an offer alone does not count as sent traffic. Blocked popups,
receipt reads and retries of the same confirmed receipt add no extra referral.

- A browser visitor can qualify once per provider in a rolling 60-minute window.
  Repeat visits remain visible and do not move the last-billable time forward.
- Per-provider rates are graduated: by default referrals 1–100 use tier 1,
  101–1,000 tier 2 and 1,001 onward tier 3. Checkpoints and rates are editable.
  Counters restart at Persian calendar month boundaries in Tehran time; the
  historical ledger remains intact.
- Rates start unset. Admin separates known fees from referrals that had no rate
  when recorded. An explicit zero rate is valid. Rate changes affect future
  billable referrals; earlier priced and unpriced records never reprice.

Anonymous browser visitor identity is separate from the private reviewer
workspace. It does not establish a verified person or cross-device identity.
Recorded fees are not invoices, collected provider payments or purchase
conversions. [Decision0086](docs/decisions/0086-provider-traffic-and-graduated-referral-fees.md)
records these boundaries.

## Verify and explore the implementation

T35's final selected quality run passed 48 uncached source tasks, 60 tool
contracts, 189 real PostgreSQL cases and seven single-attempt Chrome journeys.
A separate 16-case browser run covers all 12 mode/scope/trip combinations and
four branding cases. The manually operated reviewer journey took 2:16.058;
the final clean-source/fresh-data Docker startup took 38.221 seconds with caches.
The [final review](docs/evidence/release/final-review.md) and
[acceptance checklist](docs/evidence/release/acceptance-checklist.md) record the
source, fixes and remaining limits. Hotel map availability observed in that run
was subsequently [fixed and browser-verified](docs/evidence/adjustments/hotel-map-resilience/checkpoint.md)
using a free provider and recoverable tile handling. The original stack/inventory were preserved.
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

## Direct Login

Open `/admin/direct-login` to enroll a provider, retrieve local verification
messages and inspect acquisition evidence. Connected providers offer Continue
with TorobTicket alongside ordinary navigation. The reference provider includes
its own account/session store and returns to the selected offer after consent.

The standalone Node SDK and its integration guide are in
[libs/provider-sdk](libs/provider-sdk/README.md). See
[Direct Login integration](docs/direct-login-integration.md) for the local
walkthrough, configuration, proof protocol and external verification boundary.
Local verification uses the admin inbox. Actual SMS, Torob federation and external
account verification require their respective connections.


### Separate provider website

The standalone provider runs on a different hostname at port4310. In admin Direct
Login, choose **Connect separate site** for a provider, then **Open provider
website**. Start from a selected TorobTicket offer to obtain its current referral.
The provider performs the backend SDK code exchange and displays the consented
traveler claims in a JSON pre block. See [setup and traveler fields](docs/direct-login-integration.md#separate-provider-website-and-traveler-profile).
