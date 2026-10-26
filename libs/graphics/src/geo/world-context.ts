import type { GeoPoint } from '@torob-ticket/contracts';
import { ShapeUtils, Vector2 } from 'three';
import type { AreaGeometry } from './geography';
import { projectPoint, projectRoute, type ProjectionContext, type RouteBounds } from './projection';

export interface WorldCountry { geometry: AreaGeometry }
export interface ContextCity { id: string; name: string; point: GeoPoint; tier: 0 | 1 | 2 }
export interface WorldContext { countries: readonly WorldCountry[]; cities: readonly ContextCity[] }
export interface ContextLabel { id: string; x: number; y: number; left: number; top: number; width: number; height: number; opacity: number }
export interface LabelReservation { left: number; top: number; width: number; height: number }
const smooth = (low: number, high: number, value: number) => { const t=Math.min(1,Math.max(0,(value-low)/(high-low)));return t*t*(3-2*t); };

/** Shared edges are drawn once, and every ring is split at the current projection seam. */
export function worldBorderPositions(countries: readonly WorldCountry[], context: ProjectionContext): number[] {
  const result: number[]=[];const seen=new Set<string>();
  for(const {geometry} of countries){
    const polygons=geometry.type==='Polygon'?[geometry.coordinates as number[][][]]:geometry.coordinates as number[][][][];
    for(const polygon of polygons)for(const ring of polygon){
      for(let i=1;i<ring.length;i++){
        const a=ring[i-1]!,b=ring[i]!;
        const ka=a.join(','),kb=b.join(',');const key=ka<kb?`${ka}:${kb}`:`${kb}:${ka}`;
        if(seen.has(key))continue;seen.add(key);
        const paths=projectRoute([{longitude:a[0]!,latitude:a[1]!},{longitude:b[0]!,latitude:b[1]!}],context);
        for(const path of paths)for(let j=1;j<path.length;j++)result.push(...path[j-1]!,...path[j]!);
      }
    }
  }
  return result;
}

/** Four stable geographic lattices; three short crossfades as dots grow on screen. */
export const INTERNATIONAL_DOT_BASE_SPACING=4;
export const DOMESTIC_DOT_BASE_SPACING=.44;
export const DOT_DENSITY_FADE_START_PX=24;
export const DOT_DENSITY_FADE_END_PX=40;
export function worldDotWeights(unitsPerPixel:number,baseSpacing=INTERNATIONAL_DOT_BASE_SPACING,refinement=4):[number,number,number,number]{
  const unit=Math.max(.000001,unitsPerPixel);
  const a=smooth(DOT_DENSITY_FADE_START_PX,DOT_DENSITY_FADE_END_PX,baseSpacing/unit),b=smooth(DOT_DENSITY_FADE_START_PX,DOT_DENSITY_FADE_END_PX,baseSpacing/refinement/unit),c=smooth(DOT_DENSITY_FADE_START_PX,DOT_DENSITY_FADE_END_PX,baseSpacing/refinement**2/unit);
  return [1-a,a*(1-b),b*(1-c),c];
}

function clipVertical(points:readonly [number,number][],edge:number,keepGreater:boolean):[number,number][]{
  const output:[number,number][]=[];
  for(let i=0;i<points.length;i++){
    const a=points[(i+points.length-1)%points.length]!,b=points[i]!;
    const insideA=keepGreater?a[0]>=edge:a[0]<=edge,insideB=keepGreater?b[0]>=edge:b[0]<=edge;
    if(insideA!==insideB){const t=(edge-a[0])/(b[0]-a[0]);output.push([edge,a[1]+t*(b[1]-a[1])]);}
    if(insideB)output.push(b);
  }
  return output;
}
/** Triangulate original land and holes, then clip wrapped triangles at the projection seam. */
export function worldLandPositions(countries:readonly WorldCountry[],context:ProjectionContext):number[]{
  const result:number[]=[];
  for(const {geometry} of countries){
    const polygons=geometry.type==='Polygon'?[geometry.coordinates as number[][][]]:geometry.coordinates as number[][][][];
    for(const rings of polygons){
      const contour=rings[0]!.map(p=>new Vector2(p[0]!,p[1]!));const holes=rings.slice(1).map(ring=>ring.map(p=>new Vector2(p[0]!,p[1]!)));
      const triangles=ShapeUtils.triangulateShape(contour,holes);const points=[...contour,...holes.flat()];
      for(const triangle of triangles)for(const shift of [-360,0,360]){
        const raw=triangle.map(index=>[points[index]!.x-context.centralLongitude+shift,points[index]!.y] as [number,number]);
        if(raw.every(p=>p[0]<-180)||raw.every(p=>p[0]>180))continue;
        const polygon=clipVertical(clipVertical(raw,-180,true),180,false);
        for(let i=1;i<polygon.length-1;i++)for(const point of [polygon[0]!,polygon[i]!,polygon[i+1]!])result.push(point[0],point[1],0);
      }
    }
  }
  return result;
}

const collides=(a:LabelReservation,b:LabelReservation,gap=14)=>a.left<b.left+b.width+gap && a.left+a.width+gap>b.left && a.top<b.top+b.height+gap && a.top+a.height+gap>b.top;
/** Context has a strict density budget and always yields to selected journey facts. */
export function contextCityLabels(cities:readonly ContextCity[],frame:RouteBounds,dimensions:{width:number;height:number},context:ProjectionContext,reserved:readonly LabelReservation[]=[],excluded:ReadonlySet<string>=new Set()):ContextLabel[]{
  const zoom=Math.log2(360/Math.max(.001,frame.width));
  const budget=zoom<1?6:zoom<3?8:10;
  const result:ContextLabel[]=[];const occupied=[...reserved];
  for(const city of [...cities].sort((a,b)=>a.tier-b.tier||a.id.localeCompare(b.id))){
    if(excluded.has(city.id)||excluded.has(city.name))continue;
    const opacity=smooth([-.6,.8,2.4][city.tier]!-.3,[-.6,.8,2.4][city.tier]!+.45,zoom)*.65;
    if(opacity<=.01)continue;
    const projected=projectPoint(city.point,context);const x=dimensions.width*(.5+(projected[0]-frame.x)/frame.width),y=dimensions.height*(.5-(projected[1]-frame.y)/frame.height);
    const width=Math.min(100,Math.max(34,city.name.length*6.4+12)),height=22;
    const edge=smooth(10,38,Math.min(x-width/2,dimensions.width-x-width/2,y-16,dimensions.height-y-16));
    if(edge<=.01)continue;
    const candidates=[{left:x-width/2,top:y+7,width,height},{left:x-width/2,top:y-height-7,width,height}];
    const candidate=candidates.find(item=>!occupied.some(other=>collides(item,other)));
    if(!candidate)continue;
    result.push({id:city.id,x,y,...candidate,opacity:opacity*edge});occupied.push(candidate);
    if(result.length>=budget)break;
  }
  return result;
}
