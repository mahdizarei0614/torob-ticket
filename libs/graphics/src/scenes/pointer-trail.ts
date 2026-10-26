export const POINTER_TRAIL_CAPACITY=16;
export const POINTER_TRAIL_SAMPLE_MS=120;
export const POINTER_TRAIL_ATTACK_MS=150;
export const POINTER_TRAIL_LIFETIME_MS=1800;
export const POINTER_TRAIL_RADIUS_PX=48;
export interface TrailPointer { x:number;y:number;active:boolean }
interface TrailSample { x:number;y:number;radius:number;born:number }
const smooth=(low:number,high:number,value:number)=>{const t=Math.min(1,Math.max(0,(value-low)/(high-low)));return t*t*(3-2*t);};
export function pointerTrailEnvelope(ageMs:number){
  return smooth(0,POINTER_TRAIL_ATTACK_MS,ageMs)*(1-smooth(POINTER_TRAIL_ATTACK_MS,POINTER_TRAIL_LIFETIME_MS,ageMs));
}

/** Fixed world-space samples. Repeated visits combine by max, so holding still cannot stack light. */
export function createPointerTrail(){
  const uniforms=new Float32Array(POINTER_TRAIL_CAPACITY*4);
  let elapsed=0,lastSample=-Infinity;const samples:TrailSample[]=[];
  const clear=()=>{samples.length=0;uniforms.fill(0);elapsed=0;lastSample=-Infinity;};
  const publish=()=>{
    uniforms.fill(0);
    samples.forEach((sample,index)=>uniforms.set([sample.x,sample.y,sample.radius,pointerTrailEnvelope(elapsed-sample.born)],index*4));
    return uniforms;
  };
  return {
    uniforms,clear,
    advance(deltaMs:number,pointer:TrailPointer|undefined,radius:number,options:{active:boolean;reducedMotion:boolean}){
      if(options.reducedMotion){clear();return uniforms;}
      if(!options.active)return uniforms;
      elapsed+=Math.max(0,deltaMs);
      while(samples.length && elapsed-samples[0]!.born>=POINTER_TRAIL_LIFETIME_MS)samples.shift();
      if(pointer?.active && Number.isFinite(pointer.x) && Number.isFinite(pointer.y) && radius>0 && elapsed-lastSample>=POINTER_TRAIL_SAMPLE_MS){
        if(samples.length===POINTER_TRAIL_CAPACITY)samples.shift();
        samples.push({x:pointer.x,y:pointer.y,radius,born:elapsed});lastSample=elapsed;
      }
      return publish();
    },
    sample(x:number,y:number){
      let strength=0;
      for(let index=0;index<POINTER_TRAIL_CAPACITY;index++){
        const offset=index*4,weight=uniforms[offset+3]!;
        if(weight<=0)continue;
        const radial=1-smooth(0,uniforms[offset+2]!,Math.hypot(x-uniforms[offset]!,y-uniforms[offset+1]!));
        strength=Math.max(strength,radial*weight);
      }
      return strength;
    },
  };
}
