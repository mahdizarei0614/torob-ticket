import { useEffect, useState, useRef, useLayoutEffect, useId, useMemo, type RefObject, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, ShaderMaterial, Vector2, Vector4, type Mesh, type OrthographicCamera } from 'three';
import type { GeoPoint, Mode } from '@torob-ticket/contracts';
import { useThemeUniforms } from '../theme-uniforms';
import { projectPoint, type ProjectedPoint, type ProjectionContext, type RouteBounds } from '../geo/projection';
import { createRouteLineGeometry, createRouteRibbonGeometry } from '../geo/route-buffer';
import { offsetPresentationPath, presentationRoutePaths, ROUTE_LANE_OFFSET_PX } from '../geo/route-lanes';
import { vehicleAlongRoute, type RouteSegmentGeometry } from '../geo/route-geometry';
import { createGlassVehicleGeometry, createVehicleGeometry, VEHICLE_PIXELS } from '../sprites/vehicle';
import { createProgressTransition } from '../progress-transition';
import { sampleJourneyPresentation, type JourneyPresentation, type JourneyPresentationFrame } from './journey-presentation';
import { sampleRouteDirection, staticRouteDirections } from './route-direction';
import type { SceneMarker, ScenePointer } from './scene-surface';
import { createPointerTrail, POINTER_TRAIL_RADIUS_PX } from './pointer-trail';
import { createMapEdgeFadeUniforms, updateMapEdgeFadeUniforms, StaticMapEdgeFade } from './map-edge-fade';
import edgeFadeFragment from '../shaders/map-edge-fade.glsl?raw';
import { buildVehicleTrack, buildRoundTripVehicleTrack, roundTripVehicleDistance, sampleVehiclePose, sampleTrainWagons, vehicleRotation, type VehiclePose, type RoundTripVehicleTrack } from './vehicle-motion';
import mapVertex from '../shaders/map-dots.vert.glsl?raw';
import mapFragment from '../shaders/map-dots.frag.glsl?raw';
import routeVertex from '../shaders/route.vert.glsl?raw';
import routeFragment from '../shaders/route.frag.glsl?raw';
import ambientFragment from '../shaders/ambient.frag.glsl?raw';
import ribbonVertex from '../shaders/route-ribbon.vert.glsl?raw';
import ribbonFragment from '../shaders/route-ribbon.frag.glsl?raw';
import glassVertex from '../shaders/vehicle-glass.vert.glsl?raw';
import glassFragment from '../shaders/vehicle-glass.frag.glsl?raw';
import particleFlowShader from '../shaders/particle-flow-sampling.glsl?raw';
import livingDotDrift from '../shaders/living-dot-drift.glsl?raw';
import { LIVING_DOT_AMPLITUDE_PX } from './living-dot-drift';
import { setMapVehicleForeground } from '../map-foreground';
interface DrawingProps {
  dots: readonly GeoPoint[]; markers: readonly SceneMarker[]; segments: readonly RouteSegmentGeometry[];
  context: ProjectionContext; frame: RouteBounds; progress?: 0 | .35 | .7 | 1; mode?: Mode; reveal?: number;
  animateProgress?: boolean; onMotionChange?: (active: boolean) => void; motionKey?: string;
  presentation?: JourneyPresentation; presentationKey?: string; presentationReducedMotion?: boolean;
  onPresentationFrame?: (frame: JourneyPresentationFrame) => void; pointer?: RefObject<ScenePointer>;
  ambientMotion?: boolean; majorCities?: readonly GeoPoint[]; hideGeography?:boolean; featherGeography?:boolean;
}
interface Resources {
  dots: BufferGeometry; line: BufferGeometry; sprites: Record<Mode, BufferGeometry>; glass: BufferGeometry;
  dotsMaterial: ShaderMaterial; routeMaterial: ShaderMaterial; spriteMaterial: ShaderMaterial; wagonMaterials: ShaderMaterial[]; atmospheric: boolean;
}
const NO_CITIES: readonly GeoPoint[] = [];
const modeCode = (mode: Mode) => mode === 'train' ? 1 : mode === 'bus' ? 2 : 0;
/** All animation runs in the application's existing renderer clock; there is no second RAF. */
export function SceneDrawing({ dots, markers, segments, context, frame, progress = 0, mode, reveal = 1,
  animateProgress = false, onMotionChange, motionKey = 'route', presentation, presentationKey = motionKey,
  presentationReducedMotion = false, onPresentationFrame, pointer, ambientMotion = false, majorCities = NO_CITIES, hideGeography = false, featherGeography = false,
}: DrawingProps) {
  const invalidate = useThree(state => state.invalidate);
  const get = useThree(state => state.get);
  const dpr = useThree(state => state.viewport.dpr);
  const uniforms = useThemeUniforms(invalidate);
  const mesh = useRef<Mesh>(null);
  const wagonMeshes = useRef<(Mesh | null)[]>([]);
  const track = useMemo(() => buildVehicleTrack(segments), [segments]);
  const turnTrack = useRef<{ unit: number; segments: readonly RouteSegmentGeometry[]; value: RoundTripVehicleTrack | null } | undefined>(undefined);
  const outward = useRef(onMotionChange); outward.current = onMotionChange;
  const presentationOutward = useRef(onPresentationFrame); presentationOutward.current = onPresentationFrame;
  const [transition] = useState(() => createProgressTransition(motionKey, progress));
  const clock = useRef({ key: presentationKey, elapsed: 0, last: performance.now(), reported: -Infinity });
  // Ambient light has its own accumulated phase, but shares the same host frame.
  // Selecting another journey must not reset the geography's breathing light.
  const ambientSeconds = useRef(0);
  const [hoverTrail]=useState(createPointerTrail);
  const [edgeFade]=useState(createMapEdgeFadeUniforms);
  const [resources, setResources] = useState<Resources | null>(null);
  useLayoutEffect(()=>{
    hoverTrail.clear();if(pointer)pointer.current.active=false;
    const hover=resources?.dots.getAttribute('hoverGlow');if(hover){hover.array.fill(0);hover.needsUpdate=true;}
    invalidate();
  },[hoverTrail,context.centralLongitude,presentationKey,presentationReducedMotion,resources,invalidate,pointer]);
  const atmospheric = Boolean(presentation);
  const moving = atmospheric && ambientMotion && !presentationReducedMotion;

  const applyScreenSizes = () => {
    if (!resources?.atmospheric) return;
    const current = get();
    const camera = current.camera as OrthographicCamera;
    const width = camera.isOrthographicCamera ? (camera.right - camera.left) / camera.zoom : frame.width;
    const unit = width / Math.max(1, current.size.width);
    resources.dotsMaterial.uniforms['unitsPerPixel']!.value = unit;
    resources.dotsMaterial.uniforms['dotDriftAmplitude']!.value = !presentationReducedMotion ? LIVING_DOT_AMPLITUDE_PX : 0;
    const length = Math.max(.000001, Number(resources.line.userData['routeLength']) || 0);
    resources.routeMaterial.uniforms['routeWidth']!.value = unit * 9.2;
    resources.routeMaterial.uniforms['routeLaneWidth']!.value = unit * ROUTE_LANE_OFFSET_PX;
    resources.routeMaterial.uniforms['headLength']!.value = Math.min(.035, Math.max(.002, unit * 7 / length));
    resources.routeMaterial.uniforms['tailLength']!.value = Math.min(.28, Math.max(.04, unit * 115 / length));
  };

  const applyVehicle = (value: number, stopGlow = 0, opacity = 1, blur = 0, turnProgress?: number, direction?: 'outbound' | 'return') => {
    const state = get(), camera = state.camera as OrthographicCamera;
    const unit = (camera.isOrthographicCamera ? (camera.right - camera.left) / camera.zoom : frame.width) / Math.max(1, state.size.width);
    if (presentation?.roundTrip && (!turnTrack.current || turnTrack.current.segments !== segments || Math.abs(turnTrack.current.unit - unit) > .000001)) {
      turnTrack.current = { unit, segments, value: buildRoundTripVehicleTrack(segments, presentation.roundTrip.splitSegment, unit) };
    }
    const roundTripTrack = presentation?.roundTrip ? turnTrack.current?.value : undefined;
    const activeTrack = roundTripTrack?.track ?? track;
    const distance = roundTripTrack ? roundTripVehicleDistance(roundTripTrack, value, turnProgress, direction) : track.length * Math.max(0, Math.min(1, value));
    const pose = resources?.atmospheric ? sampleVehiclePose(activeTrack, distance) : null;
    // Different stations/airports are not joined by a made-up geographic transfer.
    // Fade the decorative maneuver out, then emerge on the supplied return path.
    if (roundTripTrack?.discontinuous) {
      const smooth = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };
      const handoffOpacity = turnProgress !== undefined ? 1 - smooth((turnProgress - .72) / .28) : distance >= roundTripTrack.turnStart + roundTripTrack.turnLength ? smooth((distance - roundTripTrack.turnStart - roundTripTrack.turnLength) / Math.max(.000001, unit * 28)) : 1;
      opacity *= handoffOpacity; blur = Math.max(blur, 1 - handoffOpacity);
    }
    const vehicle = pose ?? vehicleAlongRoute(segments, value);
    const currentMode = vehicle.mode ?? mode ?? 'flight';
    if (mesh.current) {
      mesh.current.position.set(vehicle.point[0], vehicle.point[1], vehicle.point[2] + .5);
      if (resources) {
        mesh.current.geometry = resources.atmospheric ? resources.glass : resources.sprites[currentMode];
        if (resources.atmospheric) {
          resources.spriteMaterial.uniforms['vehicleMode']!.value = modeCode(currentMode);
          resources.spriteMaterial.uniforms['stopGlow']!.value = stopGlow;
          resources.spriteMaterial.uniforms['vehicleOpacity']!.value = opacity;
          resources.spriteMaterial.uniforms['vehicleBlur']!.value = blur;
          const applyPose = (target: Mesh, point: VehiclePose, size: number) => {
            target.position.set(point.point[0], point.point[1], point.point[2] + .5);
            target.rotation.z = vehicleRotation(point);
            target.scale.set(size * (point.mode === 'flight' ? 1 : point.facing), size, size);
          };
          if (pose) applyPose(mesh.current, pose, unit * (currentMode === 'train' ? 22 : currentMode === 'bus' ? 28 : 24));
          const gap = unit * 36;
          const wagons = pose?.mode === 'train' ? sampleTrainWagons(activeTrack, pose, gap) : [null, null];
          wagonMeshes.current.forEach((target, index) => {
            if (!target) return;
            const wagon = wagons[index]; target.visible = Boolean(wagon);
            const material = resources.wagonMaterials[index]!;
            if (wagon) applyPose(target, wagon, unit * 21);
            const emergence = wagon ? Math.min(1, wagon.distance / Math.max(.000001, gap * .4)) : 0;
            material.uniforms['vehicleOpacity']!.value = opacity * emergence;
            material.uniforms['vehicleBlur']!.value = Math.max(blur, 1 - emergence);
            material.uniforms['stopGlow']!.value = stopGlow;
          });
        }
      }
    }
    return pose;
  };
  const applyPresentation = (force = false) => {
    if (!presentation || !resources?.atmospheric) return;
    const value = sampleJourneyPresentation(presentation, clock.current.elapsed, { reducedMotion: presentationReducedMotion });
    resources.routeMaterial.uniforms['reveal']!.value = value.reveal;
    resources.routeMaterial.uniforms['travel']!.value = value.travel;
    resources.routeMaterial.uniforms['stopGlow']!.value = value.stopGlow;
    // The head and its light are one transient effect. Keep the revealed base
    // route, but fade both before wrapping travel back to the origin.
    resources.routeMaterial.uniforms['strandOpacity']!.value = presentationReducedMotion ? 0 : value.vehicleOpacity;
    const camera = get().camera as OrthographicCamera;
    const width = camera.isOrthographicCamera ? (camera.right - camera.left) / camera.zoom : frame.width;
    const lengthPx = Number(resources.line.userData['routeLength']) / (width / Math.max(1, get().size.width));
    const direction = sampleRouteDirection(presentation, value, clock.current.elapsed, lengthPx, presentationReducedMotion);
    resources.routeMaterial.uniforms['directionSplit']!.value = direction.split;
    resources.routeMaterial.uniforms['directionRoundTrip']!.value = direction.roundTrip ? 1 : 0;
    resources.routeMaterial.uniforms['directionPhase']!.value = direction.phase;
    resources.routeMaterial.uniforms['directionCount']!.value.set(...direction.counts);
    resources.routeMaterial.uniforms['directionOpacity']!.value.set(...direction.opacities);
    const pose = applyVehicle(value.travel, value.stopGlow, value.vehicleOpacity, value.vehicleBlur, value.turnProgress, value.direction);
    if (force || clock.current.elapsed - clock.current.reported >= 80) {
      presentationOutward.current?.({ ...value, vehiclePoint: pose?.point });
      clock.current.reported = clock.current.elapsed;
    }
  };
  useLayoutEffect(() => {
    if (clock.current.key !== presentationKey) clock.current = { key: presentationKey, elapsed: 0, last: performance.now(), reported: -Infinity };
    clock.current.last = performance.now();
    if (atmospheric) {
      transition.cancel();
      // Reduced motion completes the reveal permanently for this selected journey.
      // Restoring motion resumes the light strand, without retracting route or facts.
      if (presentationReducedMotion && presentation) clock.current.elapsed = Math.max(clock.current.elapsed, presentation.durationMs);
      applyPresentation(true);
    } else {
      transition.set({ key: motionKey, target: progress, enabled: animateProgress, now: performance.now() });
      applyVehicle(transition.sample(performance.now()));
    }
    outward.current?.(moving || (!atmospheric && transition.active()));
    invalidate();
  }, [transition, motionKey, progress, animateProgress, segments, resources, presentationKey, presentation, presentationReducedMotion, moving, atmospheric]);
  useLayoutEffect(() => () => { transition.cancel(); outward.current?.(false); }, [transition]);
  useFrame(() => {
    updateMapEdgeFadeUniforms(edgeFade,get().size,featherGeography);
    // The shared host can change DPR after a quality downgrade or display move.
    // Refresh before every submitted frame, including the single reduced-motion frame.
    if (resources?.atmospheric) resources.dotsMaterial.uniforms['pointSize']!.value = 8.5 * get().gl.getPixelRatio();
    const now = performance.now();
    const visibleSeconds = Math.max(0, (now - clock.current.last) / 1000);
    const delta = Math.min(.05, visibleSeconds);
    clock.current.last = now;
    if (moving && resources) {
      clock.current.elapsed += delta * 1000;
      ambientSeconds.current = pointer?.current.flowSeconds ?? ambientSeconds.current + delta;
      resources.dotsMaterial.uniforms['time']!.value = ambientSeconds.current;
      const position = resources.dots.getAttribute('position');
      const hover = resources.dots.getAttribute('hoverGlow');
      const camera = get().camera as OrthographicCamera;
      const width = camera.isOrthographicCamera ? (camera.right - camera.left) / camera.zoom : frame.width;
      const unit=width/Math.max(1,get().size.width);
      const radius=Math.min(POINTER_TRAIL_RADIUS_PX,get().size.width*.08,get().size.height*.1)*unit;
      hoverTrail.advance(delta*1000,pointer?.current,radius,{active:moving,reducedMotion:presentationReducedMotion});
      let changed = false;
      for (let i = 0; i < position.count; i++) {
        const before = hover.getX(i);
        const next = hideGeography && i<dots.length ? 0 : hoverTrail.sample(position.getX(i),position.getY(i));
        if (Math.abs(next - before) > .00002) { hover.setX(i, next); changed = true; }
      }
      if (changed) hover.needsUpdate = true;
      applyPresentation();
    } else if (!atmospheric && transition.active()) {
      applyVehicle(transition.sample(now));
      if (resources) resources.routeMaterial.uniforms['emphasis']!.value = transition.emphasis(now);
      if (!transition.active()) outward.current?.(false);
    }
    // SceneCamera advances its frustum first; keep ribbons/icons constant in CSS pixels.
    if (atmospheric && !moving) applyPresentation();
    applyScreenSizes();
  });
  useEffect(() => {
    const points = [...dots.map(point => projectPoint(point, context)), ...majorCities.map(point => projectPoint(point, context)), ...markers.map(marker => { const point = projectPoint(marker.point, context); point[2] = .3; return point; })];
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
    geometry.setAttribute('geography', new Float32BufferAttribute([...dots.map(() => 1), ...majorCities.map(() => 1), ...markers.map(() => 0)], 1));
    geometry.setAttribute('emphasis', new Float32BufferAttribute([...dots.map(() => 0), ...majorCities.map(() => .8), ...markers.map(marker => marker.enabled === false ? 0 : marker.kind === 'custom' || marker.role === 'origin' || marker.role === 'destination' ? 2 : 1)], 1));
    geometry.setAttribute('hoverGlow', new Float32BufferAttribute(new Float32Array(points.length), 1).setUsage(DynamicDrawUsage));
    geometry.setAttribute('phase', new Float32BufferAttribute(points.map(point => Math.sin(point[0] * 12.9898 + point[1] * 78.233) * 6.283185), 1));
    const flowUniforms=pointer?.current.flow?.uniforms??{particleFlowState:{value:null},particleFlowFrame:{value:new Vector4(0,0,1,1)},particleFlowViewport:{value:new Vector2(1,1)},particleFlowActive:{value:0}};
    const base = { transparent: true, depthTest: false, depthWrite: false, toneMapped: false };
    const next: Resources = {
      dots: geometry, line: atmospheric ? createRouteRibbonGeometry(segments, presentation?.roundTrip?.splitSegment) : createRouteLineGeometry(segments),
      sprites: { flight: createVehicleGeometry('flight'), train: createVehicleGeometry('train'), bus: createVehicleGeometry('bus') }, glass: createGlassVehicleGeometry(), atmospheric,
      dotsMaterial: new ShaderMaterial({ ...base, uniforms: { ...uniforms, ...edgeFade, ...flowUniforms, geographyOpacity: { value:hideGeography?0:1 }, pointSize: { value: atmospheric ? 8.5 * get().gl.getPixelRatio() : 3.5 }, atmosphere: { value: atmospheric ? 1 : 0 }, time: { value: ambientSeconds.current }, motionReduced: { value: presentationReducedMotion ? 1 : 0 }, dotDriftAmplitude:{value:!presentationReducedMotion?LIVING_DOT_AMPLITUDE_PX:0}, unitsPerPixel:{value:frame.width/Math.max(1,get().size.width)}, centralLongitude:{value:context.centralLongitude} }, vertexShader: livingDotDrift+'\n'+particleFlowShader+'\n'+mapVertex, fragmentShader: edgeFadeFragment+'\n'+mapFragment }),
      routeMaterial: new ShaderMaterial({ ...base, side: DoubleSide, uniforms: { ...uniforms, reveal: { value: atmospheric ? 0 : reveal }, emphasis: { value: 0 }, routeWidth: { value: 0 }, routeLaneWidth: { value: 0 }, travel: { value: 0 }, stopGlow: { value: 0 }, strandOpacity: { value: 1 }, headLength: { value: .015 }, tailLength: { value: .15 }, directionSplit: { value: 1 }, directionRoundTrip: { value: 0 }, directionPhase: { value: 0 }, directionCount: { value: new Vector2(1, 0) }, directionOpacity: { value: new Vector2(0, 0) } }, vertexShader: atmospheric ? ribbonVertex : routeVertex, fragmentShader: atmospheric ? ribbonFragment : ambientFragment }),
      spriteMaterial: new ShaderMaterial({ ...base, side: DoubleSide, uniforms: { ...uniforms, reveal: { value: 1 }, vehicleMode: { value: modeCode(mode ?? 'flight') }, stopGlow: { value: 0 }, vehicleOpacity: { value: 1 }, vehicleBlur: { value: 0 } }, vertexShader: atmospheric ? glassVertex : routeVertex, fragmentShader: atmospheric ? glassFragment : routeFragment }),
      wagonMaterials: [0, 1].map(() => new ShaderMaterial({ ...base, side: DoubleSide, uniforms: { ...uniforms, vehicleMode: { value: 3 }, stopGlow: { value: 0 }, vehicleOpacity: { value: 0 }, vehicleBlur: { value: 0 } }, vertexShader: glassVertex, fragmentShader: glassFragment })),
    };
    setResources(next); invalidate();
    return () => {
      next.dots.dispose(); next.line.dispose(); next.glass.dispose();
      Object.values(next.sprites).forEach(sprite => sprite.dispose());
      next.dotsMaterial.dispose(); next.routeMaterial.dispose(); next.spriteMaterial.dispose();
      next.wagonMaterials.forEach(material => material.dispose());
    };
  }, [dots, markers, majorCities, segments, context, uniforms, edgeFade, invalidate, atmospheric, get, presentation?.roundTrip?.splitSegment]);
  useLayoutEffect(() => {
    if (!resources) return;
    if (resources.atmospheric) resources.dotsMaterial.uniforms['pointSize']!.value = 8.5 * dpr;
    applyScreenSizes();
    if (mesh.current && !resources.atmospheric) mesh.current.scale.setScalar(frame.width / 220);
    if (!resources.atmospheric) resources.routeMaterial.uniforms['reveal']!.value = Math.max(0, Math.min(1, reveal));
    resources.dotsMaterial.uniforms['geographyOpacity']!.value = hideGeography ? 0 : 1;
    resources.dotsMaterial.uniforms['motionReduced']!.value = presentationReducedMotion ? 1 : 0;
    resources.dotsMaterial.uniforms['dotDriftAmplitude']!.value = !presentationReducedMotion ? LIVING_DOT_AMPLITUDE_PX : 0;
    invalidate();
  }, [resources, frame.width, frame.height, reveal, get, invalidate, presentationReducedMotion, dpr, hideGeography,moving]);
  if (!resources) return null;
  return <group dispose={null}>
    <points geometry={resources.dots} material={resources.dotsMaterial} frustumCulled={false} />
    {resources.atmospheric ? <mesh geometry={resources.line} material={resources.routeMaterial} frustumCulled={false} /> : <lineSegments geometry={resources.line} material={resources.routeMaterial} frustumCulled={false} />}
    {mode && segments.some(segment => segment.paths.length) && <mesh name="journey-vehicle-head" ref={value => { mesh.current = value;if (value) setMapVehicleForeground(value, resources.atmospheric); }} geometry={resources.atmospheric ? resources.glass : resources.sprites[mode]} material={resources.spriteMaterial} frustumCulled={false} />}
    {resources.atmospheric && resources.wagonMaterials.map((material,index) => <mesh key={index} name={`journey-vehicle-wagon-${index + 1}`} ref={value => { wagonMeshes.current[index] = value;if (value) setMapVehicleForeground(value, true, index + 1); }} geometry={resources.glass} material={material} frustumCulled={false} visible={false} />)}
  </group>;
}
export function StaticMap({ dots, markers, segments, context, frame, progress = 0, mode, presentation, majorCities = NO_CITIES, background, hideGeography = false, featherGeography = false, viewport = {width:560,height:400} }: DrawingProps & {background?:ReactNode;viewport?:{width:number;height:number}}) {
  const id = useId().replace(/:/g, '');
  const radius = frame.width / 360;
  const vehicle = vehicleAlongRoute(segments, presentation ? 1 : progress); const vehicleMode = vehicle.mode ?? mode;
  const track = useMemo(() => buildVehicleTrack(segments), [segments]);
  const directionUnit = frame.width / Math.max(1, viewport.width);
  const displaySegments = useMemo(() => {
    const paths = presentationRoutePaths(segments, presentation?.roundTrip?.splitSegment);
    return segments.map(segment => ({ ...segment, paths: paths.filter(path => path.segment === segment).map(path => offsetPresentationPath(path, directionUnit)) }));
  }, [segments, directionUnit, presentation?.roundTrip?.splitSegment]);
  const directionArrows = useMemo(() => presentation ? staticRouteDirections(displaySegments, directionUnit, presentation.roundTrip?.splitSegment) : [], [displaySegments, directionUnit, presentation]);
  const routeStroke = (returning: boolean, transfer = false) => returning
    ? transfer ? 'color-mix(in srgb-linear, var(--scene-route-muted) 76%, var(--scene-route) 24%)' : 'color-mix(in srgb-linear, var(--scene-route) 54%, var(--scene-route-muted) 46%)'
    : transfer ? 'var(--scene-route-muted)' : 'var(--scene-route)';
  const head = sampleVehiclePose(track, track.length * (presentation ? 1 : progress));
  const wagons = presentation && !presentation.roundTrip && head?.mode === 'train' ? sampleTrainWagons(track, head, frame.width / 600 * 36) : [];
  const poseTransform = (pose: VehiclePose, carriage = false) => `translate(${pose.point[0]},${-pose.point[1]}) rotate(${-vehicleRotation(pose) * 180 / Math.PI}) scale(${frame.width / 600 * (carriage ? 2.1 : pose.mode === 'train' ? 2.2 : pose.mode === 'bus' ? 2.8 : 2.4) * (pose.mode === 'flight' ? 1 : pose.facing)},${frame.width / 600 * (carriage ? 2.1 : pose.mode === 'train' ? 2.2 : pose.mode === 'bus' ? 2.8 : 2.4)})`;
  const xy = (point: GeoPoint): ProjectedPoint => projectPoint(point, context);
  const glassPaths: Record<Mode, string> = {
    flight: 'M0 -7 Q1 -7 1 -5 L1 -1 L7 2 Q8 3 6 3 L1 2 L1 5 L3 6 L3 7 L0 6 L-3 7 L-3 6 L-1 5 L-1 2 L-6 3 Q-8 3 -7 2 L-1 -1 L-1 -5 Q-1 -7 0 -7Z',
    train: 'M-7 -3 H3 Q4 -3 5 -2 L8 1 Q9 3 7 3 H-7 Q-8 3 -8 2 V-2 Q-8 -3 -7 -3Z M-6 -2 H-4 V0 H-6Z M-3 -2 H-1 V0 H-3Z M0 -2 H2 V0 H0Z M4 -2 L6 0 H4Z M-6 3 A1 1 0 1 0 -4 3 A1 1 0 1 0 -6 3Z M4 3 A1 1 0 1 0 6 3 A1 1 0 1 0 4 3Z M-4 -3 L-1 -5 L1 -3 M-3 -5 H1',
    bus: 'M-7 -4 H6 Q8 -4 8 -2 V3 Q8 4 6 4 H-6 Q-8 4 -8 3 V-2 Q-8 -4 -7 -4Z M-6 -3 H-4 V0 H-6Z M-3 -3 H-1 V0 H-3Z M0 -3 H2 V0 H0Z M3 -3 H5 V0 H3Z M6 -2 H7 V2 H6Z M-6 3 A1.3 1.3 0 1 0 -3.4 3 A1.3 1.3 0 1 0 -6 3Z M4 3 A1.3 1.3 0 1 0 6.6 3 A1.3 1.3 0 1 0 4 3Z',
  };
  return <svg viewBox={`${frame.x - frame.width / 2} ${-frame.y - frame.height / 2} ${frame.width} ${frame.height}`} role="presentation">
    <defs><linearGradient id={`glass-${id}`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="var(--scene-highlight)" /><stop offset=".4" stopColor="var(--scene-route)" /><stop offset="1" stopColor="var(--scene-route-muted)" /></linearGradient><filter id={`direction-halo-${id}`} x="-100%" y="-150%" width="300%" height="400%"><feGaussianBlur stdDeviation="1.5"/></filter></defs>
    <StaticMapEdgeFade enabled={featherGeography} frame={frame} viewport={viewport}>
      {background}
      {!hideGeography && dots.map((point, i) => { const p = xy(point); return <circle key={i} cx={p[0]} cy={-p[1]} r={radius / 2} opacity={presentation ? .7 : 1} fill="var(--scene-dot)" />; })}
      {majorCities.map((point, i) => { const p = xy(point); return <circle key={`major-${i}`} cx={p[0]} cy={-p[1]} r={radius * .9} fill="var(--scene-dot)" opacity=".7" />; })}
    </StaticMapEdgeFade>
    {displaySegments.flatMap((segment, segmentIndex) => segment.paths.map((path, i) => <g key={`${segment.segmentId}-${i}`} data-route-leg={presentation?.roundTrip && segmentIndex >= presentation.roundTrip.splitSegment ? 'return' : 'outbound'}><polyline points={path.map(point => `${point[0]},${-point[1]}`).join(' ')} fill="none" stroke={routeStroke(Boolean(presentation?.roundTrip && segmentIndex >= presentation.roundTrip.splitSegment), segment.transfer)} strokeWidth={radius * (presentation ? segment.mode === 'train' ? 3.2 : 1.7 : 1)} />{presentation && segment.mode === 'train' && <polyline points={path.map(point => `${point[0]},${-point[1]}`).join(' ')} fill="none" stroke="var(--scene-background)" strokeWidth={radius * 1.4} />}</g>))}
    {directionArrows.length > 0 && <g data-static-route-direction={presentation?.roundTrip ? 'both' : 'outbound'} aria-hidden="true">{directionArrows.map((arrow, index) => <g key={index} data-direction-arrow data-direction-leg={arrow.leg} data-direction-mode={arrow.mode} data-direction-angle={arrow.angle} transform={`translate(${arrow.point[0]},${-arrow.point[1]}) rotate(${-arrow.angle * 180 / Math.PI}) scale(${directionUnit})`} fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M-20 0 L-3 0 M-7 -3.2 L0 0 L-7 3.2" stroke={routeStroke(arrow.leg === 'return', arrow.transfer)} strokeWidth="3.2" opacity=".35" filter={`url(#direction-halo-${id})`}/><path d="M-7 -3.2 L0 0 L-7 3.2" stroke={routeStroke(arrow.leg === 'return', arrow.transfer)} strokeWidth="1.35" opacity=".88"/></g>)}</g>}
    {markers.map(marker => { const p = xy(marker.point); return <circle key={marker.id} cx={p[0]} cy={-p[1]} r={radius * 2} fill={marker.enabled === false ? 'var(--scene-dot)' : presentation ? 'var(--scene-route)' : marker.kind === 'custom' || marker.role === 'origin' || marker.role === 'destination' ? 'var(--focus)' : 'var(--scene-highlight)'} />; })}
    {vehicleMode && !presentation?.roundTrip && segments.some(segment => segment.paths.length) && <g data-static-vehicle="head" transform={presentation && head ? poseTransform(head) : `translate(${vehicle.point[0]},${-vehicle.point[1]}) scale(${frame.width / 220})`} fill="var(--scene-route)">{presentation ? <path d={glassPaths[vehicleMode]} fill={`url(#glass-${id})`} stroke="var(--scene-highlight)" strokeWidth=".35" fillRule="evenodd" /> : VEHICLE_PIXELS[vehicleMode].flatMap((row, y) => [...row].map((pixel, x) => pixel === '1' ? <rect key={y + '-' + x} x={x - 3.5} y={y - 2.5} width="1" height="1" /> : null))}</g>}
    {wagons.map((wagon,index) => wagon && <g key={index} data-static-vehicle={`wagon-${index + 1}`} transform={poseTransform(wagon,true)} fill={`url(#glass-${id})`} stroke="var(--scene-highlight)" strokeWidth=".35"><path d="M-7 -3 H7 Q8 -3 8 -2 V2 Q8 3 7 3 H-7 Q-8 3 -8 2 V-2 Q-8 -3 -7 -3Z M-6 -2 H-4 V0 H-6Z M-3 -2 H-1 V0 H-3Z M0 -2 H2 V0 H0Z M3 -2 H5 V0 H3Z M-6 3 A1 1 0 1 0 -4 3 A1 1 0 1 0 -6 3Z M4 3 A1 1 0 1 0 6 3 A1 1 0 1 0 4 3Z" fillRule="evenodd"/></g>)}
  </svg>;
}
