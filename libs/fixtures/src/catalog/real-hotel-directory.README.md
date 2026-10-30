# Sourced real hotel geography

Revision `hotel-directory-osm-2026-10-30`, retrieved 2026-10-30: **301 real mapped
hotel properties across all 34 current catalog destinations**, with 3–14 genuine
properties per destination. Counts vary with available verified coverage. The
four largest Iranian destinations have 14 each; Tatvan has five. This directory
contains property identity/location facts, not live room rates or availability.
The application separately authors its deterministic offers and unknown terms.

Each row has a stable `city-osm-type-id` identifier, original OSM identity and
source URL, object version/timestamp, point derivation, source tags and discovery
or corroboration URLs. Primary source objects and a per-city/exclusion report
are retained under
`docs/evidence/adjustments/real-hotel-directory/research/`.

## Geography and admission rules

- Require a named primary OSM object explicitly tagged `tourism=hotel`. A hotel
  building, motel, bus stop or generic building label alone does not qualify.
- Exclude closed/disused/proposed/construction/private properties and known
  stale identities, teacher/staff residences, unverified student/club lodging,
  descriptive labels and airside-only transit hotels.
- Use each hotel node's exact published latitude/longitude. For the 30-city
  research set, a way's point is its footprint bounding-box midpoint, rounded
  to seven decimals; relations use all outer-way vertices. For the four-city
  Iranian fragment, way points are the polygon's signed-area centroid, rounded
  to seven decimals. `coordinateMethod` records the distinction. No point is a
  city-centre offset, hand-placed pin, grid/spider displacement or geocoder guess.
- Preserve the source-supported property name. Prefer genuine Persian-script
  names for Iranian properties and English source names internationally.
  Official operator corroboration updates TOKO to HOTEL MYSTAYS Gotanda Station, Telegraph to QT Singapore and Astral Tower to The Star Grand; it also corrects the Darvishi spelling and expands
  the abbreviated Rydges Sydney Airport name. The current Hyatt Regency
  Suvarnabhumi identity is checked against Hyatt rather than an old Novotel name.
  Display names/addresses trim boundary whitespace to match contract text
  normalization; original `sourceTags` remain unchanged.
- `stars` is an explicit integer OSM star rating from 1–5 or `null`; review
  scores are never converted into stars. `address` contains sourced street/full
  address facts or `null`, with no invented streets, ratings or policies. City-only/house-only records remain unknown; source phone-number/placeholder house tags are omitted from display addresses and retained verbatim in source tags.
- Deduplicate OSM identities and review nearby same-name/nearby-property pairs.
  The distinct Hilton and Hilton Garden Inn at Frankfurt Airport share The
  Squaire complex and are corroborated separately by their official operator.
  Ambiguous close pairs in Yazd and Tatvan are omitted conservatively. Former Union Square Inn now requires an apartment lease, and the former NYC Ramada has a documented shelter conversion; both are excluded from the one-night inventory.
- Cap curated coverage at 14 per city, balancing central hotels with useful
  landside arrival-airport-area properties. Wrong-city search hits and distant
  regional properties are excluded rather than assigned to an unrelated city.

## Source acquisition and reproduction

Mapcarta supplied discovery identities only. Every admitted coordinate and OSM
tag is checked against primary OpenStreetMap objects. Overpass endpoints were
unavailable during this acquisition; the successful alternative used bounded
multi-object reads of explicit IDs and a few small discovery blocks. No runtime
scraping, Nominatim area search, bulk tiles, account data or API keys are used.

From the repository root:

```sh
python3 tools/acquire-real-hotel-directory.py
python3 docs/evidence/adjustments/real-hotel-directory/research/curate-directory.py
```

The acquisition script reads the explicit discovery list plus all 56 selected
IDs in `root-iran.json`; it stores primary responses and reads required footprint
nodes in bounded batches. It uses system curl with normal TLS verification and
brief spacing. Cached request files are keyed by the requested ID set. Add
`--refresh` only for a deliberate source refresh; source versions may then differ
from this frozen snapshot and need a new review/revision. The Iranian fragment's
selected raw objects and polygon vertices are retained separately, so its exact
frozen coordinates can be audited without re-querying a city.

Curation writes `status: draft`. Final activation requires an explicit
`--complete` run, full actual 34-city coverage, unique property/OSM identities,
several hotels per city, valid source geometry and independent review. A newly
refreshed directory must be treated as a new immutable source revision; never
rewrite prior search/quote/referral evidence.

The coverage report, exclusions, official corroboration links and primary
objects provide the verification trail. No scraped room prices, old review
quotes or large unrelated map blocks are part of the application directory.

Data licence: [ODbL and attribution](./real-hotel-directory.LICENSE.md).
