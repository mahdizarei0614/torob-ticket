import {expect,it} from 'vitest';
import {createProgressTransition} from './progress-transition';
it('advances only finite same-route forward motion and snaps revocation/direction/reduced/hidden changes',()=>{
 const motion=createProgressTransition('a:outbound',0);
 expect(motion.set({key:'a:outbound',target:.35,enabled:true,now:0})).toBe(true);
 expect(motion.sample(350)).toBeCloseTo(.175);expect(motion.sample(700)).toBe(.35);expect(motion.active()).toBe(false);
 motion.set({key:'a:outbound',target:.7,enabled:true,now:800});expect(motion.sample(900)).toBeGreaterThan(.35);
 expect(motion.set({key:'a:outbound',target:.35,enabled:true,now:901})).toBe(false);expect(motion.sample(902)).toBe(.35);
 motion.set({key:'a:return',target:.7,enabled:true,now:1000});expect(motion.sample(1001)).toBe(.7);
 motion.set({key:'a:return',target:1,enabled:false,now:1100});expect(motion.sample(1101)).toBe(1);expect(motion.active()).toBe(false);
 motion.set({key:'a:return',target:1,enabled:true,now:1200});motion.cancel();expect(motion.active()).toBe(false);
});

it('emphasizes the selected route only within its finite forward transition, settling every cancellation',()=>{
 const motion=createProgressTransition('outbound',.35);expect(motion.emphasis(0)).toBe(0);
 motion.set({key:'outbound',target:.7,enabled:true,now:100});expect(motion.emphasis(100)).toBe(0);expect(motion.emphasis(450)).toBe(1);expect(motion.emphasis(800)).toBe(0);expect(motion.active()).toBe(false);
 motion.set({key:'outbound',target:1,enabled:true,now:900});expect(motion.emphasis(1100)).toBeGreaterThan(0);motion.cancel();expect(motion.emphasis(1101)).toBe(0);
 motion.set({key:'return',target:.7,enabled:true,now:1200});expect(motion.emphasis(1500)).toBe(0);
 motion.set({key:'return',target:1,enabled:false,now:1600});expect(motion.emphasis(1800)).toBe(0);
 motion.set({key:'return',target:1,enabled:true,now:1900});expect(motion.emphasis(2000)).toBe(0);
});
