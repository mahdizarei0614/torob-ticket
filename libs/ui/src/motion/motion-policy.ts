import {useSyncExternalStore} from 'react';
export interface MotionEnvironment {reducedMotion:boolean;documentVisible:boolean;covered?:boolean;disabled?:boolean}
export function resolveMotionPolicy(environment:MotionEnvironment):boolean{return !environment.reducedMotion&&environment.documentVisible&&!environment.covered&&!environment.disabled;}
export type MotionPurpose='content'|'detail'|'dialog'|'emphasis';
export const motionSpecifications={
 content:{duration:0.18,offset:6},detail:{duration:0.2,offset:4},dialog:{duration:0.22,offset:8},emphasis:{duration:0.18,offset:0},
} as const satisfies Record<MotionPurpose,{duration:number;offset:number}>;
const listeners=new Set<()=>void>();
let detach:(()=>void)|undefined;
function snapshot():number {
 const reduced=typeof matchMedia!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const visible=typeof document!=='undefined'&&document.visibilityState!=='hidden';
 return (reduced?1:0)|(visible?2:0);
}
function subscribe(listener:()=>void):()=>void {
 listeners.add(listener);
 if(listeners.size===1){
  const media=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):undefined;
  const update=()=>{for(const fn of listeners)fn();};
  media?.addEventListener('change',update);document.addEventListener('visibilitychange',update);
  detach=()=>{media?.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};
 }
 return()=>{listeners.delete(listener);if(!listeners.size){detach?.();detach=undefined;}};
}
/** Shared passive listeners; no timer or animation frame is created by policy. */
export function useMotionEnvironment():Pick<MotionEnvironment,'reducedMotion'|'documentVisible'> {
 const flags=useSyncExternalStore(subscribe,snapshot,()=>1);
 return {reducedMotion:Boolean(flags&1),documentVisible:Boolean(flags&2)};
}
