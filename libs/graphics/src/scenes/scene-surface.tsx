import { useEffect, useLayoutEffect, useRef, useState, useId, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useGraphics } from '../graphics-provider';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from 'three';
import type { GeoPoint } from '@torob-ticket/contracts';
import { GraphicsView } from '../graphics-view';
import { projectPoint, unprojectPoint, type ProjectionContext, type RouteBounds } from '../geo/projection';
import styles from './scenes.module.css';
import { createCameraTransition, type SceneFrameStore } from './camera-transition';
export interface SceneMarker { id: string; name: string; point: GeoPoint; kind?: 'landmark' | 'accommodation' | 'custom' | 'place' | 'city'; cityId?:string; enabled?:boolean; role?:'origin'|'destination'|'network'; selectable?:boolean; showLabel?:boolean }
export interface ScenePointer { x: number; y: number; active: boolean }
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
export function SceneCamera({ frame, transition }: { frame: RouteBounds; transition?: {active:boolean;reducedMotion:boolean;initialFrame?:RouteBounds;projectionLongitude?:number;store:SceneFrameStore} }) {
  const get = useThree(state => state.get); const set = useThree(state => state.set);
  const [camera] = useState(() => Object.assign(new OrthographicCamera(-1, 1, 1, -1, .1, 1000), { manual: true }));
  const [motion] = useState(()=>createCameraTransition(transition && !transition.reducedMotion ? transition.initialFrame ?? frame : frame));
  const last = useRef(performance.now());
  const previousProjection = useRef(transition?.projectionLongitude??0);
  const apply = (actual:RouteBounds) => {
    camera.left = -actual.width / 2; camera.right = actual.width / 2; camera.top = actual.height / 2; camera.bottom = -actual.height / 2;
    camera.position.set(actual.x, actual.y, 200); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    transition?.store.update(actual);
  };
  useLayoutEffect(() => {
    last.current=performance.now();
    const longitude=transition?.projectionLongitude??0;
    if(transition && previousProjection.current!==longitude)motion.rebaseLongitude(previousProjection.current-longitude);
    previousProjection.current=longitude;
    apply(transition ? motion.setTarget(frame,transition.reducedMotion) : frame);
  }, [camera, frame.x,frame.y,frame.width,frame.height,transition?.active,transition?.reducedMotion,transition?.store,transition?.projectionLongitude,motion]);
  useFrame(()=>{
    if(!transition)return;
    const now=performance.now(),delta=now-last.current;last.current=now;
    apply(motion.sample(delta,transition.active,transition.reducedMotion));
  },-1);
  useLayoutEffect(() => { const previous = get().camera; set({ camera }); return () => set({ camera: previous }); }, [get, set, camera]);
  return null;
}
export function SceneSurface({ label, camera, setZoom, context, markers, onMarkerSelect, onPointChange, children, fallback, onFrame, isCurrent = () => true, markerSelectLabel,portalLabels=false,labelsVisible=true,showControls=true,pointer,overlay,displayFrame }: {
  label: string; camera: CameraIntent; setZoom: (zoom: number) => void; context: ProjectionContext; markers: readonly SceneMarker[];
  onMarkerSelect?: (id: string) => void; onPointChange?: (point: GeoPoint) => void;
  children: (frame: RouteBounds) => ReactNode; fallback: (frame: RouteBounds) => ReactNode; onFrame?: (frame: RouteBounds) => void; isCurrent?:()=>boolean; markerSelectLabel?:string;portalLabels?:boolean;labelsVisible?:boolean;showControls?:boolean;
  pointer?: RefObject<ScenePointer>; overlay?: (frame: RouteBounds, dimensions: { width: number; height: number }) => ReactNode;
  displayFrame?: SceneFrameStore;
}) {
  const {labelLayer}=useGraphics();const labelId=useId();
  const [rect,setRect]=useState({left:0,top:0,width:0,height:0});
  const viewport = useRef<HTMLDivElement>(null); const [dimensions, setDimensions] = useState({ width: 560, height: 400 });
  const pointers = useRef(new Map<number, { x: number; y: number }>()); const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const gesture = useRef(false);
  const zoomControls = useRef({ zoom: camera.zoom, setZoom, isCurrent, pointer });
  zoomControls.current = { zoom: camera.zoom, setZoom, isCurrent, pointer };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // Desktop trackpads emit Ctrl+wheel for pinch. Ordinary wheel scrolling remains page scrolling.
    const zoom = (event: WheelEvent) => {
      const current = zoomControls.current;
      if (!event.ctrlKey || !current.isCurrent()) return;
      event.preventDefault();
      if (current.pointer) current.pointer.current.active = false;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      current.setZoom(Math.max(.5, Math.min(8, current.zoom * Math.exp(-Math.max(-200, Math.min(200, delta)) * .006))));
    };
    element.addEventListener('wheel', zoom, { passive: false });
    return () => element.removeEventListener('wheel', zoom);
  }, []);
  useLayoutEffect(()=>{
    const element=viewport.current!;
    const measure=()=>{const box=element.getBoundingClientRect();if(box.width&&box.height){setDimensions(previous=>previous.width===box.width&&previous.height===box.height?previous:{width:box.width,height:box.height});if(portalLabels)setRect(previous=>previous.left===box.left&&previous.top===box.top&&previous.width===box.width&&previous.height===box.height?previous:{left:box.left,top:box.top,width:box.width,height:box.height});}};
    const observer=new ResizeObserver(measure);observer.observe(element);measure();
    if(portalLabels){window.addEventListener('scroll',measure,{capture:true,passive:true});window.addEventListener('resize',measure,{passive:true});}
    return()=>{observer.disconnect();window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};
  },[portalLabels]);
  const frame = frameForAspect(camera, dimensions.width / dimensions.height);
  useEffect(()=>{
    if(!displayFrame)return;
    const update=()=>{const actual=displayFrame.getSnapshot();if(actual&&viewport.current)viewport.current.dataset['camera']=JSON.stringify({...actual,zoom:camera.zoom});};
    update();return displayFrame.subscribe(update);
  },[displayFrame,camera.zoom]);
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
    // The bounded city network has its own spreading budget; retain the T14 local-picker layout.
    for (const column of marker.kind==='city'?[0,-1,1,-2,2]:[0,-1,1]) {
      for (const row of marker.kind==='city'?[0,1,-1,2,-2,3,-3,4,-4,5,-5]:[0,1,2,3,-1,-2,-3]) {
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
    {showControls && <div className={styles.controls}><button aria-label={`بزرگ‌نمایی ${label}`} onClick={() => isCurrent() && setZoom(Math.min(8, camera.zoom * 1.25))}>+</button><button aria-label={`کوچک‌نمایی ${label}`} onClick={() => isCurrent() && setZoom(Math.max(.5, camera.zoom / 1.25))}>−</button><button aria-label={`مقیاس اولیه ${label}`} onClick={() => isCurrent() && setZoom(1)}>۱×</button><output aria-label={`مقیاس ${label}`}>{camera.zoom.toFixed(2)}×</output></div>}
    <div className={`${styles.viewport} ${onPointChange ? styles.picker : ''}`} ref={viewport} aria-controls={labelsVisible?labelId:undefined} data-camera-intent={JSON.stringify(camera)} data-camera={JSON.stringify({ ...frame, zoom: camera.zoom })}
      onPointerDown={event => {
        if(!isCurrent()) return;
        if ((event.target as HTMLElement).closest('button')) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 1) gesture.current = false;
        if (pointers.current.size === 2) { if(pointer)pointer.current.active=false; const [a, b] = [...pointers.current.values()]; pinch.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: camera.zoom }; gesture.current = true; event.currentTarget.setPointerCapture(event.pointerId); }
      }} onPointerMove={event => {
        if(!isCurrent()){pointers.current.clear();pinch.current=null;if(pointer)pointer.current.active=false;return;}
        if(pointer && event.pointerType!=='touch') {
          const box=event.currentTarget.getBoundingClientRect();
          const actual=displayFrame?.getSnapshot()??frame;
          pointer.current.x=actual.x+((event.clientX-box.left)/box.width-.5)*actual.width;
          pointer.current.y=actual.y+(.5-(event.clientY-box.top)/box.height)*actual.height;
          pointer.current.active=true;
        }
        const previous = pointers.current.get(event.pointerId); if (!previous) return;
        if (Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 4) gesture.current = true;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinch.current && pointers.current.size === 2) { if(pointer)pointer.current.active=false; const [a, b] = [...pointers.current.values()]; const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y); if (pinch.current.distance > 0) setZoom(Math.max(.5, Math.min(8, pinch.current.zoom * distance / pinch.current.distance))); }
      }} onPointerLeave={()=>{if(pointer)pointer.current.active=false;}} onPointerCancel={event => { pointers.current.delete(event.pointerId); pinch.current = null; gesture.current = true;if(pointer)pointer.current.active=false; }} onPointerUp={event => {
        if(!isCurrent()){pointers.current.clear();pinch.current=null;return;}
        if (!gesture.current && pointers.current.has(event.pointerId) && onPointChange && !(event.target as HTMLElement).closest('button')) {
          const box = event.currentTarget.getBoundingClientRect();
          onPointChange(unprojectPoint(frame.x + ((event.clientX - box.left) / box.width - .5) * frame.width, frame.y + (.5 - (event.clientY - box.top) / box.height) * frame.height, context));
        }
        pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinch.current = null;
      }}>
      <GraphicsView label={`${label}؛ نقشه نقطه‌ای`} fallback={fallback(frame)}>{children(frame)}</GraphicsView>
      {!portalLabels && labelsVisible && labels}
      {portalLabels && labelLayer && labelsVisible && rect.width>0 && createPortal(<div className={styles.portalViewport} style={rect}>{labels}</div>,labelLayer)}
      {!portalLabels && overlay?.(frame,dimensions)}
      {portalLabels && labelLayer && overlay && rect.width>0 && createPortal(<div className={styles.portalViewport} style={rect}>{overlay(frame,dimensions)}</div>,labelLayer)}
    </div>
    {onMarkerSelect && <label className={styles.markerSelect}>{markerSelectLabel??'انتخاب نقطه'} <select aria-label={`انتخاب نقطه ${label}`} value="" onChange={event => {const marker=markers.find(item=>item.id===event.target.value);if(isCurrent() && marker?.enabled!==false && marker?.selectable!==false) onMarkerSelect(event.target.value);}}><option value="" disabled>انتخاب کنید</option>{markers.filter(marker=>marker.selectable!==false).map(marker => <option disabled={marker.enabled===false} key={marker.id} value={marker.id}>{marker.name}</option>)}</select></label>}
  </section>;
}
