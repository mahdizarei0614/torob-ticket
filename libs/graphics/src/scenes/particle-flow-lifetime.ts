import type { MapParticleFlow } from '../particle-flow';

/** A DOM surface can retain its engine while the R3F Activity disconnects effects. */
export function createParticleFlowLifetime(flow: MapParticleFlow) {
  const owners=new Set<object>();
  let generation=0,disposed=false;
  return {
    flow,
    get disposed(){return disposed;},
    retain(owner:object){if(disposed)return;owners.add(owner);generation++;},
    release(owner:object){
      owners.delete(owner);
      const pending=++generation;
      // React StrictMode replays effects synchronously. A matching setup retains
      // this same engine before this checkpoint, preserving shared uniforms.
      queueMicrotask(()=>{if(!disposed&&owners.size===0&&generation===pending){disposed=true;flow.dispose();}});
    },
  };
}
export type ParticleFlowLifetime=ReturnType<typeof createParticleFlowLifetime>;
