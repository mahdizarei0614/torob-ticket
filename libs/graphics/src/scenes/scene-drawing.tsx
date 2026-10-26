import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShaderMaterial, type Mesh } from 'three';
import type { GeoPoint, Mode } from '@torob-ticket/contracts';
import { useThemeUniforms } from '../theme-uniforms';
import { projectPoint, type ProjectedPoint, type ProjectionContext, type RouteBounds } from '../geo/projection';
import { createRouteLineGeometry } from '../geo/route-buffer';
import { vehicleAlongRoute, type RouteSegmentGeometry } from '../geo/route-geometry';
import { createVehicleGeometry, VEHICLE_PIXELS } from '../sprites/vehicle';
import { createProgressTransition } from '../progress-transition';
import type { SceneMarker } from './scene-surface';
import mapVertex from '../shaders/map-dots.vert.glsl?raw';
import mapFragment from '../shaders/map-dots.frag.glsl?raw';
import routeVertex from '../shaders/route.vert.glsl?raw';
import routeFragment from '../shaders/route.frag.glsl?raw';
import ambientFragment from '../shaders/ambient.frag.glsl?raw';
interface DrawingProps { dots: readonly GeoPoint[]; markers: readonly SceneMarker[]; segments: readonly RouteSegmentGeometry[]; context: ProjectionContext; frame: RouteBounds; progress?: 0 | .35 | .7 | 1; mode?: Mode; reveal?: number;animateProgress?:boolean;onMotionChange?:(active:boolean)=>void;motionKey?:string }
interface Resources { dots: BufferGeometry; line: BufferGeometry; sprites: Record<Mode,BufferGeometry>; dotsMaterial: ShaderMaterial; routeMaterial: ShaderMaterial; spriteMaterial: ShaderMaterial }
export function SceneDrawing({ dots, markers, segments, context, frame, progress = 0, mode, reveal = 1,animateProgress=false,onMotionChange,motionKey='route' }: DrawingProps) {
  const invalidate = useThree(state => state.invalidate);
  const uniforms = useThemeUniforms(invalidate);
  const mesh=useRef<Mesh>(null);const outward=useRef(onMotionChange);outward.current=onMotionChange;
  const [transition]=useState(()=>createProgressTransition(motionKey,progress));
  const applyPosition=(value:number)=>{const vehicle=vehicleAlongRoute(segments,value);if(mesh.current){mesh.current.position.set(vehicle.point[0],vehicle.point[1],vehicle.point[2]+.5);if(resources) mesh.current.geometry=resources.sprites[vehicle.mode??mode??'flight'];}if(resources)resources.routeMaterial.uniforms['emphasis']!.value=transition.emphasis(performance.now());};
  useLayoutEffect(()=>{const active=transition.set({key:motionKey,target:progress,enabled:animateProgress,now:performance.now()});applyPosition(transition.sample(performance.now()));outward.current?.(active);invalidate();},[transition,motionKey,progress,animateProgress,segments]);
  useLayoutEffect(()=>()=>{transition.cancel();outward.current?.(false);},[transition]);
  useFrame(()=>{if(!transition.active()) return;applyPosition(transition.sample(performance.now()));if(!transition.active()) outward.current?.(false);});
  const [resources, setResources] = useState<Resources | null>(null);
  useEffect(() => {
    const points = [...dots.map(point => projectPoint(point, context)), ...markers.map(marker => { const point = projectPoint(marker.point, context); point[2] = .3; return point; })];
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
    geometry.setAttribute('emphasis', new Float32BufferAttribute([...dots.map(() => 0), ...markers.map(marker => marker.enabled===false?0:marker.kind==='custom'||marker.role==='origin'||marker.role==='destination'?2:1)], 1));
    const next: Resources = {
      dots: geometry, line: createRouteLineGeometry(segments), sprites:{flight:createVehicleGeometry('flight'),train:createVehicleGeometry('train'),bus:createVehicleGeometry('bus')},
      dotsMaterial: new ShaderMaterial({ uniforms: { ...uniforms, pointSize: { value: 3.5 } }, vertexShader: mapVertex, fragmentShader: mapFragment, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
      routeMaterial: new ShaderMaterial({ uniforms: { ...uniforms, reveal: { value: 1 }, emphasis:{value:0} }, vertexShader: routeVertex, fragmentShader: ambientFragment, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
      spriteMaterial: new ShaderMaterial({ uniforms: { ...uniforms, reveal: { value: 1 } }, vertexShader: routeVertex, fragmentShader: routeFragment, transparent: true, side: DoubleSide, depthTest: false, depthWrite: false, toneMapped: false }),
    };
    setResources(next); invalidate();
    return () => { next.dots.dispose(); next.line.dispose(); Object.values(next.sprites).forEach(sprite=>sprite.dispose()); next.dotsMaterial.dispose(); next.routeMaterial.dispose(); next.spriteMaterial.dispose(); };
  }, [dots, markers, segments, context, uniforms, invalidate]);
  useEffect(() => { if (resources) { resources.routeMaterial.uniforms['reveal']!.value = Math.max(0, Math.min(1, reveal)); invalidate(); } }, [resources, reveal, invalidate]);
  const vehicle=vehicleAlongRoute(segments,transition.sample(performance.now()));const position=vehicle.point;
  if (!resources) return null;
  return <group dispose={null}>
    <points geometry={resources.dots} material={resources.dotsMaterial} frustumCulled={false} />
    <lineSegments geometry={resources.line} material={resources.routeMaterial} frustumCulled={false} />
    {mode && segments.some(segment => segment.paths.length) && <mesh ref={mesh} geometry={resources.sprites[vehicle.mode??mode??'flight']} material={resources.spriteMaterial} position={[position[0], position[1], position[2] + .5]} scale={frame.width / 220} />}
  </group>;
}
export function StaticMap({ dots, markers, segments, context, frame,progress=0,mode }: DrawingProps) {
  const radius = frame.width / 360;
  const vehicle=vehicleAlongRoute(segments,progress);const vehicleMode=vehicle.mode??mode;
  const xy = (point: GeoPoint): ProjectedPoint => projectPoint(point, context);
  return <svg viewBox={`${frame.x - frame.width / 2} ${-frame.y - frame.height / 2} ${frame.width} ${frame.height}`} role="presentation">
    {dots.map((point, i) => { const p = xy(point); return <circle key={i} cx={p[0]} cy={-p[1]} r={radius / 2} fill="var(--scene-dot)" />; })}
    {segments.flatMap(segment => segment.paths.map((path, i) => <polyline key={`${segment.segmentId}-${i}`} points={path.map(point => `${point[0]},${-point[1]}`).join(' ')} fill="none" stroke={segment.transfer ? 'var(--scene-route-muted)' : 'var(--scene-route)'} strokeWidth={radius} />))}
    {markers.map(marker => { const p = xy(marker.point); return <circle key={marker.id} cx={p[0]} cy={-p[1]} r={radius * 2} fill={marker.enabled===false?'var(--scene-dot)':marker.kind==='custom'||marker.role==='origin'||marker.role==='destination'?'var(--focus)':'var(--scene-highlight)'} />; })}
    {vehicleMode && segments.some(segment=>segment.paths.length) && <g transform={`translate(${vehicle.point[0]},${-vehicle.point[1]}) scale(${frame.width/220})`} fill="var(--scene-route)">{VEHICLE_PIXELS[vehicleMode].flatMap((row,y)=>[...row].map((pixel,x)=>pixel==='1'?<rect key={y+'-'+x} x={x-3.5} y={y-2.5} width="1" height="1"/>:null))}</g>}
  </svg>;
}
