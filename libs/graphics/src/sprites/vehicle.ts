import type { Mode } from '@torob-ticket/contracts';
import { BufferGeometry, Float32BufferAttribute } from 'three';
/** Authored flat pixel masks; no remote image, depth extrusion or booking-state implication. */
export const VEHICLE_PIXELS: Record<Mode, readonly string[]> = {
  flight: ['0001000', '1001001', '1111111', '0011100', '0001000'],
  train: ['1111111', '1010101', '1111111', '0111110', '0100010'],
  bus: ['0111110', '1101011', '1111111', '0111110', '0100010'],
};
export function createVehicleGeometry(mode: Mode) {
  const positions: number[] = [];
  VEHICLE_PIXELS[mode].forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel !== '1') return;
    const left = x - 3.5; const top = 2.5 - y;
    positions.push(left, top, 0, left + 1, top, 0, left, top - 1, 0, left + 1, top, 0, left + 1, top - 1, 0, left, top - 1, 0);
  }));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('routeProgress', new Float32BufferAttribute(new Array(positions.length / 3).fill(0), 1));
  geometry.setAttribute('routeKind', new Float32BufferAttribute(new Array(positions.length / 3).fill(2), 1));
  return geometry;
}

/** A flat signed-distance logo: its rounded silhouette and refraction are entirely shader drawn. */
export function createGlassVehicleGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-1,-1,0, 1,-1,0, -1,1,0, -1,1,0, 1,-1,0, 1,1,0], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0,0, 1,0, 0,1, 0,1, 1,0, 1,1], 2));
  return geometry;
}
