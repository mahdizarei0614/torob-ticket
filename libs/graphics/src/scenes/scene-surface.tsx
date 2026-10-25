import { useEffect, useLayoutEffect, useRef, useState, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGraphics } from '../graphics-provider';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera } from 'three';
import type { GeoPoint } from '@torob-ticket/contracts';
import { GraphicsView } from '../graphics-view';
import { projectPoint, unprojectPoint, type ProjectionContext, type RouteBounds } from '../geo/projection';
import styles from './scenes.module.css';
export interface SceneMarker { id: string; name: string; point: GeoPoint; kind?: 'landmark' | 'accommodation' | 'custom' | 'place' | 'city'; cityId?:string; enabled?:boolean; role?:'origin'|'destination'|'network'; selectable?:boolean; showLabel?:boolean }
export interface CameraIntent extends RouteBounds { zoom: number }
export function useCameraIntent(bounds: RouteBounds, fitKey: string, originKey: string, initialCamera?:CameraIntent) {
  const [camera, setCamera] = useState<CameraIntent>(() => initialCamera ? {...initialCamera} : ({ ...bounds, zoom: 1 }));
  const fitted = useRef({ fitKey, originKey });
  useLayoutEffect(() => {
    if (fitted.current.fitKey !== fitKey || fitted.current.originKey !== originKey) {
      fitted.current = { fitKey, originKey }; setCamera({ ...bounds, zoom: 1 });
    }
  }, [bounds, fitKey, originKey]);
  return [camera, setCamera] as const;
}
export function frameForAspect(camera: CameraIntent, aspect: number): RouteBounds {
  const width = Math.max(camera.width, camera.height * aspect) / camera.zoom;
  return { x: camera.x, y: camera.y, width, height: width / aspect };
}
export function SceneCamera({ frame }: { frame: RouteBounds }) {
  const get = useThree(state => state.get); const set = useThree(state => state.set);
  const [camera] = useState(() => Object.assign(new OrthographicCamera(-1, 1, 1, -1, .1, 1000), { manual: true }));
  useLayoutEffect(() => {
    camera.left = -frame.width / 2; camera.right = frame.width / 2; camera.top = frame.height / 2; camera.bottom = -frame.height / 2;
    camera.position.set(frame.x, frame.y, 200); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }, [camera, frame]);
  useLayoutEffect(() => { const previous = get().camera; set({ camera }); return () => set({ camera: previous }); }, [get, set, camera]);
  return null;
}
export function SceneSurface({ label, camera, setZoom, context, markers, onMarkerSelect, onPointChange, children, fallback, onFrame, isCurrent = () => true, markerSelectLabel,portalLabels=false,labelsVisible=true }: {
  label: string; camera: CameraIntent; setZoom: (zoom: number) => void; context: ProjectionContext; markers: readonly SceneMarker[];
  onMarkerSelect?: (id: string) => void; onPointChange?: (point: GeoPoint) => void;
  children: (frame: RouteBounds) => ReactNode; fallback: (frame: RouteBounds) => ReactNode; onFrame?: (frame: RouteBounds) => void; isCurrent?:()=>boolean; markerSelectLabel?:string;portalLabels?:boolean;labelsVisible?:boolean;
}) {
  const {labelLayer}=useGraphics();const labelId=useId();
  const [rect,setRect]=useState({left:0,top:0,width:0,height:0});
  const viewport = useRef<HTMLDivElement>(null); const [dimensions, setDimensions] = useState({ width: 560, height: 400 });
  const pointers = useRef(new Map<number, { x: number; y: number }>()); const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const gesture = useRef(false);
  useLayoutEffect(()=>{
    const element=viewport.current!;
    const measure=()=>{const box=element.getBoundingClientRect();if(box.width&&box.height){setDimensions(previous=>previous.width===box.width&&previous.height===box.height?previous:{width:box.width,height:box.height});if(portalLabels)setRect(previous=>previous.left===box.left&&previous.top===box.top&&previous.width===box.width&&previous.height===box.height?previous:{left:box.left,top:box.top,width:box.width,height:box.height});}};
    const observer=new ResizeObserver(measure);observer.observe(element);measure();
    if(portalLabels){window.addEventListener('scroll',measure,{capture:true,passive:true});window.addEventListener('resize',measure,{passive:true});}
    return()=>{observer.disconnect();window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};
  },[portalLabels]);
  const frame = frameForAspect(camera, dimensions.width / dimensions.height);
  useEffect(() => { onFrame?.(frame); }, [frame.x, frame.y, frame.width, frame.height, onFrame]);
  const position = (point: GeoPoint) => { const projected = projectPoint(point, context); return { left: `${50 + (projected[0] - frame.x) / frame.width * 100}%`, top: `${50 - (projected[1] - frame.y) / frame.height * 100}%` }; };
  // Preserve actual marker anchors; spread clustered local labels with DOM leader lines.
  const anchor = (point: GeoPoint) => { const p = projectPoint(point, context); return { x: dimensions.width * (.5 + (p[0] - frame.x) / frame.width), y: dimensions.height * (.5 - (p[1] - frame.y) / frame.height) }; };
  const occupied:{left:number;top:number;width:number;height:number}[] = markers.filter(marker => marker.kind === 'custom').map(marker => { const p = anchor(marker.point); return { left: p.x - 72, top: p.y - 65,width:144,height:54 }; });
  const labelOffsets = new Map<string, { dx: number; dy: number; x: number; y: number; left: number; top: number; width:number;height:number }>();
  for (const marker of markers.filter(marker => marker.kind === 'landmark' || marker.kind === 'accommodation' || marker.kind === 'city')) {
    const p = anchor(marker.point); if (p.x < 0 || p.y < 0 || p.x > dimensions.width || p.y > dimensions.height) continue;
    const width=marker.kind==='city'?112:144,height=marker.kind==='city'?36:54;
    const baseLeft = p.x-width/2, baseTop = p.y-height*1.2;
    let chosen = { left: baseLeft, top: baseTop }; let found = false;
    for (const column of [0, -1, 1,-2,2]) {
      for (const row of [0,1,-1,2,-2,3,-3,4,-4,5,-5]) {
        const candidate = { left: Math.max(4, Math.min(dimensions.width-width-4, baseLeft+column*(width+6))), top: Math.max(4, Math.min(dimensions.height-height-4, baseTop+row*(height+6))) };
        if (!occupied.some(other => candidate.left < other.left+other.width+4 && candidate.left+width+4>other.left && candidate.top<other.top+other.height+4 && candidate.top+height+4>other.top)) { chosen = candidate; found = true; break; }
      }
      if (found) break;
    }
    occupied.push({...chosen,width,height}); labelOffsets.set(marker.id, { ...p, ...chosen,width,height, dx: chosen.left - baseLeft, dy: chosen.top - baseTop });
  }
  const labels=(
      <div id={labelId} role="region" data-scene-labels className={styles.labels} aria-label={`نقاط ${label}`} hidden={!labelsVisible}>
        <svg className={styles.leaders} viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} aria-hidden="true">{[...labelOffsets.entries()].map(([id, offset]) => <line key={id} x1={offset.x} y1={offset.y} x2={offset.left+offset.width/2} y2={offset.top+offset.height/2} stroke="var(--text-muted)" strokeWidth="1" />)}</svg>
        {markers.filter(marker=>marker.showLabel!==false).map(marker => { const p = projectPoint(marker.point, context); const offset = labelOffsets.get(marker.id); const visible = Math.abs(p[0] - frame.x) <= frame.width / 2 && Math.abs(p[1] - frame.y) <= frame.height / 2; return <span key={marker.id} hidden={!visible} style={position(marker.point)}>{onMarkerSelect && marker.selectable!==false ? <button disabled={marker.enabled===false} data-city-id={marker.cityId} data-city-role={marker.role} className={`${styles.labelButton} ${offset ? styles.spreadLabel : ''}`} style={offset ? { transform: `translate(${offset.dx}px, ${offset.dy}px)`,width:offset.width,height:offset.height } : undefined} aria-label={marker.name} onClick={() => {if(isCurrent() && marker.enabled!==false) onMarkerSelect(marker.id);}}>{marker.name}</button> : <span className={styles.label}>{marker.name}</span>}</span>; })}
      </div>
  );
  return <section className={styles.scene} aria-label={label}>
    <div className={styles.controls}><button aria-label={`بزرگ‌نمایی ${label}`} onClick={() => isCurrent() && setZoom(Math.min(8, camera.zoom * 1.25))}>+</button><button aria-label={`کوچک‌نمایی ${label}`} onClick={() => isCurrent() && setZoom(Math.max(.5, camera.zoom / 1.25))}>−</button><button aria-label={`مقیاس اولیه ${label}`} onClick={() => isCurrent() && setZoom(1)}>۱×</button><output aria-label={`مقیاس ${label}`}>{camera.zoom.toFixed(2)}×</output></div>
    <div className={`${styles.viewport} ${onPointChange ? styles.picker : ''}`} ref={viewport} aria-controls={labelId} data-camera-intent={JSON.stringify(camera)} data-camera={JSON.stringify({ ...frame, zoom: camera.zoom })}
      onPointerDown={event => {
        if(!isCurrent()) return;
        if ((event.target as HTMLElement).closest('button')) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 1) gesture.current = false;
        if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; pinch.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: camera.zoom }; gesture.current = true; event.currentTarget.setPointerCapture(event.pointerId); }
      }} onPointerMove={event => {
        if(!isCurrent()){pointers.current.clear();pinch.current=null;return;}
        const previous = pointers.current.get(event.pointerId); if (!previous) return;
        if (Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 4) gesture.current = true;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinch.current && pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y); if (pinch.current.distance > 0) setZoom(Math.max(.5, Math.min(8, pinch.current.zoom * distance / pinch.current.distance))); }
      }} onPointerCancel={event => { pointers.current.delete(event.pointerId); pinch.current = null; gesture.current = true; }} onPointerUp={event => {
        if(!isCurrent()){pointers.current.clear();pinch.current=null;return;}
        if (!gesture.current && pointers.current.has(event.pointerId) && onPointChange && !(event.target as HTMLElement).closest('button')) {
          const box = event.currentTarget.getBoundingClientRect();
          onPointChange(unprojectPoint(frame.x + ((event.clientX - box.left) / box.width - .5) * frame.width, frame.y + (.5 - (event.clientY - box.top) / box.height) * frame.height, context));
        }
        pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinch.current = null;
      }}>
      <GraphicsView label={`${label}؛ نقشه نقطه‌ای`} fallback={fallback(frame)}>{children(frame)}</GraphicsView>
      {!portalLabels && labels}
      {portalLabels && labelLayer && labelsVisible && rect.width>0 && createPortal(<div className={styles.portalViewport} style={rect}>{labels}</div>,labelLayer)}
    </div>
    {onMarkerSelect && <label className={styles.markerSelect}>{markerSelectLabel??'انتخاب نقطه'} <select aria-label={`انتخاب نقطه ${label}`} value="" onChange={event => {const marker=markers.find(item=>item.id===event.target.value);if(isCurrent() && marker?.enabled!==false && marker?.selectable!==false) onMarkerSelect(event.target.value);}}><option value="" disabled>انتخاب کنید</option>{markers.filter(marker=>marker.selectable!==false).map(marker => <option disabled={marker.enabled===false} key={marker.id} value={marker.id}>{marker.name}</option>)}</select></label>}
  </section>;
}
