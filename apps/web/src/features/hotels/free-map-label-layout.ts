export interface MapPixel {x:number;y:number}
export interface MapLabelRect {left:number;top:number;right:number;bottom:number}
export interface MapLabelInput {
 id:string;anchor:MapPixel;width:number;height:number;priority:number;
 previous?:MapPixel;collapsed?:boolean;locked?:boolean;
}
export interface MapLabelPlacement {id:string;center:MapPixel;rect:MapLabelRect;collapsed:boolean;labelShift?:MapPixel}
const gutter=5,edge=8,pinSize=44;
function overlap(a:MapLabelRect,b:MapLabelRect){return Math.max(0,Math.min(a.right,b.right)+gutter-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)+gutter-Math.max(a.top,b.top));}
function distance(a:MapPixel,b:MapPixel){return (a.x-b.x)**2+(a.y-b.y)**2;}
function rectangle(center:MapPixel,width:number,height:number):MapLabelRect{return {left:center.x-width/2,right:center.x+width/2,top:center.y-height+pinSize/2,bottom:center.y+pinSize/2};}

/** Bounded screen-space labels; the native marker's geographic point never moves. */
export function layoutMapLabels(items:MapLabelInput[],viewport:{width:number;height:number},obstacles:MapLabelRect[]=[]):MapLabelPlacement[]{
 const usable={left:edge,top:edge,right:viewport.width-edge,bottom:viewport.height-24};
 if(usable.right<=usable.left||usable.bottom<=usable.top)return [];
 const visible=items.filter(item=>item.anchor.x>=0&&item.anchor.x<=viewport.width&&item.anchor.y>=0&&item.anchor.y<=viewport.height)
  .sort((a,b)=>Number(Boolean(b.locked))-Number(Boolean(a.locked))||b.priority-a.priority||a.id.localeCompare(b.id));
 function lockedShape(item:MapLabelInput,center:MapPixel,occupied:MapLabelRect[]){
  const width=Math.min(item.width,usable.right-usable.left),labelHeight=item.height-39;
  const x=Math.max(usable.left+width/2,Math.min(usable.right-width/2,center.x))-center.x;
  const originalTop=center.y-17-labelHeight;
  const candidates=[0,item.height,Math.max(usable.top,Math.min(usable.bottom-labelHeight,originalTop))-originalTop];
  let chosen:{rect:MapLabelRect;labelShift:MapPixel}|undefined,score=Infinity;
  for(const y of candidates){
   const rect={left:Math.min(center.x-22,center.x-width/2+x),right:Math.max(center.x+22,center.x+width/2+x),top:Math.min(center.y-22,originalTop+y),bottom:Math.max(center.y+22,originalTop+y+labelHeight)};
   const outside=Math.max(0,usable.top-rect.top)+Math.max(0,rect.bottom-usable.bottom);
   const next=outside*1e12+occupied.reduce((sum,other)=>sum+overlap(rect,other),0)*1e8+Math.abs(y);
   if(next<score){chosen={rect,labelShift:{x,y}};score=next;}
  }
  return chosen!;
 }
 if(visible.length&&visible.every(item=>item.previous)){
  const occupied=[...obstacles],retained:MapLabelPlacement[]=[];
  for(const item of visible){
   const collapsed=item.collapsed===true&&item.priority===0,center={x:item.anchor.x+item.previous!.x,y:item.anchor.y+item.previous!.y};
   const shape=item.locked&&!collapsed?lockedShape(item,center,occupied):undefined;
   const rect=shape?.rect??rectangle(center,collapsed?pinSize:item.width,collapsed?pinSize:item.height);
   if(rect.left<usable.left||rect.top<usable.top||rect.right>usable.right||rect.bottom>usable.bottom||occupied.some(other=>overlap(rect,other)>0))break;
   retained.push({id:item.id,center,rect,collapsed,labelShift:shape?.labelShift});occupied.push(rect);
  }
  // Most pan frames need only this small collision pass, not another grid search.
  if(retained.length===visible.length)return retained;
 }
 function place(compact:boolean){
  const occupied=[...obstacles],result:MapLabelPlacement[]=[];let collision=0;
  const rowHeight=Math.max(...visible.map(item=>item.height)),rowCount=Math.max(1,Math.floor((usable.bottom-usable.top+gutter)/(rowHeight+gutter)));
  const rows=!compact&&visible.length>4?Array.from({length:rowCount},(_,index)=>usable.top+rowHeight-pinSize/2+(rowCount===1?0:(usable.bottom-usable.top-rowHeight)*index/(rowCount-1))):undefined;
  for(const item of visible){
   const collapsed=compact&&item.priority===0;
   if(item.locked&&item.previous){
    const center={x:item.anchor.x+item.previous.x,y:item.anchor.y+item.previous.y},shape=lockedShape(item,center,occupied);
    collision+=occupied.reduce((sum,other)=>sum+overlap(shape.rect,other),0);occupied.push(shape.rect);result.push({id:item.id,center,rect:shape.rect,collapsed:false,labelShift:shape.labelShift});continue;
   }
   const width=Math.min(collapsed?pinSize:item.width,usable.right-usable.left),height=Math.min(collapsed?pinSize:item.height,usable.bottom-usable.top);
   const clamp=(candidate:MapPixel):MapPixel=>({x:Math.max(usable.left+width/2,Math.min(usable.right-width/2,candidate.x)),y:rows?rows.reduce((best,row)=>Math.abs(row-candidate.y)<Math.abs(best-candidate.y)?row:best,rows[0]!):Math.max(usable.top+height-pinSize/2,Math.min(usable.bottom-pinSize/2,candidate.y))});
   const previous=item.previous?{x:item.anchor.x+item.previous.x,y:item.anchor.y+item.previous.y}:item.anchor;
   const candidates=[clamp(previous),clamp(item.anchor)];
   // A small complete viewport grid avoids trapping later labels around coincident points.
   const columns=Math.max(1,Math.ceil((usable.right-usable.left-width)/28)),gridRows=Math.max(1,Math.ceil((usable.bottom-usable.top-height)/20));
   for(let row=0;row<=gridRows;row++)for(let column=0;column<=columns;column++)candidates.push(clamp({x:usable.left+width/2+(usable.right-usable.left-width)*column/columns,y:usable.top+height-pinSize/2+(usable.bottom-usable.top-height)*row/gridRows}));
   let best=candidates[0]!,bestScore=Infinity,bestOverlap=0;
   for(const candidate of candidates){
    const rect=rectangle(candidate,width,height),crossing=occupied.reduce((sum,other)=>sum+overlap(rect,other),0);
    const score=crossing*1e8+distance(candidate,item.anchor)+distance(candidate,previous)*.18;
    if(score<bestScore){best=candidate;bestScore=score;bestOverlap=crossing;}
   }
   const rect=rectangle(best,width,height);occupied.push(rect);collision+=bestOverlap;result.push({id:item.id,center:best,rect,collapsed});
  }
  return {result,collision};
 }
 const named=place(false);
 // A narrow/short viewport cannot physically contain every full name. Keep the
 // selected/hovered/focused names; other named buttons reveal their name on focus.
 return named.collision===0?named.result:place(true).result;
}
