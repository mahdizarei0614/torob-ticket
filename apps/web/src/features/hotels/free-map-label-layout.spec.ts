import {describe,expect,it} from 'vitest';
import {layoutMapLabels,type MapLabelInput,type MapLabelRect} from './free-map-label-layout';
const choices=(count:number):MapLabelInput[]=>Array.from({length:count},(_,index)=>({id:`hotel-${String(index).padStart(2,'0')}`,anchor:{x:450+(index%2),y:80+(index%3)},width:130,height:62,priority:index===0?2:0}));
const intersects=(a:MapLabelRect,b:MapLabelRect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
function expectBoundedDistinct(labels:ReturnType<typeof layoutMapLabels>,width:number,height:number){
 for(const [index,label]of labels.entries()){
  expect(label.rect.left).toBeGreaterThanOrEqual(8);expect(label.rect.top).toBeGreaterThanOrEqual(8);expect(label.rect.right).toBeLessThanOrEqual(width-8);expect(label.rect.bottom).toBeLessThanOrEqual(height-24);
  expect(labels.slice(index+1).some(other=>intersects(label.rect,other.rect))).toBe(false);
 }
}
describe('hotel label placement without geographic displacement',()=>{
 it('keeps all fourteen coincident hotel names separate in the pilot desktop viewport while reserving the static hub and controls',()=>{
  const hotels=choices(14),obstacles=[{left:8,top:8,right:52,bottom:82},{left:550,top:128,right:730,bottom:192}],before=structuredClone(hotels);
  const placed=layoutMapLabels(hotels,{width:1035,height:230},obstacles);
  expect(placed).toHaveLength(14);expect(placed.every(label=>!label.collapsed)).toBe(true);expectBoundedDistinct(placed,1035,230);
  expect(placed.some(label=>obstacles.some(obstacle=>intersects(label.rect,obstacle)))).toBe(false);expect(hotels).toEqual(before);
 });
 it('keeps the selected and focused names readable in a small viewport and reveals the newly focused name without losing stable IDs',()=>{
  const hotels=choices(14).map(item=>({...item,anchor:{x:180,y:100}}));hotels[1]!.priority=3;
  const placed=layoutMapLabels(hotels,{width:360,height:250},[{left:8,top:8,right:52,bottom:82}]);
  expect(placed).toHaveLength(14);expect(placed.find(label=>label.id==='hotel-00')?.collapsed).toBe(false);expect(placed.find(label=>label.id==='hotel-01')?.collapsed).toBe(false);expect(placed.some(label=>label.collapsed)).toBe(true);expectBoundedDistinct(placed,360,250);
  const changed=layoutMapLabels(hotels.map(item=>({...item,priority:item.id==='hotel-13'?3:item.id==='hotel-00'?2:0})).reverse(),{width:360,height:250});
  expect(changed.find(label=>label.id==='hotel-13')?.collapsed).toBe(false);expect(changed.map(label=>label.id).sort()).toEqual(placed.map(label=>label.id).sort());
 });
 it('uses the current viewport, preserves harmless previous offsets, and leaves genuinely offscreen hotels offscreen',()=>{
  const items=[{id:'h',anchor:{x:120,y:100},width:100,height:62,priority:0,previous:{x:0,y:0}},{id:'outside',anchor:{x:-50,y:100},width:100,height:62,priority:0}];
  const initial=layoutMapLabels(items,{width:500,height:230});expect(initial).toHaveLength(1);expect(initial[0]?.center).toEqual({x:120,y:100});
  const resized=layoutMapLabels([{...items[0]!,anchor:{x:190,y:100}}],{width:210,height:170});expectBoundedDistinct(resized,210,170);expect(resized[0]?.center.x).toBeLessThan(160);
 });
 it('locks an interacted compact pin in place and tucks its expanded name into the viewport instead of chasing the pointer',()=>{
  const hotels=choices(14).map(item=>({...item,anchor:{x:180,y:100}})),viewport={width:360,height:250};
  const initial=layoutMapLabels(hotels,viewport),target=initial.find(label=>label.collapsed)!;
  const expanded=layoutMapLabels(hotels.map(item=>{const previous=initial.find(label=>label.id===item.id)!;return {...item,previous:{x:previous.center.x-item.anchor.x,y:previous.center.y-item.anchor.y},collapsed:previous.collapsed,priority:item.id===target.id?3:item.priority,locked:item.id===target.id};}),viewport);
  expect(expanded.find(label=>label.id===target.id)?.center).toEqual(target.center);expect(expanded.find(label=>label.id===target.id)?.collapsed).toBe(false);expectBoundedDistinct(expanded,360,250);
 });
});
