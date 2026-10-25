export interface AnchorEnvironment { measure: (id: string) => number | undefined; adjust: (delta: number) => void; frame: (callback: () => void) => number; cancelFrame: (id: number) => void }
/** Three bounded layout opportunities, with no observer or continuous correction loop. */
export function createScrollAnchor(environment: AnchorEnvironment) {
 let anchor: {id:string;top:number} | undefined;
 let epoch = 0; let frame: number | undefined;
 function cancel() { epoch++; anchor=undefined; if (frame !== undefined) environment.cancelFrame(frame); frame=undefined; }
 function capture(value: {id:string;top:number} | undefined) { cancel(); if (value && Number.isFinite(value.top)) anchor=value; }
 function layout() {
  if (!anchor) return;
  const ownEpoch=epoch;
  function correct(remaining: number) {
   frame=undefined; if (epoch !== ownEpoch || !anchor) return;
   const top=environment.measure(anchor.id);
   if (top === undefined || !Number.isFinite(top)) { cancel(); return; }
   const delta=top-anchor.top; if (Math.abs(delta) > .1) environment.adjust(delta);
   if (remaining) frame=environment.frame(()=>correct(remaining-1)); else anchor=undefined;
  }
  correct(2);
 }
 return { capture,layout,cancel };
}
