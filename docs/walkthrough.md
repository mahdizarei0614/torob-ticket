# TorobTicket walkthrough

Target: **4 minutes 30 seconds**, excluding Docker build/startup and operator
preparation. This script follows one comparison from nearby dates to a checked
handoff and its admin evidence. It is not a video recording.

## Preparation outside the clock

1. Start the packaged app with the [README](../README.md) command. Wait for
   consumer/admin readiness; retain one origin throughout the run.
2. Use a fresh, owned browser context. For the reproducible operator rehearsal,
   create the namespace before opening the traveler app with the fixture below.
   The general [reviewer path](reviewer-guide.md) does not require this fixture.
3. Prepare the `price-change` namespace and confirm **Price change at recheck**
   in admin before presentation. This profile supplies
   ordinary stable comparison inventory and changes its authored target only at
   recheck; it is not a mid-story edit of the current comparison.
4. Prepare the supported route and locate the designated seller/service from the
   actual response. Keep the external placeholder/tab behavior explicit. Use an
   ordinary desktop viewport and no forced reduced-motion override when showing
   map motion; honor the actual device policy rather than forcing bloom.

| Fixed operator input | Value |
| --- | --- |
| Seed | `3434` |
| Anchor instant | `2026-11-02T06:00:00Z` |
| Fixture/catalog | Current seeded `showcase-v3` / `catalog-v3`; record returned source revisions |
| Service profile | `price-change` — **Price change at recheck** |
| Route | Flight, domestic, تهران → مشهد |
| Trip | Round trip, economy, one adult |
| Initial departure / return | `2026-11-05` / `2026-11-09` |
| Applied departure / return | `2026-11-06` / `2026-11-09` |
| Filters / initial ordering | None / cheapest |
| Changed-fare target | **هم‌مسیر**, `demo-provider-04`, authored source service slot 0 |

The [operator](evidence/T34/reviewer-walkthrough.spec.ts) and its
[guarded runner](evidence/T34/run-rehearsal.mjs) record actual quote/version,
visible service, applied dates, map availability and stage timings. Preparation
uses the session API in a new owned browser context; presentation clicks the real
interface and observes real responses without replacing them. These dated
evidence tools require their matching owned runtime; they are not the normal
launch command. The controlled fixture is not a traveler requirement.

## 4:30 script and storyboard

| Clock | Screen and action | Narration and evidence |
| --- | --- | --- |
|0:00–0:20| Open the compact traveler form; establish the round-trip route. | “TorobTicket compares the same journey across sellers. The traveler keeps control of the route; this product refers onward rather than taking payment.” |
|0:20–1:00| Move the nearby-date wheel, hover the linked chart, open the Jalali calendar and apply November 6/9. **اعمال تاریخ‌ها** commits and starts the real comparison. | “The wheel explores nearby options; the calendar jumps ahead. Prices describe this route and selected leg. A round-trip total belongs to a complete provider offer.” |
|1:00–1:40| Inspect the comparison already started by Apply, its selected card and seller icons. Switch cheapest/fastest/fewest stops on this comparison, then select a route. | “Equivalent journeys and equal-price seller choices are grouped. Ranking changes the objective without guessing missing terms. The selected offer supplies the route shown beside it.” |
|1:40–2:25| Inspect route details and both directions. Open arrival hotels, change room capacity and one ordering option, then select a property. | “Outbound and return may differ. Hotels begin on the local arrival date for one night; sourced locations are distinct from authored room availability. Cards and map refer to the same property.” |
|2:25–3:35| Close hotels; select the designated هم‌مسیر service and seller action. Read **شرایط تازه پیشنهاد** and choose **پذیرش نسخه تازه و ادامه**. Observe the loading backdrop and placeholder tab, then return. | “The exact quote is rechecked before leaving. This controlled recheck changes the fare: the new amount and version need explicit consent. The recorded handoff is not proof of a purchase.” |
|3:35–4:15| Open admin **Referrals** in the same session and open the exact confirmed referral. Follow **Original search** to this comparison; inspect `raw` and `normalizations`. | “These are the records that produced the comparison, not decorative metrics. The accepted version and original source remain inspectable after handoff.” |
|4:15–4:30| Return to the same confirmed **Referral trail** and end on its accepted version and lineage. | “The build is reproducible, reviewer state is isolated, and the AI-assisted choices and corrections are documented. Live integrations and remaining verification limits are stated separately.” |

The action order matches the measured operator. The slots are presentation budgets. Intentional
narration/inspection holds may pace a rehearsal to 270 seconds and must be recorded
separately from the interaction/wait remainder, including scheduler overhead.
That remainder is not an app-latency benchmark. Never describe a scripted hold as app
latency or claim a completed live map/provider navigation when it was unavailable.
Do not rush through a changed-price warning to meet the target.

## Operator checks and recovery

- Do not press **جست‌وجوی سفر** again after calendar Apply. Apply already starts
  the search; identical pending submissions are intentionally suppressed. Ranking
  inspects/reorders the same immutable comparison rather than requiring a second search.
- Confirm the targeted quote by its source service and exact version; do not
  assume the first/cheapest card triggers the changed-fare fixture. The target's
  visible carrier and departure time belong in the measured rehearsal receipt.
- Keep admin and traveler in the same browser context and hostname. Other
  contexts are intentionally isolated and will not display this run's history.
- For a later recording, scroll expanded raw/normalization JSON into view before
  narrating its fields. The recorded source screenshot shows the inspection and
  expanded summary; it does not alone display every below-fold payload field.
- If hotel tiles fail, show the honest unavailable state and the local list or
  coordinate reference control. Continue the narrative without inventing pins.
- If a quote expires or a draft changes, run a fresh comparison and record the
  new search/quote. Do not continue a stale selection or fabricate a handoff.
- External placeholder navigation may be attempted and blocked in a controlled
  rehearsal. Local confirmation can be proven separately from external loading.

## Actual rehearsal record

**PASS — automated paced operator rehearsal, 2026-11-02.** The final run executed
one case once in Chrome 156.0.8078.76 with no retries, skips or global errors.
The [measurement receipt](evidence/T34/rehearsal-paced-002/artifacts/reviewer-walkthrough-T34-r-4c10b-handoff-and-source-evidence/walkthrough-measurement.json)
and [run summary](evidence/T34/rehearsal-paced-002/artifacts/run-summary.json)
retain actual inputs, stage timestamps, assertions and screenshots.

| Measured item | Result |
| --- | --- |
| Packaged startup, outside presentation | [PASS](evidence/T34/startup-001.json), 37.741s with existing image/dependency caches; not a cold-download claim |
| Fresh README/browser path | [PASS, one case](evidence/T34/rehearsal-fresh-001/artifacts/run-summary.json), separate from the paced run |
| Presentation clock | **270.006s (4:30.006)** against a 270s target |
| Setup outside that clock | 3.604s |
| Requested intentional narration/inspection holds | 254.532s |
| Interaction/wait remainder, including scheduler overhead | 15.473s; not an app-latency benchmark |
| Packaged current-product snapshot | `87193a70335da7bef0e51c60178b8a5625876009`; exact tree/images are in the receipt |
| Operator SHA256 | `b0ec433ca83d85c2707582599b6470224e09aebcbc6597702745a48be1b3a399` |
| Applied route | November 6–9; THR → MHD 00:00–01:35; MHD → THR 18:00–19:35, all Asia/Tehran |
| Checked seller/service | هم‌مسیر / ایران‌ایر, authored service slot 0 |
| Exact accepted change | 3,502,900 → 4,553,800 toman, quote version 1 → 2; matching local referral/admin record |
| Hotel shown | هتل بین‌المللی گلدن پالاس, 5 stars, capacity 2, 6,200,000 toman/night for November 6–7 |
| Street map | Actually ready in this run; fallback is separately verified in T33 |
| Video / recorded narration | Neither recorded by this rehearsal |

The receipt binds the packaged candidate and operator hash rather than claiming
unrelated working overlays were integrated into canonical source. Its three
search-start requests reflect actual date commitments; sorting reuses the current
comparison, and the script does not press Search redundantly after Apply.
The fixed fixture prices are illustrative authored values, not live offers.

The final presentation includes deliberate holds for narration and inspection.
It validates the real ordered UI path under that pacing, not a human reading
speed, speech recording, performance benchmark or final encoded video's length.
The live map was ready; the authorized external placeholder navigation was
actually attempted and deliberately blocked. Local confirmation and exact admin
lineage passed; no external purchase or provider-page completion is claimed.

Earlier dry/operator attempts and the failed first paced run remain in the
[evidence folder](evidence/T34/). Paced001 failed at a popup navigation-context
race; its partial timing is not a completed walkthrough. The final bounded poll
had to observe an actually null opener, and settled screenshot captures preserve
readable changed-fare consent and chart tooltip states.

Official challenge requirements and recheck evidence are in
[submission and attribution facts](evidence/T34/submission-and-attribution.md).
Actual video capture, final encoding/file size and delivery/submission remain
separate follow-ups; this task does not submit an application.
