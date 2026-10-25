# 0018 — Consumer canonical trip map

Status: implemented; native evidence and independent review recorded in T18 report/tracker.

T18 replaces the consumer schematic with the shared WebGL2/GLSL RouteScene. The API catalog supplies real City and Place records. The API itinerary supplies all segments, ordering, stops, wait durations, time zones, vehicle and airport changes. No itinerary is taken from the route laboratory. A separate build derivative supplies the existing sampled Iran/world dots and provenance; authored bus/ground paths remain illustrative, non-navigation geometry. Missing geometry stays unavailable.

## Ownership and inspection

Display priority is transient preview, explicit pin, then an explicitly unpriced city illustration. There is no first-result pin. A preview does not fit the camera. Pointer leave/blur restores the pin. Clicking an eligible provider offer pins its exact canonical itinerary and binds that immutable quote; reselecting the same fare is a new explicit intent even if the quote object is unchanged.

Draft edits synchronously invalidate map control leases and clear both controller IDs and map payload/selection. Still-current committed results can subsequently be inspected explicitly while the edited composer stays unchanged. The map labels the committed transport/route and uses its actual icon/timeline; the global palette follows the draft mode. Existing T17 accepted `{generation,searchId}` ownership remains distinct from the old operation ID used for supersession.

Sort/filter can preserve an explicitly labeled previous inspection only across the same transport, scope, endpoints, dates, trip type, party and class. Its fare/referral eligibility is cleared. New route/date/history/reset clears inspection; matching city names do not grant ownership. City/direction/camera callbacks also capture a synchronous draft lease and fit/scene identity, so retained callbacks cannot edit a restored form or overwrite a newer pin's camera snapshot.

## Camera and geography

Projection and deliberate camera intent outlive preview, result scrolling, sorting, themes, responsive hide/show and context restoration. Pinning deliberately fits both canonical directions. Explicit zoom and two-pointer pinch change zoom; ordinary wheel scrolling is not captured for zoom. Endpoint city controls edit the same draft and support exactly the API's current mode/scope connection network. Cities are never fabricated airport/station Places. Selected endpoints are distinct, clustered labels retain true anchors via leader lines, and a complete semantic dropdown remains available.

Below1120px the map scene is unmounted, not merely CSS hidden; the same ordered localized itinerary and direction remain available in the mobile textual panel. One lazy shared graphics host continues to own the chart and map renderer. Static semantic fallback and context recovery preserve controls and itinerary.

## Progress and future T22 contract

Progress is per displayed itinerary:0 endpoint/previous inspection,35 comparison,70 current complete eligible chosen quote,100 matching actual confirmed transport referral. Inspecting another itinerary cannot borrow the pin's70/100. Expiry/removal/version replacement immediately revokes70 without choosing another fare. There is no completion simulator or runtime referral flow in T18.

The typed `bindAcceptedQuote(previous,quote,itinerary)` seam is for T22 only after a server recheck returns ready, or after the user explicitly accepts changed terms/version. It checks exact previous ID/version, a strictly newer immutable version of the same fare/provider/party/itinerary, validity and operation ownership. T22 then supplies the actual server receipt to `confirmReferral`. Confirmation checks schema, exact receipt quote/version/payload/itinerary, accepted operation ownership, eligibility/completeness, and `observedAt <= confirmedAt < expiresAt`, with no future confirmation. A receipt delivered after the expiry UI timer remains genuine historical truth if its confirmation occurred within that exact bound valid quote window. Originally unknown/ineligible/incomplete quotes never complete. Rechecked quotes use their own expiry timer.

Legitimate forward progress on the same displayed route/direction has a finite700ms flat vehicle transition sampled by the existing host frame owner. Semantic status changes immediately. Reduced motion, revocation/reset, route/direction/context changes snap; hidden/covered/unmounted scenes cancel. The sampler owns no RAF and creates no renderer or per-card context. T27 owns later coordinated polish; T32/T33 own full performance/accessibility audits.

## Independent review corrections

R1: the controller's `currentIntent()` is a synchronous snapshot produced by the same authoritative `searchReducer` and action dispatch path as React. Map sends reconcile against that live snapshot before pin/preview/selection. Thus an explicit still-authorized committed-result action in the same event turn as an unapplied draft edit remains coherent with controller IDs. Obsolete accepted-operation callbacks and draft/camera leases retain their existing fences. A consumed selection intent survives display clearing only as a non-actionable identity; passive snapshot delivery cannot resurrect it, while a new explicit same-fare selection object can.

R2: result callbacks publish `(itinerary?, source?: 'hover' | 'focus', leavingId?)`. JourneyCard emits both modalities; ResultsList forwards all metadata under the accepted-pair guard. Map state owns independent hover/focus channels and displays hover, then focused itinerary, then pin/illustration. Leaving-ID checks prevent an old card leave from clearing a newer card's modality. Same-card focus-after-pointer-leave and hover-after-blur remain compatible with simple consumers; cross-card restoration uses the full modality contract.

R3: timeline stops join segment destinations by ordered occurrence, advancing the segment cursor once per canonical stop. Repeated Places remain distinct facts. Unmatched stop facts are retained in canonical stop order with an explicit unknown-placement label. Supplied timestamps retain their exact machine-readable instant; local display uses the matched segment or actual catalog Place time zone, and otherwise says the local time zone is unknown. Unknown times are never inferred.

Known stop arrival/departure instants additionally constrain the occurrence join (instant equality, including equivalent UTC precision representations). A lone known stop at a later repeated Place therefore joins that actual arrival/departure, while conflicting/unreconcilable timestamps remain explicitly unmatched. Unknown timestamps continue to use supplied ordered occurrence semantics. The city network's bounded declutter budget is isolated from the original T14 landmark/accommodation layout, preserving local-picker native pinch space and default lab behavior.
