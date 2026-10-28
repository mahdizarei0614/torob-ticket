import {expect,it,vi} from 'vitest';
import {createBoundaryTransition} from './boundary-transition';
const tick=(transition:ReturnType<typeof createBoundaryTransition<string>>,ms:number)=>{for(let left=ms;left>0;left-=50)transition.advance(Math.min(50,left),true,false);};
it('retains the outgoing owner for300ms and only then fades in its replacement for1s',()=>{
 const dispose=vi.fn(),transition=createBoundaryTransition<string>(dispose);
 transition.change('iran',0);transition.change('world',20);
 expect(transition.layers().map(l=>l.opacity)).toEqual([1,0]);
 tick(transition,150);expect(transition.layers().map(l=>l.opacity)).toEqual([.5,0]);expect(dispose).not.toHaveBeenCalled();
 tick(transition,150);expect(dispose).toHaveBeenCalledExactlyOnceWith('iran');expect(transition.layers()).toEqual([{value:'world',longitude:20,opacity:0}]);
 tick(transition,500);expect(transition.layers()[0]!.opacity).toBe(.5);tick(transition,500);expect(transition.layers()[0]!.opacity).toBe(1);
});
it('snapshots current visible opacity on rapid changes and never retains more than2owners',()=>{
 const dispose=vi.fn(),transition=createBoundaryTransition<string>(dispose);
 transition.change('a',0);transition.change('b',30);tick(transition,100);const alpha=transition.layers()[0]!.opacity;
 transition.change('c',40);expect(transition.layers().map(l=>l.value)).toEqual(['a','c']);expect(transition.layers()[0]!.opacity).toBe(alpha);expect(dispose).toHaveBeenCalledExactlyOnceWith('b');
 tick(transition,500);const incoming=transition.layers()[0]!.opacity;expect(incoming).toBeGreaterThan(0);expect(incoming).toBeLessThan(1);
 transition.change('d',50);expect(transition.layers()[0]!.opacity).toBe(incoming);
 for(let i=0;i<30;i++){transition.change('n'+i,60);expect(transition.layers().length).toBeLessThanOrEqual(2);tick(transition,16);}
 transition.dispose();expect(transition.layers()).toEqual([]);expect(new Set(dispose.mock.calls.map(call=>call[0])).size).toBe(dispose.mock.calls.length);
});
it('pauses when covered, bounds delayed frames and settles/disposes immediately for reduced motion',()=>{
 const dispose=vi.fn(),transition=createBoundaryTransition<string>(dispose);transition.change('a',0);transition.change('b',0);tick(transition,100);const before=transition.layers()[0]!.opacity;
 transition.advance(10000,false,false);expect(transition.layers()[0]!.opacity).toBe(before);
 transition.advance(10000,true,false);expect(transition.layers()[0]!.opacity).toBe(.5);
 transition.advance(0,false,true);expect(transition.layers()).toEqual([{value:'b',longitude:0,opacity:1}]);expect(dispose).toHaveBeenCalledExactlyOnceWith('a');
 transition.change('c',0,true);expect(dispose).toHaveBeenLastCalledWith('b');transition.dispose();expect(dispose).toHaveBeenLastCalledWith('c');
});
