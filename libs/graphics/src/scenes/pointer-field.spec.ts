import { expect,it } from 'vitest';
import { POINTER_TRAIL_RADIUS_PX } from './pointer-trail';
import { pointerRepulsionRadiusPx,POINTER_REPULSION_PX } from './pointer-field';

it('keeps broad fluid support separate from the smaller illumination trail',()=>{
  expect(pointerRepulsionRadiusPx(580,634)).toBe(110);
  expect(POINTER_TRAIL_RADIUS_PX).toBe(48);
  expect(pointerRepulsionRadiusPx(580,634)).toBeGreaterThan(POINTER_TRAIL_RADIUS_PX*2);
  expect(pointerRepulsionRadiusPx(200,200)).toBe(40);
  expect(pointerRepulsionRadiusPx(-1,200)).toBe(0);
  expect(POINTER_REPULSION_PX).toBe(12);
});
