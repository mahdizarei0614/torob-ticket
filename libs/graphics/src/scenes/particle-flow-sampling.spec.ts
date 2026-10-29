import { describe,expect,it } from 'vitest';
import { sampleParticleFlowOffset,sampleParticleFlowState,type ParticleFlowSnapshot } from './particle-flow-sampling';

const snapshot=(data:number[],width=2,height=2):ParticleFlowSnapshot=>({data:Float32Array.from(data),dims:{width,height},frame:{x:0,y:0,width:2,height:2},viewport:{width:600,height:600}});
describe('GPU flow snapshot sampling',()=>{
  it('matches texel-center bilinear lookup and clamps only inside the captured geographic extent',()=>{
    const state=snapshot([1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16]);
    expect(sampleParticleFlowState(-.5,-.5,state)).toEqual([1,2,3,4]);
    expect(sampleParticleFlowState(.5,.5,state)).toEqual([13,14,15,16]);
    expect(sampleParticleFlowState(0,0,state)).toEqual([7,8,9,10]);
    expect(sampleParticleFlowState(-1,-1,state)).toEqual([1,2,3,4]);
    expect(sampleParticleFlowState(-1.001,0,state)).toEqual([0,0,0,0]);
    expect(sampleParticleFlowState(0,0)).toEqual([0,0,0,0]);
  });
  it('preserves individual flow direction and bounds the full moving core at every density',()=>{
    const state=snapshot(Array.from({length:16},(_,i)=>i%4===0?20:i%4===1?10:0));
    const offsets=[];
    for(const spacing of [1,2,3,5,8,12,30]){
      const amplitude=Math.max(0,Math.min(9,(spacing*2.5-2)/Math.SQRT1_2));
      const offset=sampleParticleFlowOffset(0,0,.01,amplitude,spacing,[2,1],state);
      const budget=Math.max(0,Math.min(12,spacing*2.5-2-amplitude*Math.SQRT1_2));
      expect(Math.hypot(...offset)).toBeLessThanOrEqual(budget+1e-10);
      if(budget>0)expect(offset[0]).toBeGreaterThan(0);
      expect(amplitude*Math.SQRT1_2+Math.hypot(...offset)+2).toBeLessThanOrEqual(Math.max(2,spacing*2.5)+1e-10);
    }
    for(let i=0;i<20;i++)offsets.push(sampleParticleFlowOffset(i*.01,0,.01,9,30,[0,0],state));
    expect(new Set(offsets.map(offset=>offset.map(v=>v.toFixed(5)).join(','))).size).toBe(20);
  });
  it('settles when GPU flow is unavailable without introducing the old cursor-centered position warp',()=>{
    expect(sampleParticleFlowOffset(0,0,.1,9,30,[0,0])).toEqual([0,0]);
    expect(sampleParticleFlowOffset(0,0,.1,9,30,[0,0],snapshot(new Array(16).fill(0)))).toEqual([0,0]);
  });
});
