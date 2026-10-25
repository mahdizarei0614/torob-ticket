import type { GeoPoint } from '@torob-ticket/contracts';
export interface AreaGeometry { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
function inRing(x: number, y: number, ring: readonly number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!; const b = ring[j]!;
    if ((a[1]! > y) !== (b[1]! > y) && x < (b[0]! - a[0]!) * (y - a[1]!) / (b[1]! - a[1]!) + a[0]!) inside = !inside;
  }
  return inside;
}
export function containsPoint(area: AreaGeometry, point: GeoPoint) {
  const polygons = area.type === 'Polygon' ? [area.coordinates as number[][][]] : area.coordinates as number[][][][];
  return polygons.some(polygon => inRing(point.longitude, point.latitude, polygon[0]!) && !polygon.slice(1).some(hole => inRing(point.longitude, point.latitude, hole)));
}
/** Build-time bounded deterministic sampling; full original rings and holes are retained. */
export function sampleGeography(areas: readonly AreaGeometry[], bounds: { west: number; east: number; south: number; north: number }, spacing: number, limit = 16000): GeoPoint[] {
  if (!Number.isFinite(spacing) || spacing <= 0) throw new RangeError('Positive spacing required');
  const candidates = Math.ceil((bounds.east - bounds.west) / spacing) * Math.ceil((bounds.north - bounds.south) / spacing);
  if (candidates > 100000 || candidates < 0) throw new RangeError('Unbounded geography sampling');
  const result: GeoPoint[] = [];
  for (let row = 0; bounds.south + row * spacing < bounds.north; row++) {
    const latitude = Number((bounds.south + row * spacing).toFixed(6));
    for (let col = 0; bounds.west + col * spacing < bounds.east; col++) {
      const point = { latitude, longitude: Number((bounds.west + col * spacing).toFixed(6)) };
      if (areas.some(area => containsPoint(area, point))) result.push(point);
      if (result.length > limit) throw new RangeError('Dot budget exceeded');
    }
  }
  return result;
}
