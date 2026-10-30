import {describe,expect,it} from 'vitest';
import {placeMapTooltip} from './free-map-label-layout';
const bounded=(value:ReturnType<typeof placeMapTooltip>,width:number,height:number)=>{
 expect(value).toBeDefined();if(!value)return;
 expect(value.rect.left).toBeGreaterThanOrEqual(8);expect(value.rect.right).toBeLessThanOrEqual(width-8);expect(value.rect.top).toBeGreaterThanOrEqual(8);expect(value.rect.bottom).toBeLessThanOrEqual(height-8);
};
describe('one inspected map name without relocating its hotel',()=>{
 it('uses the space above an interior geographic anchor without a lateral shift',()=>{
  const anchor={x:180,y:150},before={...anchor},placed=placeMapTooltip(anchor,{width:140,height:28},{width:360,height:230});
  expect(placed).toEqual({shift:{x:0,y:0},side:'above',rect:{left:110,top:105,right:250,bottom:133}});expect(anchor).toEqual(before);
 });
 it('clamps only the text at both side edges and flips below a pin near the top',()=>{
  for(const x of [2,358]){const placed=placeMapTooltip({x,y:10},{width:180,height:44},{width:360,height:230});bounded(placed,360,230);expect(placed?.side).toBe('below');expect(placed?.rect.top).toBe(35);expect(Math.abs(placed!.shift.x)).toBeGreaterThan(0);}
 });
 it('bounds a long name inside a very short or narrow map without moving a genuinely offscreen anchor into it',()=>{
  bounded(placeMapTooltip({x:30,y:42},{width:300,height:140},{width:90,height:80}),90,80);
  for(const anchor of [{x:-1,y:60},{x:361,y:60},{x:50,y:-1},{x:50,y:231},{x:NaN,y:10}])expect(placeMapTooltip(anchor,{width:120,height:30},{width:360,height:230})).toBeUndefined();
  expect(placeMapTooltip({x:2,y:2},{width:30,height:20},{width:10,height:10})).toBeUndefined();
 });
});
