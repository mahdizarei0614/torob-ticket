import { describe, expect, it } from 'vitest';
import type { GeoPoint } from '@torob-ticket/contracts';
import type { SceneMarker } from './scene-surface';
import { buildSceneDotData } from './scene-dot-data';

const context = { centralLongitude: 10 };
const majorCities = [{ longitude: 51, latitude: 35 }];
const markers: SceneMarker[] = [
  { id: 'origin', name: 'Origin', point: { longitude: 52, latitude: 36 }, kind: 'city', role: 'origin' },
  { id: 'stop', name: 'Stop', point: { longitude: 53, latitude: 37 }, kind: 'place' },
  { id: 'disabled', name: 'Disabled', point: { longitude: 54, latitude: 38 }, kind: 'custom', enabled: false },
];

describe('visible scene dot cohorts', () => {
  it('never visits hidden geography anchors while keeping major cities and semantic markers', () => {
    const hidden: GeoPoint = {
      get longitude(): number { throw new Error('Hidden geography must not be projected'); },
      get latitude(): number { throw new Error('Hidden geography must not be projected'); },
    };
    const data = buildSceneDotData({ dots: Array<GeoPoint>(3888).fill(hidden), majorCities, markers, context, hideGeography: true });
    expect(data.position).toEqual([41,35,0,42,36,.3,43,37,.3,44,38,.3]);
    expect(data.geography).toEqual([1,0,0,0]);expect(data.emphasis).toEqual([.8,2,1,0]);
    expect(data.phase).toHaveLength(4);
  });
  it('keeps every visible buffer value unchanged when omitting the hidden base cohort', () => {
    const dots = [{ longitude: 179, latitude: 90 }, { longitude: -179, latitude: -90 }];
    const full = buildSceneDotData({ dots, majorCities, markers, context, hideGeography: false });
    const visible = buildSceneDotData({ dots, majorCities, markers, context, hideGeography: true });
    expect(visible.position).toEqual(full.position.slice(dots.length * 3));
    for (const attribute of ['geography','emphasis','phase'] as const) expect(visible[attribute]).toEqual(full[attribute].slice(dots.length));
    // Ordinary/simple maps retain their geography and the same local projection.
    expect(full.position.slice(0,6)).toEqual([169,90,0,171,-90,0]);
    expect(full.emphasis.slice(0,2)).toEqual([0,0]);
  });
  it('returns an empty batch only when all displayed cohorts are empty', () => {
    expect(buildSceneDotData({ dots: [{ longitude: 51, latitude: 35 }], majorCities: [], markers: [], context, hideGeography: true })).toEqual({ position: [], geography: [], emphasis: [], phase: [] });
    expect(buildSceneDotData({ dots: [], majorCities, markers: [], context, hideGeography: true }).position).toEqual([41,35,0]);
  });
});
