import type { RouteBounds } from '../geo/projection';
import { livingDotSeed } from './living-dot-drift';

export interface ParticleFlowSnapshot {
  data: Float32Array;
  dims: { width: number; height: number };
  /** Absolute geographic center and extent; independent of the projection cut. */
  frame: RouteBounds;
  viewport: { width: number; height: number };
}
export const PARTICLE_FLOW_MAX_OFFSET_PX = 12;
/** Matches linear-filtered, clamp-to-edge texture sampling at texel centers. */
export function sampleParticleFlowState(x: number, y: number, state?: ParticleFlowSnapshot): readonly [number,number,number,number] {
  if(!state)return [0,0,0,0];
  const {frame,dims,data}=state;
  const u=(x-frame.x)/frame.width+.5,v=(y-frame.y)/frame.height+.5;
  if(u<0||u>1||v<0||v>1||dims.width<1||dims.height<1)return [0,0,0,0];
  const px=u*dims.width-.5,py=v*dims.height-.5,x0=Math.floor(px),y0=Math.floor(py),fx=px-x0,fy=py-y0;
  const texel=(ix:number,iy:number,component:number)=>data[(Math.max(0,Math.min(dims.height-1,iy))*dims.width+Math.max(0,Math.min(dims.width-1,ix)))*4+component]??0;
  return [0,1,2,3].map(channel=>{
    const a=texel(x0,y0,channel)*(1-fx)+texel(x0+1,y0,channel)*fx,b=texel(x0,y0+1,channel)*(1-fx)+texel(x0+1,y0+1,channel)*fx;
    return a*(1-fy)+b*fy;
  }) as unknown as readonly [number,number,number,number];
}
/** Seeded variation preserves the shared fluid motion, without a radial exclusion. */
export function sampleParticleFlowOffset(anchorX:number,anchorY:number,unit:number,amplitude:number,spacingPx:number,drift:readonly number[],state?:ParticleFlowSnapshot):readonly [number,number] {
  const budget=Math.max(0,Math.min(PARTICLE_FLOW_MAX_OFFSET_PX,spacingPx*2.5-2-amplitude*Math.SQRT1_2));
  if(!state||budget<=0)return [0,0];
  const raw=sampleParticleFlowState(anchorX+drift[0]!*unit,anchorY+drift[1]!*unit,state),seed=livingDotSeed(anchorX,anchorY);
  const angle=((seed&65535)/65535-.5)*.42,strength=.84+(seed>>>16)/65535*.28;
  const x=(raw[0]*Math.cos(angle)-raw[1]*Math.sin(angle))*strength,y=(raw[0]*Math.sin(angle)+raw[1]*Math.cos(angle))*strength;
  const u=(anchorX+drift[0]!*unit-state.frame.x)/state.frame.width+.5,v=(anchorY+drift[1]!*unit-state.frame.y)/state.frame.height+.5;
  const edge=Math.min(u,v,1-u,1-v),t=Math.max(0,Math.min(1,edge/.035));
  const scale=budget/Math.sqrt(budget*budget+x*x+y*y)*t*t*(3-2*t);
  return [x*scale,y*scale];
}
