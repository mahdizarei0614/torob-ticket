# Real hotel directory — final data-author report

Frozen revision `hotel-directory-osm-2026-10-30`: **301 hotels, all 34 current destinations**, 3–14 real mapped properties per city. Directory status is `complete`; geography-only data is separate from authored rate/room fixtures.

Directory SHA256: `6d67dfa88633e9c4882783b6a28d99c5d2c4cb0c15ad06836d9f3cb1b9e93bd0`.

Verification: all 301 rows match retained primary OSM identities, tourism=hotel tags, versions/timestamps and exact documented point derivation. Coordinate methods: 152 exact POI nodes, 23 signed-area polygon centroids, 124 way footprint bounding-box midpoints and two relation outer-footprint bounding-box midpoints. Source coordinate checks pass with zero errors. Stable translated shoelace arithmetic avoids cancellation in small geographic polygons.

Unknown facts remain unknown: 245 null stars and 137 null addresses. No star ratings are inferred from reviews, no invented street addresses, no location offsets. Duplicate OSM/hotel IDs and same-name nearby duplicate-property checks pass.

Curation excluded 49 candidate identities with recorded reasons and five over-cap candidates. Exclusions include nonhotel/motel/stop objects, wrong-city regional hits, private/restricted or unconfirmed lodgings, generic descriptions, airside-only transit properties, a duplicate Hezar property, stale Golden Tulip Seeb, and unresolved close pairs in Yazd/Tatvan. Distinct adjacent Frankfurt Hilton/Hilton Garden Inn properties are corroborated by official operator pages.

Primary OSM explicit-object queries and a few bounded discovery blocks supplied geometry/tags; Mapcarta supplied discovery identities. Representative official corroboration covers Darvishi, Rexan, YOTEL landside, Royal Park Haneda, Rydges Sydney Airport, current Hyatt Regency Suvarnabhumi and both Frankfurt Hilton properties. All source/corroboration URLs are retained. No large unrelated map blocks or duplicate download caches are retained; selected primary objects/geometry remain auditable.

## Coverage

| Destination | Hotels |
| --- | ---: |
| tehran | 14 |
| mashhad | 14 |
| isfahan | 14 |
| shiraz | 14 |
| tabriz | 5 |
| rasht | 7 |
| yazd | 8 |
| ahvaz | 6 |
| bandar-abbas | 6 |
| kerman | 5 |
| hamadan | 7 |
| kermanshah | 3 |
| istanbul | 12 |
| van | 6 |
| yerevan | 11 |
| dubai | 10 |
| tbilisi | 11 |
| baku | 6 |
| ankara | 4 |
| doha | 8 |
| muscat | 8 |
| moscow | 5 |
| london | 14 |
| paris | 9 |
| frankfurt | 10 |
| new-york | 8 |
| los-angeles | 8 |
| toronto | 6 |
| singapore | 11 |
| bangkok | 11 |
| tokyo | 14 |
| sydney | 14 |
| auckland | 7 |
| tatvan | 5 |

## Reproduction and evidence

- `tools/acquire-real-hotel-directory.py` replays explicit discovery IDs plus all 56 root-curated Iranian IDs; no runtime acquisition or API key.
- `curate-directory.py --complete` validates coverage/identity/rules before final activation.
- `verify-coordinates.py` verifies all 303 frozen points/version identities against retained primary sources.
- `coverage-and-exclusions.json`, `official-corroboration.json`, `author-coordinate-validation.json` and `data-author-scope-manifest.json` retain the audit trail.
- Adjacent directory README and ODbL licence document source provenance, transformations and attribution.

No application/backend/map/Docker/Git mutations were made by this research author. Root and source author own integration/native verification.


Parent integration correction after independent review:11 Iranian display
addresses were cleaned, including7 city-only/house-only records now unknown,
a phone number mis-tagged as a house number, one placeholder house number and
one duplicated street number. All303 identities, names, raw source tags and
coordinates remain unchanged. `parent-address-quality-correction.json` records
each before/after value; the final scope manifest was refreshed by the parent.


Final identity audit corrects three historical names from current/official
operator corroboration: TOKO to HOTEL MYSTAYS Gotanda Station, Hotel Telegraph
to QT Singapore, and Astral Tower to The Star Grand Hotel and Residences Sydney.
Their original OSM IDs, points and raw former-name tags stay intact. Exclude
Union Square Inn's current lease-based apartments and the former Ramada's
shelter conversion from ordinary one-night hotel inventory. NYC retains8 real
curated properties; total301 across all34 destinations. See stale-name-audit
and official-corroboration records. This bounded audit does not certify current
operating status or actual nightly availability for every property.
