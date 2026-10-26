# 0035 — Compact ticket results and default selection

Owner request, 2026-10-27. This is the task brief for the nine result-list refinements. It supersedes the explicit-selection-only route default in decisions 0032 and 0034; the map remains display-only and provider handoff remains an explicit action.

| Owner item | Implementation decision |
|---|---|
| 1. Much more compact cards | Share rows for operator, date, price, times, route, provider and actions. Preserve readable type and native targets. Keep complete round-trip legs and overnight date changes visible; put full fare evidence and all provider choices in one expansion. |
| 2. Remove update banner | Remove the large routine update panel and its counts/explanation. Preserve a compact toolbar refresh action when newer evidence is staged, so a frozen comparison remains recoverable. |
| 3. Seller count beside heading | Show unique successful providers from this search's actual latest coverage beside the mode heading, e.g. `مقایسه پروازها (۴ فروشنده)`. Remove normal response-coverage paragraphs; retain actionable failure/recovery states. |
| 4. Remove edit button | Remove the normal results-header edit button; the search controls remain above the list. Recovery controls may still direct users to a relevant input. |
| 5. Whole-card selection and provider link | A native keyboard-operable card selection surface selects the exact displayed quote. Independent route tooltips, disclosures and provider controls must not activate the parent. Only the selected card exposes `رفتن به <فروشنده>` with an external-link icon, through the existing recheck/referral flow. |
| 6. Remove collection sentence | Remove repeated per-card provisional-collection prose. Server factual explanations and truthful unavailable/expired states remain. |
| 7. Remove conditions label | Remove the separate `شرایط و هزینه‌ها` disclosure. Preserve cancellation penalties, material terms, unknown conditions and breakdowns inside the main expanded offer evidence and referral recheck views. |
| 8. Suggestions at top | Move the existing `سفرهای پیشنهادی` action from the footer to the intro in place of `مسیر خودت را پیدا کن`; retain its functioning route chooser. |
| 9. Cheapest default and selected visibility | Once a fresh current search reaches usable terminal results, adopt its final evidence if needed and select the lowest complete eligible unexpired quote once, independent of displayed sort. Pin its itinerary so the map draws automatically. Mark selection with a semantic accent and check. |

Default selection must never replace a manual choice made during collection, start a referral, move focus or scroll to a handoff action. It is disabled for restored checkpoints, historical/stale intent, cancelled/empty results, and sort/filter refinement generations, which retain the existing inspected map route. It must not repeatedly choose after quote expiry or same-generation updates. Fresh search/date/preset generations may choose once. Selection retains exact group/quote/version provenance and uses the existing current-evidence eligibility fence; no local fare composition or reranking is introduced.

All authored colors remain semantic tokens. No server contract, real provider integration, payment or booking behavior changes. M7 stays partial at 29/35, T30 active. Source behavior, native desktop/mobile results, referral safety and an independent review are recorded in `docs/evidence/adjustments/compact-results/`.
