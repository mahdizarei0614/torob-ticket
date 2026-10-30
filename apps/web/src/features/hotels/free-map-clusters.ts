import type {MapPixel} from './free-map-label-layout';

export interface MapHotelAnchor {id:string;point:MapPixel}
export interface MapHotelGroup {key:string;ids:string[];point:MapPixel}
export const HOTEL_TARGET_SEPARATION=52;

const overlaps=(a:MapPixel,b:MapPixel)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))<HOTEL_TARGET_SEPARATION;
function group(members:MapHotelAnchor[]):MapHotelGroup {
 const ids=members.map(item=>item.id).sort();
 return {key:JSON.stringify(ids),ids,point:{x:members.reduce((sum,item)=>sum+item.point.x,0)/members.length,y:members.reduce((sum,item)=>sum+item.point.y,0)/members.length}};
}

/** Stable screen-space aggregates; never assigns a new position to a hotel. */
export function groupMapHotels(anchors:MapHotelAnchor[]):MapHotelGroup[] {
 const unique=new Map<string,MapHotelAnchor>();
 for(const anchor of anchors)if(!unique.has(anchor.id)&&Number.isFinite(anchor.point.x)&&Number.isFinite(anchor.point.y))unique.set(anchor.id,anchor);
 const members=[...unique.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(item=>[item]);
 // Merge original overlaps and then any overlapping aggregate targets. This
 // also handles chains and a singleton inside a large group's centroid.
 let changed=true;
 while(changed){
  changed=false;
  outer:for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
   const a=members[i]!,b=members[j]!;
   if(overlaps(group(a).point,group(b).point)||a.some(left=>b.some(right=>overlaps(left.point,right.point)))){
    a.push(...b);members.splice(j,1);changed=true;break outer;
   }
  }
 }
 return members.map(group).sort((a,b)=>a.key.localeCompare(b.key));
}

/** Zoom just far enough that the selected 44px target clears its neighbours. */
export function selectedHotelZoom(selected:MapPixel,others:MapPixel[],current:number):number {
 const nearest=Math.min(...others.map(point=>Math.max(Math.abs(selected.x-point.x),Math.abs(selected.y-point.y))));
 if(!Number.isFinite(nearest))return current;
 let zoom=nearest>=HOTEL_TARGET_SEPARATION?current:Math.min(20,current+(nearest>0?Math.log2((HOTEL_TARGET_SEPARATION+12)/nearest):20-current));
 // A large group's centroid can overlap an otherwise separated selected pin.
 // Check that aggregate geometry too, rather than only direct neighbours.
 while(zoom<20){
  const scale=2**(zoom-current),anchors=[{id:'selected',point:{x:0,y:0}},...others.map((point,index)=>({id:`other:${index}`,point:{x:(point.x-selected.x)*scale,y:(point.y-selected.y)*scale}}))];
  if(groupMapHotels(anchors).find(group=>group.ids.includes('selected'))?.ids.length===1)break;
  zoom=Math.min(20,zoom+.5);
 }
 return zoom;
}
