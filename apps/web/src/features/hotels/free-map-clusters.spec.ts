import {describe,it,expect} from 'vitest';
import {groupMapHotels,selectedHotelZoom,HOTEL_TARGET_SEPARATION} from './free-map-clusters';

describe('true-anchor hotel aggregates',()=>{
 it('groups overlapping 44px targets and keeps separated hotels single, independent of sort order',()=>{
  const anchors=[{id:'b',point:{x:115,y:110}},{id:'c',point:{x:300,y:200}},{id:'a',point:{x:100,y:100}}],copy=structuredClone(anchors);
  expect(groupMapHotels(anchors)).toEqual([{key:'["a","b"]',ids:['a','b'],point:{x:107.5,y:105}},{key:'["c"]',ids:['c'],point:{x:300,y:200}}]);
  expect(groupMapHotels([...anchors].reverse())).toEqual(groupMapHotels(anchors));expect(anchors).toEqual(copy);
 });
 it('merges chains and overlapping aggregate centroids instead of creating a second overlapping target',()=>{
  const anchors=[{id:'a',point:{x:0,y:0}},{id:'b',point:{x:50,y:0}},{id:'c',point:{x:100,y:0}},{id:'d',point:{x:50,y:53}}];
  const groups=groupMapHotels(anchors);expect(groups.map(item=>item.ids)).toEqual([['a','b','c'],['d']]);
  expect(groupMapHotels(anchors.map(item=>item.id==='d'?{...item,point:{x:50,y:51}}:item))).toHaveLength(1);
  const ring=[{id:'a',point:{x:0,y:0}},{id:'b',point:{x:50,y:0}},{id:'c',point:{x:100,y:0}},{id:'d',point:{x:100,y:50}},{id:'e',point:{x:100,y:100}},{id:'f',point:{x:50,y:100}},{id:'g',point:{x:0,y:100}},{id:'h',point:{x:0,y:50}},{id:'i',point:{x:50,y:50}}];
  expect(groupMapHotels(ring)).toHaveLength(1);
 });
 it('uses a fixed screen threshold as zoom separates actual positions, without changing the positions',()=>{
  const initial=[{id:'a',point:{x:100,y:100}},{id:'b',point:{x:120,y:110}}];
  expect(groupMapHotels(initial)).toHaveLength(1);
  const zoomed=initial.map(item=>({id:item.id,point:{x:100+(item.point.x-100)*3,y:100+(item.point.y-100)*3}}));
  expect(groupMapHotels(zoomed).map(item=>item.ids)).toEqual([['a'],['b']]);
  expect(groupMapHotels([{id:'a',point:{x:0,y:0}},{id:'b',point:{x:HOTEL_TARGET_SEPARATION,y:0}}])).toHaveLength(2);
  expect(groupMapHotels([{id:'bad',point:{x:NaN,y:0}},{id:'a',point:{x:0,y:0}},{id:'a',point:{x:0,y:0}}])).toHaveLength(1);
 });
 it('computes bounded selection zoom from nearest screen separation and handles coincident points',()=>{
  expect(selectedHotelZoom({x:100,y:100},[{x:116,y:105},{x:230,y:150}],12)).toBe(14);
  expect(selectedHotelZoom({x:100,y:100},[{x:164,y:100}],12)).toBe(12);
  expect(selectedHotelZoom({x:100,y:100},[],12)).toBe(12);
  expect(selectedHotelZoom({x:100,y:100},[{x:100,y:100}],12)).toBe(20);
  expect(selectedHotelZoom({x:100,y:100},[{x:101,y:100}],19)).toBe(20);
  const ring=Array.from({length:16},(_,index)=>({x:Math.cos(index*Math.PI/8)*100,y:Math.sin(index*Math.PI/8)*100}));
  expect(selectedHotelZoom({x:0,y:0},ring,12)).toBeGreaterThan(12);
 });
});
