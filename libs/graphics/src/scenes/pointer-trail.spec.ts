import {describe,expect,it} from 'vitest';
import {createPointerTrail,POINTER_TRAIL_CAPACITY,pointerTrailEnvelope} from './pointer-trail';
const moving={active:true,reducedMotion:false};
describe('subtle geographic pointer trail',()=>{
  it('has a soft onset and fades over 1.8 seconds after leaving a location',()=>{
    const trail=createPointerTrail();trail.advance(0,{x:3,y:7,active:true},2,moving);
    expect(trail.sample(3,7)).toBe(0);
    trail.advance(50,undefined,2,moving);expect(trail.sample(3,7)).toBeGreaterThan(0);expect(trail.sample(3,7)).toBeLessThan(.3);
    trail.advance(100,undefined,2,moving);expect(trail.sample(3,7)).toBe(1);
    trail.advance(750,undefined,2,moving);expect(trail.sample(3,7)).toBeGreaterThan(.4);expect(trail.sample(3,7)).toBeLessThan(.7);
    trail.advance(900,undefined,2,moving);expect(trail.sample(3,7)).toBe(0);expect([...trail.uniforms]).toEqual(Array(64).fill(0));
  });
  it('leaves old world positions lit while the cursor moves to a new position',()=>{
    const trail=createPointerTrail();trail.advance(0,{x:0,y:0,active:true},1,moving);
    trail.advance(120,{x:4,y:0,active:true},1,moving);
    trail.advance(150,{x:8,y:0,active:true},1,moving);
    expect(trail.sample(0,0)).toBeGreaterThan(.9);expect(trail.sample(4,0)).toBe(1);expect(trail.sample(8,0)).toBe(0);
    expect(trail.sample(20,0)).toBe(0);
  });
  it('bounds history, keeps original world radii during zoom, and never stacks a hotspot',()=>{
    const trail=createPointerTrail();trail.advance(0,{x:1,y:2,active:true},3,moving);
    trail.advance(120,{x:1,y:2,active:true},.3,moving);
    expect(trail.uniforms[2]).toBe(3);expect(trail.uniforms[6]).toBeCloseTo(.3);
    for(let i=0;i<100;i++)trail.advance(120,{x:1,y:2,active:true},1,moving);
    expect(trail.uniforms.length).toBe(POINTER_TRAIL_CAPACITY*4);
    expect(trail.sample(1,2)).toBeLessThanOrEqual(1);expect(trail.sample(1,2)).toBeGreaterThan(.9);
  });
  it('pauses without advancing under cover and clears immediately for reduced motion or a new projection',()=>{
    const trail=createPointerTrail();trail.advance(0,{x:1,y:2,active:true},1,moving);trail.advance(180,undefined,1,moving);
    const previous=[...trail.uniforms];trail.advance(90000,undefined,1,{active:false,reducedMotion:false});expect([...trail.uniforms]).toEqual(previous);
    trail.advance(0,undefined,1,{active:false,reducedMotion:true});expect(trail.sample(1,2)).toBe(0);expect([...trail.uniforms]).toEqual(Array(64).fill(0));
    trail.advance(0,{x:8,y:9,active:true},1,moving);trail.advance(180,undefined,1,moving);trail.clear();expect(trail.sample(8,9)).toBe(0);
  });
  it('keeps the envelope finite, nonnegative and capped throughout its lifetime',()=>{
    expect(pointerTrailEnvelope(-1)).toBe(0);expect(pointerTrailEnvelope(10000)).toBe(0);
    for(let age=0;age<=1800;age+=10){expect(pointerTrailEnvelope(age)).toBeGreaterThanOrEqual(0);expect(pointerTrailEnvelope(age)).toBeLessThanOrEqual(1);}
  });
});
