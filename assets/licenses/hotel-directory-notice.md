# Hotel property geography and authored offers

Current hotel discovery uses the bundled source revision
`hotel-directory-osm-2026-10-30`: 301 OpenStreetMap properties across 34 supported
destination cities. The source is
`libs/fixtures/src/catalog/real-hotel-directory.json`; each record retains its
OSM object URL/ID, version, timestamp, source tags and exact node coordinate or
documented footprint-derived point. The acquisition/review record is in
`docs/evidence/adjustments/real-hotel-directory/` and decision 0064.

Property geography is © OpenStreetMap contributors, licensed under ODbL 1.0:
https://www.openstreetmap.org/copyright and
https://opendatacommons.org/licenses/odbl/1-0/ . Retain source attribution and
license obligations when redistributing this data. Per-property official-site
links corroborate identity where recorded; they do not license copied hotel
artwork or establish an integration.

The original authored Hotel/RoomRate fixture roots and the fictional markers
in `assets/geography/destination-landmarks.geojson` remain frozen for historical
and schematic-map behavior. `assets/provenance.json` describes those legacy
asset transformations; it is not the current real-property directory.

Names and locations being real does not make offers live. Room types, capacity,
nightly prices and availability are deterministic authored inventory with
separate provenance. Unknown stars, addresses, amenities and hotel policies
remain unknown. The app does not contact a hotel inventory/booking service.

The optional street basemap has its separate OpenStreetMap vector-service
notice. Hotel data is bundled; basemap styles, tiles, glyphs and sprites require
external access. The renderer retains the local list and coordinate fallback
when that service is unavailable.
