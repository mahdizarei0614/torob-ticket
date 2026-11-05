# Reviewer guide

TorobTicket demonstrates a travel comparison/referral product and the engineering
behind it. Start with the ordinary traveler experience; admin is a business and
engineering view of the same private reviewer workspace. No email, real account, API key or guided tour
is required.

## Launch and open

Run `pnpm docker:up` from the repository root with Docker/Compose running. The
shortcut uses Node 24.17.0/pnpm 11.9.0, without requiring a host dependency install.
Without those host tools, run `docker compose up --build --wait --wait-timeout 120`.
Open <http://localhost:4300/> and <http://localhost:4300/admin/>. Keep the same
hostname and browser context for both: a different browser/private context owns
a separate reviewer namespace. [Run locally](run-locally.md) has custom-port,
network/registry, shutdown and hot-reload details.

First build downloads dependencies/images. It is outside the walkthrough clock.
The T33 clean-data builds used existing caches, so their recorded durations are
not a cold-download promise.

## A useful first review

| Action | Look for |
| --- | --- |
| Open **سفرهای پیشنهادی** and choose a route | Supported flight/train/bus and domestic/international choices; selecting a suggestion fills a form without silently booking anything. |
| Edit origin/destination or trip type | Searchable city controls, a compatible preselected class, and one-way/round-trip intent. The **جستجو بر اساس** control selects the date-exploration leg, not a different trip. |
| Explore the date wheel/chart; open the calendar | Prices belong to the selected route/leg, with consistent relative price colors. The calendar is provisional until **اعمال تاریخ‌ها** commits the dates and starts the comparison. |
| Inspect the comparison started by calendar Apply; use **جست‌وجوی سفر** after other form edits | Staged provider responses become comparable whole-trip quotes. The cheapest eligible current offer is initially selected; selecting another card changes the route. An identical submission while collecting is intentionally suppressed; do not press Search again after Apply. |
| Switch **ارزان‌ترین**, **سریع‌ترین**, **کم‌توقف‌ترین** | These reorder the current comparison; they do not rewrite its immutable source evidence. The objectives differ, while fastest and fewest stops can coincide for a particular route. Ground modes use **کمترین تعویض**. |
| Open **جزئیات سفر** | Ordered legs, local times/zones and stops retain the actual supplied outbound/return data. Airport-code hover/focus reveals the place name. |
| Open the destination hotel entry below the desktop map | One night starts on the selected trip's local arrival date. Capacity and four ordering choices update actual local quotes; map/card selection remains linked. |
| Choose a seller from the selected fare | The exact quote is rechecked. Changed terms require acceptance; unavailable or expired offers do not quietly hand off the original amount. |
| Open **Traffic** in admin | Compare outbound referrals, unique browser visitor sessions, billable/repeat counts and recorded fees by provider. Empty activity stays empty; missing rates stay unpriced. |
| Follow a **View referral** link, then inspect **Searches** | Trace the accepted receipt, exact quote version and original source. Confirmation and the later outbound redirect are separate records. |

The large route map is a display, not an alternative origin/destination form.
It stays fixed on desktop; small screens use the semantic route details instead.
Movement, bloom and transitions depend on measured device/browser capability and
motion preferences. [Graphics evidence](evidence/release/performance.md) records
the actual reference measurements and limits.

## Hotel-map behavior

The hotel modal uses a street map with the arriving airport/station/terminal and
real sourced property positions. Hover or focus a hotel marker to reveal its
name; selecting a card selects the same property. Its four ordering choices are
cheapest, more stars, distance to the arrival facility and distance to a chosen
point. Room capacity is independent of the transport's one-adult comparison.

Street-map styles/tiles/glyphs/sprites are external. If they are unavailable,
continue with the local hotel list and **انتخاب با مختصات** reference control.
The absence of map tiles does not establish a missing hotel or zero price.
Distances are straight-line distances, not a navigation/driving-time service.

## Inspect traffic and referral fees in admin

Admin opens on **Traffic**. Select a Persian billing month and, if useful, provider
and referral type. **Custom dates** narrows dates within that month in Tehran
time. The totals, provider table, daily trend/count disclosure and outbound
record page use those same filters. The table compares outbound operations,
unique browser visitor sessions, billable referrals, excluded repeats and fees.
Current-month checkpoint progress uses all billable types for that provider;
closed months show recorded counts instead of predicting from current pricing.

TorobTicket earns a fee from the provider for a qualifying referral, regardless of purchase. A
fresh workspace’s first actual outbound redirect to a provider qualifies; another
distinct referral from that browser visitor to the same provider within 60 minutes
remains traffic but is excluded from billing. Repeats do not move the last-billable
anchor. Reading a receipt or retrying its identical redirect does not add traffic.
A browser-blocked popup can leave a confirmed receipt without an outbound record;
the visible retry uses that same receipt. A redirect record means the server
issued the redirect, not that the external page loaded.

Use a provider’s **Referral pricing** action to inspect or edit its graduated
checkpoints and optional toman rates. Defaults cover referrals 1–100, 101–1,000
and 1,001 onward, with every rate unset. Only later referrals receive later rates.
The count restarts at Persian month midnight in Tehran, while the ledger and
rolling-hour exclusion persist. Empty rates differ from explicit zero. Saving
changes future billable referrals only: old **Unpriced** / **No rate at referral**
records remain unpriced. Fees are recorded amounts, not invoices or payments
received. No commercial rate or purchase conversion is invented.

Visitor identity is a private, signed, namespace-bound anonymous browser cookie,
separate from the reviewer workspace and local sign-in identity. It is not a
verified-person or cross-device count. Keep the same origin/browser for an
ordinary review; separate reviewer workspaces never share their traffic.

## Inspect the accepted offer and its source

Use the same origin/browser as the traveler app. In **Searches**, open the latest row
matching your route and date. For an exact link, start from the confirmed referral
and follow its **Original search** link under **Search-to-source lineage**. **Search inspection** contains coverage, ranked
groups, quote versions and frozen processing context. Under **Processing evidence**,
use `raw`, `normalizations`, `offers`, `quotes` or `projections` to follow an
individual source record through the pipeline.

In **Referrals**, open a **Confirmed receipt** or follow **View referral** from
Traffic. **Referral trail** shows the original comparison quote, accepted version,
exact payload and **Search-to-source lineage**. This accepted-offer evidence is
created before the provider tab opens. Traffic is recorded separately by
`/api/v1/referrals/:id/outbound`, which redirects only to `https://zarei.xyz`.
Historical confirmations are not backfilled as sent traffic. If external
navigation is blocked, the accepted receipt remains inspectable without a new
outbound record. Neither record proves a booking, page load or purchase.

**Providers** contains observed response history and scoped pause/latency/failure
controls. **Data quality** previews alias corrections before applying a new
mapping revision. Existing records are not rewritten; **Replay with current
settings** creates new evidence linked to its predecessor.

## Optional failure scenarios

Open **Configuration** in admin, then **Service profile** in **Operational
configuration**. These are reviewer operations, not traveler-facing setup.
A profile change invalidates current mutable work; return to the traveler app
and make a fresh search. Existing recorded evidence remains readable.

| Profile | What to inspect |
| --- | --- |
| Normal service | Complete deterministic provider inventory |
| Slow response / Provider timeout | Partial coverage and bounded recovery |
| Price change at recheck | Exact changed quote/terms and explicit new-version consent |
| Sold out at recheck | Unavailable selection and separately checked alternatives |
| Conflicting source data | Rejected/ambiguous records, mapping preview and replay |
| No eligible offers | Actionable empty results without fabricated zero prices |

The changed-price fixture is specific: seller **هم‌مسیر** (`demo-provider-04`),
service slot 0. The rehearsed target was **ایران‌ایر**, THR → MHD on November 6
at 00:00–01:35, returning November 9 at 18:00–19:35 local time. Its controlled
total changed from 3,502,900 to 4,553,800 toman, version 1 to 2. These are authored
fixture values, not live quotes. An arbitrary cheapest card is not guaranteed to
change; the [walkthrough](walkthrough.md) records exact inputs, source identity
and timing.

A new private browser context provides an independent reviewer session. The
admin **Reset session…** action explicitly clears only that session's searches,
referrals, identity and overrides after confirmation. It is not required for
ordinary exploration. `pnpm docker:down` preserves database data; the separately
documented Docker reset deletes the selected project's volume.

## Evidence and boundaries

Provider schedules/prices, hotel availability/rates, local identity and seller
handoff are controlled implementations. Real property geography and carrier
marks do not establish live offers or commercial partnerships. There is no
external OAuth/provider integration, payment, booking issuance or runtime LLM.

[Release evidence](evidence/release/README.md) links actual builds, tests and
browser results. [AI log](ai-development-log.md) describes the assisted process;
[limitations](limitations.md) separates observed proof from unperformed checks.
The [walkthrough](walkthrough.md) is a script/rehearsal artifact; an actual video
recording is a separately requested follow-up.


## Separate provider SSO

Open the canonical platform origin, then admin **Direct Login → Connect separate
site** for a provider. Its standalone website uses the other loopback hostname on
port4310. Choose that provider's offer and continue with TorobTicket, verify the
phone, complete primary-traveler details and approve sharing. The provider shows
the verified claims in a JSON pre block and creates/reuses its own account. The
local development verification code is123456 when the documented gates are enabled.
See [integration instructions](direct-login-integration.md#separate-provider-website-and-traveler-profile).
The separate website is an owned local integration, with self-reported documents
and pending external attribution; no commercial provider or ticket is involved.


## Separate application ports

Main website, admin and provider now use independent Docker containers on4300,
4301 and4310. Admin is `/admin/` on4301; old main-site admin links redirect there.
Keep the same canonical hostname for main/admin to inspect one reviewer workspace.
The provider uses the other loopback hostname. Existing records and volumes are
retained. See [Run locally](run-locally.md) for port overrides and mode switching.
