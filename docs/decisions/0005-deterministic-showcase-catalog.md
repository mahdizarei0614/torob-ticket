# T05 — Immutable showcase catalog and authored source evidence

New reviewer sessions use `showcase-v1` / `catalog-v1`. Historical `foundation-v1`
rows and sessions remain unchanged. Its catalog response is explicitly empty;
reset is the deliberate upgrade boundary. Unsupported version pairs fail rather
than silently returning current inventory. API imports fixtures and data access
and passes a data-access-owned `FixtureIdentity`; data access never imports fixtures.

One directed connection graph drives catalog endpoints and provider generation.
All 22 cities are covered by transport and 14 fictional hotels each. Six fictional
providers retain the approved mode capabilities. Shared service IDs across
provider dialects permit later grouping; source money units, aliases, null baggage
and mandatory fees remain raw evidence. Generation is synchronous and pure;
scenario latency settings never affect quote values. Filtering, normalization,
ranking, timers and referral state transitions belong to later tasks.

Hotel base records store relative 120-night templates. `materializeRoomRates`
uses the session anchor in the destination's IANA zone, preserving local dates
without putting wall-clock-dependent dates in immutable seed rows. The checkout
boundary is day 120; no early access or actual hotel policy is promised.

Natural Earth country/city geometry, OurAirports airport identifiers and IANA
zones are public-domain primary-source inputs. Selected raw rows, source hashes,
retrieval date, license URLs and transformations are retained in T05 evidence and
`assets/provenance.json`. Rail/bus points and hotel markers are fictional. Local
city extent polygons are display bounds, not legal/municipal boundaries. The
single pole-crossing Antarctic edge is retained; nonpolar rings do not cross the
antimeridian. Routes are illustrative and never navigation directions.

Review Focus cases package data and event/environment inputs for the named
owners. T05 does not claim runtime race, GPU recovery, referral isolation or UI
behavior. Current tests cover the fixture properties and existing session scope.

Seed insertion is transactional and insert-only. Both the regular seed command
and Docker initializer compilation rewrite workspace aliases. Fixture tests
include local assets in their cache inputs so changed geometry cannot reuse stale
passing results.

`tools/project.json` gives the seed composition an explicit Nx owner tagged
`scope:server` / `type:app`, with a normal lint target. This is development tooling,
not a fourth shipping application or service. Production build/start lists remain
web/admin/api, existing boundary constraints remain unchanged, and tool regression
tests still run once through the root test command.
