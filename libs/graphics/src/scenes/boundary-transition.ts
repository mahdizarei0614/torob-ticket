/** Sequential boundary presence, separate from land particles and their morph. */
export const BOUNDARY_EXIT_MS=300;
export const BOUNDARY_ENTER_MS=1000;
export interface BoundaryLayer<T> { value:T; opacity:number; longitude:number }
const smooth=(t:number)=>{const n=Math.min(1,Math.max(0,t));return n*n*(3-2*n);};
/** At most one visible owner plus one pending owner; dispose only after its exit. */
export function createBoundaryTransition<T>(dispose:(value:T)=>void){
 let layers:BoundaryLayer<T>[]=[],elapsed=0,initialOpacity=1,phase:'idle'|'exit'|'enter'='idle';
 const release=(layer:BoundaryLayer<T>)=>dispose(layer.value);
 return {
  layers:()=>layers,
  change(value:T,longitude:number,reduced=false){
   if(layers.at(-1)?.value===value){if(reduced)this.settle();return;}
   if(!layers.length||reduced){layers.forEach(release);layers=[{value,longitude,opacity:1}];phase='idle';return;}
   const visible=layers.find(layer=>layer.opacity>0);
   layers.filter(layer=>layer!==visible).forEach(release);
   layers=visible?[visible,{value,longitude,opacity:0}]:[{value,longitude,opacity:0}];
   initialOpacity=visible?.opacity??0;elapsed=0;phase=visible?'exit':'enter';
  },
  settle(){if(!layers.length)return;const target=layers.at(-1)!;layers.filter(layer=>layer!==target).forEach(release);target.opacity=1;layers=[target];phase='idle';elapsed=0;},
  advance(ms:number,active:boolean,reduced:boolean){
   if(reduced){const changed=layers.length>1;this.settle();return changed;}
   if(!active||phase==='idle')return false;
   elapsed+=Math.max(0,Math.min(50,ms));
   if(phase==='exit'){
    layers[0]!.opacity=initialOpacity*(1-smooth(elapsed/BOUNDARY_EXIT_MS));
    if(elapsed>=BOUNDARY_EXIT_MS){release(layers.shift()!);elapsed-=BOUNDARY_EXIT_MS;phase='enter';layers[0]!.opacity=smooth(elapsed/BOUNDARY_ENTER_MS);return true;}
   }else{layers[0]!.opacity=smooth(elapsed/BOUNDARY_ENTER_MS);if(elapsed>=BOUNDARY_ENTER_MS)phase='idle';}
   return false;
  },
  dispose(){layers.forEach(release);layers=[];phase='idle';},
 };
}
