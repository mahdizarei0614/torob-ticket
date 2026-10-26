import { describe, expect, it } from 'vitest';
import { createCameraTransition, fitPresentationBounds } from './camera-transition';

describe('selected region camera', () => {
  it('fits endpoints before ticket selection with breathing room, then includes outlying route stops', () => {
    const endpoints: [number,number,number][] = [[51,35,0],[29,41,0]];
    const region = fitPresentationBounds([endpoints]);
    expect(region.width).toBeLessThan(60); expect(region.width).toBeGreaterThan(22);
    expect(region.x-region.width/2).toBeLessThan(29); expect(region.x+region.width/2).toBeGreaterThan(51);
    const selected = fitPresentationBounds([endpoints,[[10,50,0]]]);
    expect(selected.x-selected.width/2).toBeLessThan(10); expect(selected.width).toBeGreaterThan(region.width);
  });
  it('eases from the current visible frame, pauses while covered, and resumes without hidden-time catchup', () => {
    const world = {x:0,y:15,width:360,height:160};
    const target = {x:40,y:38,width:40,height:20};
    const camera = createCameraTransition(world,1000);
    camera.setTarget(target);
    for(let i=0;i<10;i++)camera.sample(50,true);
    const half=camera.current();
    expect(half.width).toBeCloseTo(200); expect(half.x).toBeCloseTo(20);
    expect(camera.sample(100000,false)).toEqual(half);
    const resumed=camera.sample(100000,true);
    expect(resumed.width).toBeLessThan(half.width);expect(resumed.width).toBeGreaterThan(target.width);
    camera.setTarget({...target,x:60});expect(camera.current()).toEqual(resumed);
    for(let i=0;i<20;i++)camera.sample(50,true);
    expect(camera.current()).toEqual({...target,x:60});
  });
  it('settles reduced motion directly and never restarts for identical target props', () => {
    const world={x:0,y:15,width:360,height:160}, target={x:40,y:38,width:40,height:20};
    const camera=createCameraTransition(world);camera.setTarget(target,true);
    expect(camera.current()).toEqual(target);camera.setTarget({...target});expect(camera.sample(10,true)).toEqual(target);
  });
  it('rebases a fitted camera when pinning changes the central meridian, keeping endpoint screen positions continuous',()=>{
    const camera=createCameraTransition({x:40,y:38,width:40,height:30});
    const before=51-camera.current().x;
    camera.rebaseLongitude(-40);
    expect(11-camera.current().x).toBe(before);
    camera.setTarget({x:0,y:38,width:46,height:35});
    expect(camera.current().x).toBe(0);
    const global=createCameraTransition({x:0,y:15,width:360,height:160});global.rebaseLongitude(-180);
    expect(global.current().x).toBe(0);
  });
});
