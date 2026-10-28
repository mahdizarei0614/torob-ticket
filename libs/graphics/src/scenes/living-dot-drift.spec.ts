import { describe, expect, it } from 'vitest';
import { worldLandPositions } from '../geo/world-context';
import { createScopeMorph, sampleMorphParticle, snapshotLandDots } from './scope-morph';
import { LIVING_DOT_AMPLITUDE_PX, LIVING_DOT_MAX_OFFSET_PX, sampleLivingDotOffset, sampleLivingDotOpacity, livingDotAmplitudeForSpacing, sampleLivingDotGlow, LIVING_DOT_GLOW_MIN, LIVING_DOT_GLOW_MAX } from './living-dot-drift';

describe('bounded living geography', () => {
  it('moves slowly with spatial variation while keeping every dot within a small CSS pixel envelope', () => {
    const points = [[51.4, 35.7], [59.6, 36.3], [-73.9, 40.7], [139.7, 35.7], [0, 0]] as const;
    for (const [x, y] of points) for (let time = 0; time < 300; time += .75) {
      const current = sampleLivingDotOffset(x, y, time), next = sampleLivingDotOffset(x, y, time + .25);
      expect(Math.hypot(...current)).toBeLessThanOrEqual(LIVING_DOT_MAX_OFFSET_PX);
      expect(Math.hypot(next[0] - current[0], next[1] - current[1])).toBeLessThan(5.5);
    }
    expect(LIVING_DOT_MAX_OFFSET_PX).toBeLessThanOrEqual(9);
    expect(sampleLivingDotOffset(51.4, 35.7, 2)).not.toEqual(sampleLivingDotOffset(59.6, 36.3, 2));
    expect(sampleLivingDotOffset(51.4, 35.7, 2)).not.toEqual(sampleLivingDotOffset(51.4, 35.7, 8));
  });

  it('starts on the grid, keeps wandering during long idle periods, and has no repeating five-second path', () => {
    expect(sampleLivingDotOffset(51.4, 35.7, 0)).toEqual([0, 0]);
    for (const start of [5, 30, 300, 3600]) {
      const points = Array.from({ length: 121 }, (_, i) => sampleLivingDotOffset(51.4, 35.7, start + i / 20));
      const distance = points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0]-points[i]![0],point[1]-points[i]![1]),0);
      expect(distance).toBeGreaterThan(7);
      points.forEach(point => expect(Math.hypot(...point)).toBeLessThanOrEqual(LIVING_DOT_MAX_OFFSET_PX + .000001));
      expect(points[0]).not.toEqual(sampleLivingDotOffset(51.4,35.7,start+5));
    }
  });

  it('caps only extreme zoom-out excursions so a complete core fits its searched neighborhood', () => {
    expect(livingDotAmplitudeForSpacing(6)).toBe(9);
    for (const spacing of [1,2,3,4]) {
      const amplitude=livingDotAmplitudeForSpacing(spacing);
      expect(amplitude*Math.SQRT1_2+2).toBeLessThanOrEqual(spacing*2.5+.000001);
    }
  });

  it('fades individual particles in and out smoothly with staggered lifetimes', () => {
    for (const [x,y] of [[51.4,35.7],[-73.9,40.7],[139.7,35.7]]) {
      const opacity=Array.from({length:301},(_,i)=>sampleLivingDotOpacity(x!,y!,i/10));
      expect(Math.min(...opacity)).toBe(0); expect(Math.max(...opacity)).toBe(1);
      opacity.slice(1).forEach((value,i)=>expect(Math.abs(value-opacity[i]!)).toBeLessThan(.15));
      for (const time of [0,5,100]) expect(sampleLivingDotOpacity(x!,y!,time,0)).toBe(1);
    }
    const visible=Array.from({length:200},(_,i)=>sampleLivingDotOpacity(44+i*.44,30,10));
    expect(visible.filter(value=>value>.5).length).toBeGreaterThan(100);
    expect(visible.filter(value=>value<.1).length).toBeGreaterThan(10);
  });

  it('keeps seeded random-looking geography glow inside one fixed restrained range with smooth changes',()=>{
    const values:number[]=[];
    for(let i=0;i<120;i++)for(let seconds=0;seconds<90;seconds+=.37){
      const x=44+i*.44,y=25+i*.073,current=sampleLivingDotGlow(x,y,seconds),next=sampleLivingDotGlow(x,y,seconds+.016);
      expect(current).toBeGreaterThanOrEqual(LIVING_DOT_GLOW_MIN);expect(current).toBeLessThanOrEqual(LIVING_DOT_GLOW_MAX);
      expect(Math.abs(next-current)).toBeLessThan(.002);values.push(current);
    }
    expect(LIVING_DOT_GLOW_MIN).toBe(.58);expect(LIVING_DOT_GLOW_MAX).toBe(.8);
    expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(.20);
    expect(sampleLivingDotGlow(51.4,35.7,12)).not.toBe(sampleLivingDotGlow(59.6,36.3,12));
    expect(sampleLivingDotGlow(51.4,35.7,12)).not.toBe(sampleLivingDotGlow(51.4,35.7,17));
  });

  it('travels visibly within two seconds instead of only changing brightness or subpixel positions', () => {
    const distances: number[] = [];
    for (let x = 44; x <= 62; x += .88) for (let y = 26; y <= 38; y += .88) {
      const a = sampleLivingDotOffset(x, y, 0), b = sampleLivingDotOffset(x, y, 2);
      distances.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    distances.sort((a, b) => a - b);
    expect(distances[Math.floor(distances.length / 2)]).toBeGreaterThan(2);
    expect(distances.filter(value => value > 1).length / distances.length).toBeGreaterThan(.8);
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
      const rigid = snapshotLandDots(land), displayed = snapshotLandDots({ ...land, motion: { seconds: 8, amplitudePx: LIVING_DOT_AMPLITUDE_PX } });
      expect(displayed).toHaveLength(rigid.length); expect(displayed.length).toBeGreaterThan(100);
      displayed.forEach((point, index) => {
        const original = rigid[index]!;
        const dx = (point.x - original.x) * width / 2;
        const dy = (point.y - original.y) * width / 2 * land.frame.height / land.frame.width;
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(LIVING_DOT_MAX_OFFSET_PX + .000001);
      });
      expect(displayed).not.toEqual(rigid);
      const morph = createScopeMorph(); const particles = morph.start(displayed, rigid);
      particles.forEach((particle, index) => expect(sampleMorphParticle(particle, 0)).toMatchObject({x:displayed[index]!.x,y:displayed[index]!.y,opacity:displayed[index]!.opacity}));
      expect(snapshotLandDots({ ...land, motion: { seconds: 8, amplitudePx: 0 } })).toEqual(rigid);
    }
  });
});
