export interface MapPixel {x:number;y:number}
export interface MapTooltipPlacement {
 shift:MapPixel;
 side:'above'|'below';
 rect:{left:number;top:number;right:number;bottom:number};
}
const edge=8,pinTop=17,pinBottom=25;

/** Move only the inspected name; the hotel button stays on its geographic anchor. */
export function placeMapTooltip(anchor:MapPixel,label:{width:number;height:number},viewport:{width:number;height:number}):MapTooltipPlacement|undefined {
 if(![anchor.x,anchor.y,label.width,label.height,viewport.width,viewport.height].every(Number.isFinite)||label.width<=0||label.height<=0||viewport.width<=edge*2||viewport.height<=edge*2||anchor.x<0||anchor.x>viewport.width||anchor.y<0||anchor.y>viewport.height)return undefined;
 const width=Math.min(label.width,viewport.width-edge*2),height=Math.min(label.height,viewport.height-edge*2);
 const left=Math.max(edge,Math.min(viewport.width-edge-width,anchor.x-width/2));
 const naturalTop=anchor.y-pinTop-height,below=anchor.y+pinBottom;
 const top=naturalTop>=edge?naturalTop:below+height<=viewport.height-edge?below:Math.max(edge,Math.min(viewport.height-edge-height,naturalTop));
 return {shift:{x:left+width/2-anchor.x,y:top-naturalTop},side:top>=anchor.y?'below':'above',rect:{left,top,right:left+width,bottom:top+height}};
}
