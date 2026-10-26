import { describe, expect, it } from 'vitest';
import { worldLandPositions } from '../geo/world-context';
import { createScopeMorph, sampleMorphParticle, snapshotLandDots, scopeMorphLandOpacity, SCOPE_MORPH_DURATION_MS, SCOPE_MORPH_PARTICLE_LIMIT } from './scope-morph';

const source = [{ x: -.7, y: -.1, opacity: 1 }, { x: .2, y: .5, opacity: .8 }];
const target = [{ x: .6, y: -.6, opacity: 1 }, { x: -.4, y: .1, opacity: 1 }, { x: .1, y: .6, opacity: .6 }];
describe('deterministic scope dot morph', () => {
  it('moves actual particles with varied scatter, starts exactly at source and gathers exactly at target', () => {
    const a = createScopeMorph(), b = createScopeMorph();
    const particles = a.start(source, target);
    expect(b.start(source, target)).toEqual(particles);
    expect(sampleMorphParticle(particles[0]!, 0)).toEqual(source[0]);
    for (const particle of particles) {
      expect(sampleMorphParticle(particle, 1).x).toBeCloseTo(particle.to.x);
      expect(sampleMorphParticle(particle, 1).y).toBeCloseTo(particle.to.y);
      const halfway = sampleMorphParticle(particle, .5);
      expect(Math.hypot(halfway.x - (particle.from.x + particle.to.x) / 2, halfway.y - (particle.from.y + particle.to.y) / 2)).toBeGreaterThan(.1);
    }
    expect(particles[2]!.from.opacity).toBe(0);
  });
  it('reverses from current positions with no snap and caps resources on repeated interruptions', () => {
    const morph = createScopeMorph(); morph.start(source, target);
    for (let i = 0; i < 12; i++) morph.advance(50, true, false);
    const before = morph.snapshot();
    const reversed = morph.start(before, source);
    reversed.forEach((particle, index) => expect(sampleMorphParticle(particle, 0)).toEqual(before[index]));
    expect(morph.start(Array.from({ length: 9000 }, (_, i) => ({ x: i / 9000, y: 0, opacity: 1 })), target)).toHaveLength(SCOPE_MORPH_PARTICLE_LIMIT);
  });
  it('pauses while covered, caps a hidden-tab delta, and settles immediately for reduced motion', () => {
    const morph = createScopeMorph(); morph.start(source, target);
    morph.advance(5000, false, false); expect(morph.progress()).toBe(0);
    morph.advance(5000, true, false); expect(morph.progress()).toBeCloseTo(50 / SCOPE_MORPH_DURATION_MS);
    const before = morph.snapshot(); morph.advance(50, false, false); expect(morph.snapshot()).toEqual(before);
    morph.advance(0, false, true); expect(morph.active()).toBe(false); expect(morph.progress()).toBe(1);
    expect(scopeMorphLandOpacity(0)).toBe(0); expect(scopeMorphLandOpacity(.76)).toBe(0); expect(scopeMorphLandOpacity(1)).toBe(1);
  });
  it('samples only visible land, respects holes and projection seams, and bounds dense snapshots', () => {
    const context = { centralLongitude: 25 };
    const positions = worldLandPositions([{ geometry: { type: 'Polygon', coordinates: [[[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]], [[10, 10], [10, 30], [30, 30], [30, 10], [10, 10]]] } }], context);
    const frame = { x: -5, y: 20, width: 40, height: 40 };
    const dots = snapshotLandDots({ positions, context, domestic: false, frame, width: 8000 });
    expect(dots.length).toBeGreaterThan(50); expect(dots.length).toBeLessThanOrEqual(SCOPE_MORPH_PARTICLE_LIMIT);
    for (const dot of dots) {
      const x = dot.x * 20 + frame.x + context.centralLongitude, y = dot.y * 20 + frame.y;
      expect(Math.abs(dot.x)).toBeLessThanOrEqual(1); expect(Math.abs(dot.y)).toBeLessThanOrEqual(1);
      expect(x > 10 && x < 30 && y > 10 && y < 30).toBe(false);
    }
    const seam = { centralLongitude: 179 };
    const seamLand = worldLandPositions([{ geometry: { type: 'Polygon', coordinates: [[[-179, 0], [-175, 0], [-175, 10], [-179, 10], [-179, 0]]] } }], seam);
    const points = snapshotLandDots({ positions: seamLand, context: seam, domestic: false, frame: { x: 4, y: 5, width: 8, height: 12 }, width: 600 });
    expect(points.length).toBeGreaterThan(0); expect(points.every(point => Number.isFinite(point.x) && Math.abs(point.x) <= .5)).toBe(true);
  });
});
