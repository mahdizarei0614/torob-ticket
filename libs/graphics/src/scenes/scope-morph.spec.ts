import { describe, expect, it } from 'vitest';
import { worldLandPositions } from '../geo/world-context';
import { createScopeMorph, sampleMorphParticle, snapshotLandDots, scopeMorphLandOpacity, scopeMorphTiming, scopeMorphSeed, scopeMorphParticleProgress, sampleVisibleMorphParticle, SCOPE_MORPH_DURATION_MS, SCOPE_MORPH_PARTICLE_LIMIT } from './scope-morph';

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
      expect(Number.isFinite(halfway.x) && Number.isFinite(halfway.y)).toBe(true);
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
    for (const seed of [0,.2,.5,.9,1]) { expect(scopeMorphLandOpacity(0,seed)).toBe(0); expect(scopeMorphLandOpacity(1,seed)).toBe(1); }
  });
  it('spreads arrivals through the transition and hands off only each arrived dot', () => {
    const particles = Array.from({length:1000},(_,i)=>({from:{x:-.8,y:0,opacity:1},to:{x:.8,y:0,opacity:1},seed:scopeMorphSeed(44+i*.037,30+i*.011)}));
    const arrivals=particles.map(p=>{const timing=scopeMorphTiming(p.seed);return timing.delay+timing.duration;});
    expect(Math.max(...arrivals)-Math.min(...arrivals)).toBeGreaterThan(.35);
    expect(new Set(arrivals.map(value=>Math.floor(value*20))).size).toBeGreaterThanOrEqual(8);
    expect(particles.some(p=>scopeMorphParticleProgress(.7,p.seed)===1)).toBe(true);
    expect(particles.some(p=>scopeMorphParticleProgress(.7,p.seed)<.9)).toBe(true);
    for(const p of particles){
      const timing=scopeMorphTiming(p.seed), arrival=timing.delay+timing.duration;
      expect(scopeMorphParticleProgress(timing.delay,p.seed)).toBe(0);
      expect(scopeMorphLandOpacity(arrival-.0001,p.seed)).toBe(0);
      expect(scopeMorphLandOpacity(1,p.seed)).toBe(1);
      const middle=arrival+.045, visible=sampleVisibleMorphParticle(p,middle);
      expect(visible.x).toBeCloseTo(p.to.x);expect(visible.y).toBeCloseTo(p.to.y);
      expect(visible.opacity+scopeMorphLandOpacity(middle,p.seed)).toBeCloseTo(1,12);
      expect(sampleVisibleMorphParticle(p,1).opacity).toBe(0);
    }
  });
  it('snapshots the visible target gate and interrupted particle opacity without an end-wave reset',()=>{
    const context={centralLongitude:0};const positions=worldLandPositions([{geometry:{type:'Polygon',coordinates:[[[40,20],[70,20],[70,45],[40,45],[40,20]]]}}],context);
    const land={positions,context,domestic:true,frame:{x:55,y:32,width:30,height:25},width:600};
    const full=snapshotLandDots(land), mid=snapshotLandDots({...land,morphProgress:.7});
    expect(mid).toHaveLength(full.length);
    expect(mid.some(p=>p.opacity===0)).toBe(true);expect(mid.some(p=>p.opacity>.9)).toBe(true);
    mid.forEach((p,i)=>expect(p.opacity).toBeCloseTo(full[i]!.opacity*scopeMorphLandOpacity(.7,p.arrivalSeed!),12));
    const morph=createScopeMorph();morph.start(source,full);
    for(let i=0;i<24;i++)morph.advance(50,true,false);
    const visible=morph.snapshot();const next=morph.start(visible,source);
    next.forEach((p,i)=>expect(sampleVisibleMorphParticle(p,0)).toEqual(visible[i]));
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
