import {describe,expect,it} from 'vitest';
import {resolveMotionPolicy} from './motion-policy';
describe('finite interface motion permission',()=>{
 it('permits one deliberate transition in the visible uncovered interface',()=>{expect(resolveMotionPolicy({reducedMotion:false,documentVisible:true})).toBe(true);});
 it('disables motion for each user, lifecycle and coverage boundary',()=>{for(const patch of [{reducedMotion:true},{documentVisible:false},{covered:true},{disabled:true}])expect(resolveMotionPolicy({reducedMotion:false,documentVisible:true,...patch})).toBe(false);});
});
