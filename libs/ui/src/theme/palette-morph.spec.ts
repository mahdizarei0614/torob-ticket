import {afterEach,expect,it,vi} from 'vitest';
import {modePaletteDuration,readThemePalette,runPaletteMorph} from './palette-morph';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.documentElement.removeAttribute('style');delete document.documentElement.dataset.paletteTransition;});
function environment() {
  let now=0,reduced=false,forced=false,visible=true;
  const callbacks=new Map<number,FrameRequestCallback>();let next=0;
  const listeners=new Map<string,()=>void>();
  vi.spyOn(performance,'now').mockImplementation(()=>now);
  vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visible?'visible':'hidden');
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callbacks.set(++next,callback);return next;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>callbacks.delete(id));
  vi.stubGlobal('matchMedia',(query:string)=>({get matches(){return query.includes('forced')?forced:reduced;},addEventListener:(_:string,listener:()=>void)=>listeners.set(query,listener),removeEventListener:()=>listeners.delete(query)}));
  const frame=(time:number)=>{now=time;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(callback=>callback(now));};
  return {frame,pending:()=>callbacks.size,reduce(){reduced=true;listeners.get('(prefers-reduced-motion: reduce)')?.();},force(){forced=true;listeners.get('(forced-colors: active)')?.();},hide(){visible=false;document.dispatchEvent(new Event('visibilitychange'));}};
}
function palette() {
  const root=document.documentElement;
  root.style.setProperty('--canvas','#000000');root.style.setProperty('--scene-route','#204060');
  const from=readThemePalette();
  return {root,from,next:()=>{root.style.setProperty('--canvas','#808080');root.style.setProperty('--scene-route','#608020');}};
}
it('publishes actual intermediate CSS colors and settles its finite clock without native snapshots',async()=>{
  const env=environment(),{root,from,next}=palette(),frames:string[]=[];
  const run=runPaletteMorph(next,{from,isCurrent:()=>true,onFrame:()=>frames.push(root.style.getPropertyValue('--canvas'))});
  expect(root.dataset.paletteTransition).toBe('morph');expect(frames.at(-1)).toBe('rgba(0,0,0,1)');
  env.frame(modePaletteDuration/2);expect(frames.at(-1)).toBe('rgba(64,64,64,1)');expect(root.style.getPropertyValue('--scene-route')).toBe('rgba(64,96,64,1)');
  env.frame(modePaletteDuration);await run.finished;
  expect(root.style.getPropertyValue('--canvas')).toBe('#808080');expect(root.dataset.paletteTransition).toBeUndefined();expect(env.pending()).toBe(0);
});
it('a replacement can start from the visible interrupted colors and obsolete callbacks cannot publish',async()=>{
  const env=environment(),{root,from,next}=palette();let owner=1;const frames=vi.fn();
  const first=runPaletteMorph(next,{from,isCurrent:()=>owner===1,onFrame:frames});
  env.frame(modePaletteDuration/2);const visible=readThemePalette();expect(visible['--canvas']).toBe('rgba(64,64,64,1)');
  owner=2;first.skip();await first.finished;
  const second=runPaletteMorph(()=>root.style.setProperty('--canvas','#000000'),{from:visible,isCurrent:()=>owner===2,onFrame:frames});
  expect(root.style.getPropertyValue('--canvas')).toBe('rgba(64,64,64,1)');env.frame(modePaletteDuration);expect(root.style.getPropertyValue('--canvas')).toBe('rgba(32,32,32,1)');
  env.frame(modePaletteDuration*1.5);await second.finished;expect(root.style.getPropertyValue('--canvas')).toBe('#000000');expect(env.pending()).toBe(0);
});
it.each(['reduce','hide','force'] as const)('settles directly on %s and removes its listeners and pending frame',async action=>{
  const env=environment(),{root,from,next}=palette(),flush=vi.fn(async()=>undefined);
  const run=runPaletteMorph(next,{from,isCurrent:()=>true,onFrame:()=>undefined,onApplied:flush});
  env.frame(150);env[action]();await run.finished;
  expect(root.style.getPropertyValue('--canvas')).toBe('#808080');expect(flush).toHaveBeenCalledTimes(1);expect(env.pending()).toBe(0);expect(root.dataset.paletteTransition).toBeUndefined();
});
it('restores existing inline values and priority when cancelled without an obsolete publication',async()=>{
  const env=environment(),{root,from}=palette();root.style.setProperty('--canvas','#808080');
  // JSDOM does not retain priorities for custom properties; verify the restoration argument explicitly.
  vi.spyOn(root.style,'getPropertyPriority').mockImplementation(token=>token==='--canvas'?'important':'');
  const write=vi.spyOn(root.style,'setProperty');const frames=vi.fn();let current=true;
  const run=runPaletteMorph(()=>undefined,{from,isCurrent:()=>current,onFrame:frames});env.frame(150);const count=frames.mock.calls.length;
  current=false;run.skip();await run.finished;env.frame(900);
  expect(root.style.getPropertyValue('--canvas')).toBe('#808080');expect(write).toHaveBeenLastCalledWith('--canvas','#808080','important');expect(frames).toHaveBeenCalledTimes(count);expect(env.pending()).toBe(0);
});
