import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
const data = JSON.parse(await readFile('assets/geography/route-scene-fixtures.json', 'utf8'));
const server = await createServer({ configFile: 'apps/web/vite.config.mts', root: process.cwd(), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const { RouteScene } = await server.ssrLoadModule('/libs/graphics/src/scenes/route-scene.tsx');
  const { GraphicsProvider } = await server.ssrLoadModule('/libs/graphics/src/graphics-provider.tsx');
  const { projectPoint } = await server.ssrLoadModule('/libs/graphics/src/geo/projection.ts');
  const cases = [
    { name: 'default empty', scope: 'domestic', centralLongitude: 0 },
    { name: 'Iran-centered empty', scope: 'domestic', centralLongitude: 54 },
    { name: 'Iran-centered itinerary geography', scope: 'domestic', centralLongitude: 54, itinerary: data.scenarios[0].itinerary, fitMode: 'geography' },
    { name: 'Iran-centered illustrative geography', scope: 'domestic', centralLongitude: 54, fitMode: 'geography', illustrative: { points: data.places.slice(0, 2).map(place => place.point), mode: 'flight', label: 'Illustrative endpoints' } },
    { name: 'Iran across projected seam', scope: 'domestic', centralLongitude: -126 },
    { name: 'world centered elsewhere', scope: 'international', centralLongitude: 54 },
    { name: 'world alternate seam', scope: 'international', centralLongitude: -126 },
  ];
  for (const sample of cases) {
    const { name, centralLongitude, ...props } = sample;
    const projection = { centralLongitude }; const dots = props.scope === 'domestic' ? data.dots.iran : data.dots.world;
    const html = renderToString(createElement(GraphicsProvider, {}, createElement(RouteScene, { ...props, places: data.places, dots, paths: data.paths, projection, fitKey: 'overview' })));
    const camera = JSON.parse(html.match(/data-camera="([^"]+)"/)[1].replaceAll('&quot;', '"'));
    const visible = dots.filter(point => { const p = projectPoint(point, projection); return Math.abs(p[0] - camera.x) <= camera.width / 2 && Math.abs(p[1] - camera.y) <= camera.height / 2; }).length;
    console.log(JSON.stringify({ name, centralLongitude, camera, visible, total: dots.length }));
    assert.equal(visible, dots.length, `${name}: actual public scene must frame all bundled geography in its caller projection`);
  }
  console.log('PASS: actual public RouteScene/GraphicsProvider frame every bundled dot across nondefault geography, empty/illustrative, seam and world contexts.');
} finally { await server.close(); }
