/** Viewport coordinates shared by fixed canvas clipping and per-view admission. */
export function visibleClipRect(element:HTMLElement){
 const box=element.getBoundingClientRect();let left=Math.max(0,box.left),top=Math.max(0,box.top),right=Math.min(innerWidth,box.right),bottom=Math.min(innerHeight,box.bottom);
 for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);const clipX=/(auto|scroll|hidden|clip)/.test(style.overflowX||style.overflow),clipY=/(auto|scroll|hidden|clip)/.test(style.overflowY||style.overflow);if(!clipX&&!clipY)continue;const r=parent.getBoundingClientRect();if(clipX){left=Math.max(left,r.left);right=Math.min(right,r.right);}if(clipY){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}}
 const dialog=element.closest('[role=dialog],dialog');for(const header of dialog?.querySelectorAll<HTMLElement>('[data-graphics-occluder]')??[]){const r=header.getBoundingClientRect();if(r.right>left&&r.left<right&&r.top<=top&&r.bottom>top)top=Math.min(bottom,r.bottom);}
 return {left,top,right:Math.max(left,right),bottom:Math.max(top,bottom),width:Math.max(0,right-left),height:Math.max(0,bottom-top)};
}
/** Portal target identity never changes: only the target's physical parent moves. */
export function createForegroundHost(host:HTMLElement,home:()=>HTMLElement|null,onChange?:(active:boolean)=>void){
 let owner:object|undefined,stop:(()=>void)|undefined;
 function restore(){if(owner)return;delete host.dataset['graphicsForeground'];delete host.dataset['graphicsClip'];host.style.clipPath='';const root=home();if(root&&host.parentElement!==root)root.append(host);}
 function claim(target:HTMLElement){
  const lease={};owner=lease;stop?.();target.append(host);host.dataset['graphicsForeground']='true';
  const measure=()=>{if(owner!==lease)return;const r=visibleClipRect(target);host.style.clipPath=`inset(${r.top}px ${Math.max(0,innerWidth-r.right)}px ${Math.max(0,innerHeight-r.bottom)}px ${r.left}px)`;host.dataset['graphicsClip']=JSON.stringify(r);};
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):undefined;for(let node:HTMLElement|null=target;node;node=node.parentElement)observer?.observe(node);
  window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);measure();onChange?.(true);
  const cleanup=()=>{observer?.disconnect();window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};stop=cleanup;
  return()=>{if(owner!==lease)return;cleanup();stop=undefined;owner=undefined;restore();onChange?.(false);};
 }
 function close(){stop?.();stop=undefined;owner=undefined;host.remove();delete host.dataset['graphicsForeground'];delete host.dataset['graphicsClip'];host.style.clipPath='';onChange?.(false);}
 return {claim,restore,close};
}
export function admitsView(layer:'background'|'foreground'|undefined,covered:boolean,foreground:boolean){return foreground?layer==='foreground':!covered&&layer!=='foreground';}
