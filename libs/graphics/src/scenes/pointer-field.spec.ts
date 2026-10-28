import { describe, expect, it } from 'vitest';
import { POINTER_TRAIL_RADIUS_PX } from './pointer-trail';
import { sampleLivingDotOffset } from './living-dot-drift';
import { createPointerField, samplePointerRepulsion, POINTER_REPULSION_PX, pointerRepulsionRadiusPx } from './pointer-field';

describe('soft local pointer repulsion',()=>{
  it('attacks and releases smoothly, follows without teleporting, and freezes while covered',()=>{
    const field=createPointerField(),cursor={x:10,y:20,active:true};
    field.advance(16,cursor,4,{active:true,reducedMotion:false});
    expect(field.uniforms[3]).toBeGreaterThan(0);expect(field.uniforms[3]).toBeLessThan(.1);
    for(let i=0;i<40;i++)field.advance(16,cursor,4,{active:true,reducedMotion:false});
    expect(field.uniforms[3]).toBeGreaterThan(.9);
    field.advance(16,{x:20,y:20,active:true},4,{active:true,reducedMotion:false});
    expect(field.uniforms[0]).toBeGreaterThan(10);expect(field.uniforms[0]).toBeLessThan(13);
    const before=[...field.uniforms];field.advance(5000,undefined,4,{active:false,reducedMotion:false});expect([...field.uniforms]).toEqual(before);
    field.advance(16,undefined,4,{active:true,reducedMotion:false});expect(field.uniforms[3]).toBeGreaterThan(.8);
    for(let i=0;i<200;i++)field.advance(16,undefined,4,{active:true,reducedMotion:false});expect(field.uniforms[3]).toBeLessThan(.002);
    field.advance(0,cursor,4,{active:true,reducedMotion:true});expect([...field.uniforms]).toEqual([0,0,0,0]);
  });
  it('pushes away within radius, has stable finite center direction, and uses CSS pixels across zoom',()=>{
    for(const unit of [.01,.1,1]){
      const field=[0,0,pointerRepulsionRadiusPx(580,634)*unit,1];
      const offset=samplePointerRepulsion(10*unit,0,unit,0,9,30,field);
      expect(offset[0]).toBeGreaterThan(9);expect(Math.abs(offset[1])).toBeLessThan(.001);
      expect(Math.hypot(...offset)).toBeLessThanOrEqual(POINTER_REPULSION_PX);
      expect(samplePointerRepulsion(111*unit,0,unit,0,9,30,field)).toEqual([0,0]);
      const center=samplePointerRepulsion(0,0,unit,0,9,30,field);
      expect(Math.hypot(...center)).toBeCloseTo(12/Math.SQRT2);expect(center.every(Number.isFinite)).toBe(true);
      expect(samplePointerRepulsion(0,0,unit,0,9,30,field)).toEqual(center);
    }
  });
  it('separates broad repulsion from restrained illumination and influences particles beyond the old radius',()=>{
    expect(POINTER_TRAIL_RADIUS_PX).toBe(48);expect(pointerRepulsionRadiusPx(580,634)).toBe(110);
    expect(pointerRepulsionRadiusPx(580,634)).toBeGreaterThan(POINTER_TRAIL_RADIUS_PX*2);
    for(const unit of [.01,.1,1]){
      const offset=samplePointerRepulsion(80*unit,0,unit,0,9,30,[0,0,110*unit,1]);
      expect(offset[0]).toBeGreaterThan(2);expect(Math.hypot(...offset)).toBeLessThanOrEqual(12);
    }
    expect(pointerRepulsionRadiusPx(200,200)).toBe(40);expect(pointerRepulsionRadiusPx(-1,200)).toBe(0);
  });
  it('keeps the seeded center direction when screen coordinates are reconstructed after projection changes',()=>{
    const seedAnchor=[53,32],before=samplePointerRepulsion(53,32,.1,0,9,30,[53,32,4.8,1],[0,0],seedAnchor);
    const after=samplePointerRepulsion(133,32,.1,80,9,30,[53,32,4.8,1],[0,0],seedAnchor);
    expect(after[0]).toBeCloseTo(before[0],12);expect(after[1]).toBeCloseTo(before[1],12);
  });
  it('repels the currently floating particle rather than its static lattice anchor',()=>{
    const x=53,y=32,unit=.1,drift=sampleLivingDotOffset(x,y,7.3,9);
    const field=[x+drift[0]*unit*.5,y+drift[1]*unit*.5,48*unit,1];
    const offset=samplePointerRepulsion(x,y,unit,0,9,30,field,drift);
    expect(offset[0]*drift[0]+offset[1]*drift[1]).toBeGreaterThan(0);
  });
  it('passes smoothly through the displaced center fallback without a direction flip',()=>{
    // For anchor0 the fallback points+x. Its displaced singularity used to
    // normalize a vector crossingzero and jump almost24CSSpixels.
    let previous=samplePointerRepulsion(0,0,1,0,9,30,[.2,0,48,1]);
    for(let cursor=.2001;cursor<.5;cursor+=.0001){
      const next=samplePointerRepulsion(0,0,1,0,9,30,[cursor,0,48,1]);
      expect(Math.hypot(next[0]-previous[0],next[1]-previous[1])).toBeLessThan(.02);
      previous=next;
    }
  });
  it('bounds the actual displaced particle with a strength-scaled prefilter, including the idle path',()=>{
    for(const spacing of [1,2,4,6,12,30])for(const strength of [0,.001,.1,.4,.8,1]){
      const amplitude=Math.max(0,Math.min(9,(spacing*2.5-2)/Math.SQRT1_2));
      const bound=amplitude*Math.SQRT1_2+Math.max(0,Math.min(12,spacing*2.5-2-amplitude*Math.SQRT1_2))*strength;
      for(let i=0;i<80;i++){
        const anchor=[44+i*.44,25+i*.037],drift=sampleLivingDotOffset(anchor[0]!,anchor[1]!,i*.137,amplitude);
        const field=[anchor[0]!+(i%11-5)*.1,anchor[1]!+(i%7-3)*.1,4.8,strength];
        const offset=samplePointerRepulsion(anchor[0]!,anchor[1]!, .1,0,amplitude,spacing,field,drift);
        expect(Math.max(Math.abs(drift[0]+offset[0]),Math.abs(drift[1]+offset[1]))).toBeLessThanOrEqual(bound+1e-10);
        if(strength===0)expect(offset).toEqual([0,0]);
      }
    }
  });
  it('reserves the full moving core inside the existing 5 by 5 neighbor coverage',()=>{
    for(const spacing of [.5,1,2,3,5,8,12,20]){
      const amplitude=Math.max(0,Math.min(9,(spacing*2.5-2)/Math.SQRT1_2));
      const offset=samplePointerRepulsion(0,0,1,0,amplitude,spacing,[0,0,48,1]);
      expect(Math.hypot(...offset)).toBeLessThanOrEqual(12);
      expect(amplitude*Math.SQRT1_2+Math.hypot(...offset)+2).toBeLessThanOrEqual(Math.max(2,spacing*2.5)+1e-10);
    }
  });
});
