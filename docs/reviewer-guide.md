# Reviewer guide

TorobTicket demonstrates a travel comparison/referral product and the engineering
behind it. Start with the ordinary traveler experience; admin is an optional
second view of the same session. No email, real account, API key or guided tour
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
| Open **Searches** / **Referrals** in admin | Inspect real recorded source, normalized offers, exact quote versions and confirmed-handoff lineage. No revenue or purchase conversion is invented. |

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

## Inspect the same session in admin

Use the same origin/browser as the traveler app. In **Searches**, open the latest row
matching your route and date. For an exact link, start from the confirmed referral
and follow its **Original search** link under **Search-to-source lineage**. **Search inspection** contains coverage, ranked
groups, quote versions and frozen processing context. Under **Processing evidence**,
use `raw`, `normalizations`, `offers`, `quotes` or `projections` to follow an
individual source record through the pipeline.

In **Referrals**, open the recorded handoff. **Referral trail** shows the original
comparison quote, accepted version, exact payload and **Search-to-source lineage**.
**Confirmed handoff** means the local referral was recorded; it does not mean a
booking or purchase succeeded. The external placeholder is `https://zarei.xyz`.
If external navigation is blocked, the recorded local evidence remains inspectable.

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
