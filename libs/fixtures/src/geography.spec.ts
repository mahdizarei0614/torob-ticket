import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { catalog, hotels } from './index';
type Feature={properties:{id?:string;cityId?:string;countryCode?:string;kind?:string};geometry:{type:string;coordinates:unknown}};
const geo=(name:string)=>JSON.parse(readFileSync(`assets/geography/${name}.geojson`,'utf8')) as {features:Feature[]};
it('bundles world/Iran geometry without nonpolar antimeridian edges',()=>{
  const world=geo('world');expect(world.features.length).toBeGreaterThan(170);expect(geo('iran').features).toHaveLength(1);expect(geo('iran').features[0]!.properties.countryCode).toBe('IR');
  for(const feature of world.features){const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;for(const polygon of polygons as number[][][][])for(const ring of polygon){expect(ring[0]).toEqual(ring.at(-1));for(let i=1;i<ring.length;i++){const a=ring[i-1]!,b=ring[i]!;expect(Math.abs(b[0]!-a[0]!)<=180||Math.abs(a[1]!)===90&&Math.abs(b[1]!)===90).toBe(true);}}}
});
it('local destination extents contain every arrival reference and accommodation marker',()=>{
  const features=geo('destination-landmarks').features;
  for(const city of catalog.cities){const extent=features.find(f=>f.properties.id===`${city.id}-extent`)!;expect(extent).toBeDefined();const points=(extent.geometry.coordinates as number[][][])[0]!;const lons=points.map(p=>p[0]!),lats=points.map(p=>p[1]!);
    for(const p of [...catalog.places.filter(p=>p.cityId===city.id).map(p=>p.point),...hotels.filter(h=>h.destinationCityId===city.id).map(h=>h.point)]){expect(p.longitude).toBeGreaterThanOrEqual(Math.min(...lons));expect(p.longitude).toBeLessThanOrEqual(Math.max(...lons));expect(p.latitude).toBeGreaterThanOrEqual(Math.min(...lats));expect(p.latitude).toBeLessThanOrEqual(Math.max(...lats));}
    expect(features.some(f=>f.properties.cityId===city.id&&f.properties.kind==='landmark')).toBe(true);
    for(const hotel of hotels.filter(h=>h.destinationCityId===city.id)){expect(features.find(f=>f.properties.id===hotel.hotelId)?.geometry.coordinates).toEqual([hotel.point.longitude,hotel.point.latitude]);}
  }
});
