import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
// Build-side only: Vite resolves existing TS aliases; no listen(), services or runtime fixture import.
const server = await createServer({ configFile: 'apps/web/vite.config.mts', root: process.cwd(), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const { places } = await server.ssrLoadModule('/libs/fixtures/src/catalog/places.ts');
  const { connections, heroSearches } = await server.ssrLoadModule('/libs/fixtures/src/catalog/connections.ts');
  const { journey, appendAirportTransfer } = await server.ssrLoadModule('/libs/fixtures/src/schedules.ts');
  const { sampleGeography } = await server.ssrLoadModule('/libs/graphics/src/geo/geography.ts');
  const { authorWindingPath, buildRouteGeometry } = await server.ssrLoadModule('/libs/graphics/src/geo/route-geometry.ts');
  const inputs = ['assets/geography/world.geojson', 'assets/geography/iran.geojson', 'assets/geography/destination-landmarks.geojson', 'assets/provenance.json', 'libs/fixtures/src/catalog/places.ts', 'libs/fixtures/src/catalog/connections.ts', 'libs/fixtures/src/schedules.ts', 'libs/fixtures/src/generator.ts', 'libs/fixtures/src/calendar.ts', 'libs/contracts/src/offer.ts', 'libs/contracts/src/common.ts', 'libs/graphics/src/geo/projection.ts', 'libs/graphics/src/geo/geography.ts', 'libs/graphics/src/geo/route-geometry.ts', 'tools/generate-route-scene-fixtures.mjs'];
  const hashes = Object.fromEntries(await Promise.all(inputs.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
  const geo = async name => JSON.parse(await readFile(`assets/geography/${name}.geojson`, 'utf8'));
  const world = await geo('world'); const iran = await geo('iran'); const destination = await geo('destination-landmarks');
  const revision = 'route-scenes-v1';
  const dots = {
    world: sampleGeography(world.features.map(feature => feature.geometry), { west: -179, east: 180, south: -59, north: 85 }, 2),
    iran: sampleGeography(iran.features.map(feature => feature.geometry), { west: 44, east: 64, south: 25, north: 40 }, .22),
  };
  const scenarios = heroSearches.map((search, index) => {
    const connection = connections.find(connection => connection.originCityId === 'tehran' && connection.destinationCityId === search.destinationCityId && connection.mode === search.mode);
    const outbound = journey(connection, '2026-10-25', 1);
    const reverse = connections.find(candidate => candidate.originCityId === search.destinationCityId && candidate.destinationCityId === 'tehran' && candidate.mode === search.mode);
    return { id: `hero-${index}`, name: `${search.mode} / ${search.scope}`, scope: search.scope, itinerary: { itineraryId: `lab-hero-${index}`, mode: search.mode, originPlaceId: outbound.segments[0].originPlaceId, destinationPlaceId: outbound.segments.at(-1).destinationPlaceId, outbound, return: journey(reverse, '2026-10-29', 1, true) } };
  });
  const connection = connections.find(connection => connection.mode === 'flight' && connection.destinationCityId === 'tehran' && connection.scope === 'domestic' && connection.originCityId === 'mashhad');
  const leg = journey(connection, '2026-10-25', 0); appendAirportTransfer(leg, 'thr', 'ika');
  scenarios.push({ id: 'airport-transfer', name: 'پرواز + انتقال زمینی THR → IKA', scope: 'domestic', itinerary: { itineraryId: 'lab-transfer', mode: 'flight', originPlaceId: leg.segments[0].originPlaceId, destinationPlaceId: 'ika', outbound: leg } });
  // Cover the full supported network, not just the seven visible lab examples.
  const networkLegs = connections.flatMap(connection => [0, 1, 2].map(variant => journey(connection, '2026-10-25', variant)));
  const airportChange = journey(connections.find(connection => connection.mode === 'flight' && connection.destinationCityId === 'istanbul'), '2026-10-25', 0);
  appendAirportTransfer(airportChange, 'ist', 'saw'); networkLegs.push(airportChange);
  const allLegs = [...networkLegs, ...scenarios.flatMap(scenario => [scenario.itinerary.outbound, scenario.itinerary.return].filter(Boolean))];
  const pairs = new Map();
  for (const leg of allLegs) for (const segment of leg.segments.filter(segment => segment.mode === 'bus')) {
    const a = places.find(place => place.id === segment.originPlaceId); const b = places.find(place => place.id === segment.destinationPlaceId);
    pairs.set(`${a.id}:${b.id}`, { originPlaceId: a.id, destinationPlaceId: b.id, points: authorWindingPath(a.point, b.point), provenance: { source: 'T14 authored fictional winding waypoints; canonical transport endpoint anchors', revision, illustrative: true, navigation: false } });
  }
  const coverage = { supportedConnections: connections.length, canonicalJourneysChecked: allLegs.length, busSegmentPairs: pairs.size, includes: ['both ordered directions', 'all three schedule variants', 'viaTabriz legs', 'canonical airport-change IST to SAW', 'lab THR to IKA'] };
  for (const [index, outbound] of allLegs.entries()) {
    const itinerary = { itineraryId: `coverage-${index}`, mode: outbound.segments[0].mode, originPlaceId: outbound.segments[0].originPlaceId, destinationPlaceId: outbound.segments.at(-1).destinationPlaceId, outbound };
    const geometry = buildRouteGeometry(itinerary, places, [...pairs.values()]);
    for (const segment of geometry.filter(segment => segment.mode === 'bus')) assert.equal(segment.geometryStatus, 'illustrative', `Missing actual ordered bus pair ${segment.originPlaceId} to ${segment.destinationPlaceId}`);
  }
  const publicTarget = 'assets/geography/route-geometry.json';
  const geographyTarget = 'assets/geography/consumer-geography.json';
  const geographySerialized = JSON.stringify({ revision, navigation:false, description:'Build-time bounded Natural Earth public-domain dots only; no timetable or inventory.', hashes, dots })+'\n';
  const publicSerialized = JSON.stringify({ revision, navigation: false, illustrative: true, hashes, coverage, paths: [...pairs.values()] }) + '\n';
  const result = { revision, coverage, navigation: false, description: 'Source-derived canonical showcase schedules at a fixed lab date, never live or priced search results. Natural Earth public-domain dotted land. Fictional destination extents/hotels; see assets/provenance.json.', hashes, dots, places, scenarios, paths: [...pairs.values()], destination };
  const serialized = JSON.stringify(result) + '\n'; const target = 'assets/geography/route-scene-fixtures.json';
  const testTarget = 'libs/graphics/src/geo/route-geometry.fixture.json';
  const testSerialized = JSON.stringify({ revision, hashes, coverage, places, scenarios, paths: [...pairs.values()], dotCounts: { world: dots.world.length, iran: dots.iran.length } }) + '\n';
  if (process.argv.includes('--check')) { if (await readFile(target, 'utf8') !== serialized || await readFile(testTarget, 'utf8') !== testSerialized || await readFile(publicTarget, 'utf8') !== publicSerialized || await readFile(geographyTarget, 'utf8') !== geographySerialized) throw new Error('Route scene fixture regeneration differs'); console.log(`PASS deterministic source hashes, dots, schedules and authored paths; coverage ${coverage.canonicalJourneysChecked} canonical journeys / ${coverage.busSegmentPairs} ordered bus pairs`); }
  else { await writeFile(target, serialized); await writeFile(testTarget, testSerialized); await writeFile(publicTarget, publicSerialized); await writeFile(geographyTarget, geographySerialized); console.log(`Wrote ${target}: ${dots.world.length} world dots, ${dots.iran.length} Iran dots, ${scenarios.length} canonical scenarios, ${pairs.size} winding paths`); }
} finally { await server.close(); }
