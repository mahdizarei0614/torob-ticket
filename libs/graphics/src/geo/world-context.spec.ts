import { describe, expect, it } from 'vitest';
import { contextCityLabels, DOMESTIC_DOT_BASE_SPACING, INTERNATIONAL_DOT_BASE_SPACING, worldDotWeights, worldLandPositions, worldBorderPositions, type ContextCity, type WorldCountry } from './world-context';

const country:WorldCountry={geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]}};
const context={centralLongitude:0};
describe('international map context',()=>{
  it('splits borders at the projection seam and deduplicates shared country edges',()=>{
    const left:WorldCountry={geometry:{type:'Polygon',coordinates:[[[179,0],[-179,0],[-179,3],[179,3],[179,0]]]}};
    const positions=worldBorderPositions([left,left],context);
    expect(positions.length).toBe(worldBorderPositions([left],context).length);
    for(let i=0;i<positions.length;i+=6)expect(Math.abs(positions[i+3]!-positions[i]!)).toBeLessThanOrEqual(180);
    expect(positions).toContain(-180);expect(positions).toContain(180);
  });
  it('preserves polygon holes and land area while clipping projected triangles at the seam',()=>{
    const vertices=worldLandPositions([country],{centralLongitude:-175});
    let area=0;
    for(let i=0;i<vertices.length;i+=9){
      const ax=vertices[i]!,ay=vertices[i+1]!,bx=vertices[i+3]!,by=vertices[i+4]!,cx=vertices[i+6]!,cy=vertices[i+7]!;
      expect(Math.max(ax,bx,cx)-Math.min(ax,bx,cx)).toBeLessThanOrEqual(10);
      expect(Math.min(ax,bx,cx)).toBeGreaterThanOrEqual(-180);expect(Math.max(ax,bx,cx)).toBeLessThanOrEqual(180);
      area+=Math.abs((bx-ax)*(cy-ay)-(cx-ax)*(by-ay))/2;
    }
    expect(area).toBeCloseTo(96);expect(vertices).toContain(-180);expect(vertices).toContain(180);
  });
  it.each([{base:INTERNATIONAL_DOT_BASE_SPACING,ratio:4},{base:DOMESTIC_DOT_BASE_SPACING,ratio:2}])('crossfades through three successive densities without additive opacity for base %j',({base,ratio})=>{
    expect(worldDotWeights(base/4,base,ratio)).toEqual([1,0,0,0]);
    for(let level=0;level<3;level++){
      const spacing=base/ratio**level;
      const during=worldDotWeights(spacing/32,base,ratio);
      expect(during[level]).toBeCloseTo(.5);expect(during[level+1]).toBeCloseTo(.5);
      expect(during.reduce((sum,value)=>sum+value,0)).toBeCloseTo(1);
      const after=worldDotWeights(spacing/44,base,ratio);expect(after[level]).toBe(0);expect(after[level+1]).toBe(1);
    }
    expect(worldDotWeights(base/800,base,ratio)).toEqual([0,0,0,1]);
  });
  it('fades local cities through zoom and never displays an unbounded label cloud',()=>{
    const city:ContextCity={id:'local',name:'شهر',point:{longitude:0,latitude:0},tier:2};
    const dimensions={width:800,height:600};
    expect(contextCityLabels([city],{x:0,y:0,width:360,height:180},dimensions,context)).toHaveLength(0);
    const transitional=contextCityLabels([city],{x:0,y:0,width:360/2**2.4,height:50},dimensions,context)[0]!;
    const close=contextCityLabels([city],{x:0,y:0,width:20,height:15},dimensions,context)[0]!;
    expect(transitional.opacity).toBeGreaterThan(0);expect(transitional.opacity).toBeLessThan(close.opacity);
    const many=Array.from({length:100},(_,i):ContextCity=>({id:String(i),name:'شهر',point:{longitude:(i%10-5)*2,latitude:(Math.floor(i/10)-5)*1.2},tier:0}));
    expect(contextCityLabels(many,{x:0,y:0,width:25,height:20},dimensions,context).length).toBeLessThanOrEqual(10);
  });
  it('gives journey annotations priority, hides excluded endpoints and avoids collisions',()=>{
    const cities:ContextCity[]=[{id:'selected',name:'تهران',point:{longitude:0,latitude:0},tier:0},{id:'nearby',name:'همسایه',point:{longitude:.1,latitude:.1},tier:0},{id:'distant',name:'دیگر',point:{longitude:7,latitude:3},tier:1}];
    const reserved=[{left:300,top:200,width:200,height:200}];
    const selected=contextCityLabels(cities,{x:0,y:0,width:20,height:15},{width:800,height:600},context,reserved,new Set(['selected']));
    expect(selected.map(city=>city.id)).toEqual(['distant']);
    expect(contextCityLabels([{...cities[2]!,point:{longitude:10,latitude:7.5}}],{x:0,y:0,width:20,height:15},{width:800,height:600},context)).toEqual([]);
  });
  it('keeps world labels sparse and deterministic regardless of source order',()=>{
    const cities:ContextCity[]=Array.from({length:20},(_,i)=>({id:`city-${i}`,name:'پایتخت',tier:0,point:{longitude:(i%5-2)*60,latitude:(Math.floor(i/5)-1.5)*35}}));
    const frame={x:0,y:0,width:360,height:180},size={width:900,height:600};
    const labels=contextCityLabels(cities,frame,size,context);
    expect(labels.length).toBeLessThanOrEqual(6);expect(labels.length).toBeGreaterThan(0);
    expect(contextCityLabels([...cities].reverse(),frame,size,context)).toEqual(labels);
  });
});

import { worldBoundaryPositions, type WorldBoundary } from './world-context';
it('deduplicates province linework and splits it at the projection seam without turning it into selectable land',()=>{
 const boundaries:WorldBoundary[]=[{geometry:{type:'MultiLineString',coordinates:[[[45,30],[50,32],[60,38]],[[50,32],[53,27]]]}}];
 const positions=worldBoundaryPositions(boundaries,{centralLongitude:0});
 expect(positions.length).toBe(18);
 expect(worldBoundaryPositions([...boundaries,...boundaries],{centralLongitude:0})).toEqual(positions);
 const split=worldBoundaryPositions(boundaries,{centralLongitude:-125});
 for(let i=0;i<split.length;i+=6)expect(Math.abs(split[i+3]!-split[i]!)).toBeLessThanOrEqual(180);
 expect(split).toContain(-180);expect(split).toContain(180);
});
