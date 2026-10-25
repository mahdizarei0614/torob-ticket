import { GeoPointSchema, type GeoPoint } from '@torob-ticket/contracts';
/** Mean-Earth spherical great-circle kilometers; never road distance or travel time. */
export function straightLineKm(a: GeoPoint, b: GeoPoint) {
    GeoPointSchema.parse(a);
    GeoPointSchema.parse(b);
    const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
    return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
