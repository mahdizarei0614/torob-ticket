import { describe, expect, it } from 'vitest';
import { worldLandPositions } from '../geo/world-context';
import { createScopeMorph, sampleMorphParticle, snapshotLandDots } from './scope-morph';
import { LIVING_DOT_AMPLITUDE_PX, LIVING_DOT_MAX_OFFSET_PX, sampleLivingDotOffset } from './living-dot-drift';

describe('bounded living geography', () => {
  it('moves slowly with spatial variation while keeping every dot within a small CSS pixel envelope', () => {
    const points = [[51.4, 35.7], [59.6, 36.3], [-73.9, 40.7], [139.7, 35.7], [0, 0]] as const;
    for (const [x, y] of points) for (let time = 0; time < 300; time += .75) {
      const current = sampleLivingDotOffset(x, y, time), next = sampleLivingDotOffset(x, y, time + .25);
      expect(Math.hypot(...current)).toBeLessThanOrEqual(LIVING_DOT_MAX_OFFSET_PX);
      expect(Math.hypot(next[0] - current[0], next[1] - current[1])).toBeLessThan(.08);
    }
    expect(LIVING_DOT_MAX_OFFSET_PX).toBeLessThan(1.2);
    expect(sampleLivingDotOffset(51.4, 35.7, 2)).not.toEqual(sampleLivingDotOffset(59.6, 36.3, 2));
    expect(sampleLivingDotOffset(51.4, 35.7, 2)).not.toEqual(sampleLivingDotOffset(51.4, 35.7, 8));
  });

  it('settles exactly on geographic positions when reduced or covered motion has zero amplitude', () => {
    for (const time of [0, 2, 60, 5000]) expect(sampleLivingDotOffset(51.4, 35.7, time, 0)).toEqual([0, 0]);
    expect(sampleLivingDotOffset(51.4, 35.7, 2, 200)).toEqual(sampleLivingDotOffset(51.4, 35.7, 2, LIVING_DOT_AMPLITUDE_PX));
  });

  it('starts scope morphs at their currently displayed drifting centers and retains a scale-independent pixel bound', () => {
    const context = { centralLongitude: 54 };
    const positions = worldLandPositions([{ geometry: { type: 'Polygon', coordinates: [[[45, 26], [60, 26], [60, 39], [45, 39], [45, 26]]] } }], context);
    for (const width of [480, 1200]) {
      const land = { positions, context, domestic: true, frame: { x: 0, y: 33, width: 20, height: 16 }, width };
      const rigid = snapshotLandDots(land), displayed = snapshotLandDots({ ...land, motion: { seconds: 8, amplitudePx: 1 } });
      expect(displayed).toHaveLength(rigid.length); expect(displayed.length).toBeGreaterThan(100);
      displayed.forEach((point, index) => {
        const original = rigid[index]!;
        const dx = (point.x - original.x) * width / 2;
        const dy = (point.y - original.y) * width / 2 * land.frame.height / land.frame.width;
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(LIVING_DOT_MAX_OFFSET_PX + .000001);
      });
      expect(displayed).not.toEqual(rigid);
      const morph = createScopeMorph(); const particles = morph.start(displayed, rigid);
      particles.forEach((particle, index) => expect(sampleMorphParticle(particle, 0)).toEqual(displayed[index]));
      expect(snapshotLandDots({ ...land, motion: { seconds: 8, amplitudePx: 0 } })).toEqual(rigid);
    }
  });
});
