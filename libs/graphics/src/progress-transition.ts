/** A finite transition sampled only by the shared host's frame owner; it requests no RAF. */
export function createProgressTransition(key:string,target:number) {
 let identity=key;let goal=target;let value=target;let tween:{from:number;start:number}|undefined;
 function sample(now:number) {
  if(!tween) return value;
  const t=Math.max(0,Math.min(1,(now-tween.start)/700));value=tween.from+(goal-tween.from)*t*t*(3-2*t);
  if(t===1) tween=undefined;
  return value;
 }
 return {
  set(next:{key:string;target:number;enabled:boolean;now:number}) {
   sample(next.now);const forward=next.key===identity && next.target>goal && next.enabled;
   identity=next.key;goal=next.target;
   if(forward) tween={from:value,start:next.now};else{value=goal;tween=undefined;}
   return Boolean(tween);
  },
  sample,
  /** A bounded shader accent sampled by the same finite host-owned transition. */
  emphasis(now:number){sample(now);if(!tween)return 0;const t=Math.max(0,Math.min(1,(now-tween.start)/700));return 4*t*(1-t);},
  active:()=>Boolean(tween),
  cancel(){value=goal;tween=undefined;},
 };
}
