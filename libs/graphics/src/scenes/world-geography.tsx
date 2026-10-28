import { useMemo, useEffect, useLayoutEffect, useState, useRef, useId, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, ShaderMaterial, Vector2, Vector4, type OrthographicCamera } from 'three';
import { useThemeUniforms } from '../theme-uniforms';
import type { ProjectionContext, RouteBounds } from '../geo/projection';
import { DOMESTIC_DOT_BASE_SPACING, INTERNATIONAL_DOT_BASE_SPACING, worldDotWeights, worldLandPositions, worldBorderPositions, type WorldCountry } from '../geo/world-context';
import type { ScenePointer } from './scene-surface';
import { createPointerTrail, POINTER_TRAIL_RADIUS_PX } from './pointer-trail';
import { createMapEdgeFadeUniforms, updateMapEdgeFadeUniforms } from './map-edge-fade';
import edgeFadeFragment from '../shaders/map-edge-fade.glsl?raw';
import worldVertex from '../shaders/world-context.vert.glsl?raw';
import worldFragment from '../shaders/world-context.frag.glsl?raw';
import morphVertex from '../shaders/scope-morph.vert.glsl?raw';
import morphFragment from '../shaders/scope-morph.frag.glsl?raw';
import livingDotDrift from '../shaders/living-dot-drift.glsl?raw';
import { LIVING_DOT_AMPLITUDE_PX } from './living-dot-drift';
import { createScopeMorph, snapshotLandDots, scopeMorphLandOpacity, SCOPE_MORPH_PARTICLE_LIMIT, type MorphLand } from './scope-morph';

interface Props { countries:readonly WorldCountry[];context:ProjectionContext;frame:RouteBounds;pointer?:RefObject<ScenePointer>;reducedMotion:boolean;domestic?:boolean;active?:boolean;resetKey?:string;featherGeography?:boolean }
/** A bounded land mesh carries all dot levels; zooming changes uniforms, never geometry. */
export function WorldGeography({countries,context,frame,pointer,reducedMotion,domestic=false,active=true,resetKey='map',featherGeography=false}:Props){
  const invalidate=useThree(state=>state.invalidate);const get=useThree(state=>state.get);const uniforms=useThemeUniforms(invalidate);
  const [trail]=useState(createPointerTrail);
  const [morph]=useState(createScopeMorph);
  const [edgeFade]=useState(createMapEdgeFadeUniforms);
  const morphResources=useMemo(()=>{
    const geometry=new BufferGeometry();
    for(const [name,size] of [['position',3],['targetPosition',2],['endpointOpacity',2],['seed',1]] as const)geometry.setAttribute(name,new Float32BufferAttribute(new Float32Array(SCOPE_MORPH_PARTICLE_LIMIT*size),size).setUsage(DynamicDrawUsage));
    geometry.setDrawRange(0,0);
    const material=new ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,uniforms:{...uniforms,...edgeFade,morphProgress:{value:1},morphOpacity:{value:0},pointSize:{value:6}},vertexShader:morphVertex,fragmentShader:edgeFadeFragment+'\n'+morphFragment});
    return {geometry,material};
  },[uniforms,edgeFade]);
  const baseSpacing=domestic?DOMESTIC_DOT_BASE_SPACING:INTERNATIONAL_DOT_BASE_SPACING;
  const resources=useMemo(()=>{
    const borders=new BufferGeometry();borders.setAttribute('position',new Float32BufferAttribute(worldBorderPositions(countries,context),3));
    const land=new BufferGeometry();land.setAttribute('position',new Float32BufferAttribute(worldLandPositions(countries,context),3));
    const shared={...uniforms,...edgeFade,mapOpacity:{value:1},baseSpacing:{value:baseSpacing},latticeSpacings:{value:domestic?new Vector4(baseSpacing,baseSpacing/2,baseSpacing/4,baseSpacing/8):new Vector4(baseSpacing,baseSpacing/4,baseSpacing/16,baseSpacing/64)},gridOrigin:{value:new Vector2(domestic?44:-179,domestic?25:-59)},time:{value:0},dotDriftAmplitude:{value:0},unitsPerPixel:{value:1},levelWeights:{value:new Vector4(1,0,0,0)},centralLongitude:{value:context.centralLongitude},trailSamples:{value:trail.uniforms}};
    const options={transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:DoubleSide,vertexShader:worldVertex,fragmentShader:edgeFadeFragment+'\n'+livingDotDrift+'\n'+worldFragment};
    return {borders,land,borderMaterial:new ShaderMaterial({...options,uniforms:{...shared,layer:{value:0}}}),landMaterial:new ShaderMaterial({...options,uniforms:{...shared,layer:{value:1}}})};
  },[countries,context,uniforms,domestic,baseSpacing,trail,edgeFade]);
  const last=useRef(performance.now());const elapsed=useRef(0);
  const displayed=useRef<MorphLand|null>(null);
  const previousTarget=useRef('');
  useLayoutEffect(()=>{
    const next:MorphLand={positions:resources.land.getAttribute('position').array,context,domestic,frame,width:get().size.width,motion:{seconds:elapsed.current,amplitudePx:active&&!reducedMotion?LIVING_DOT_AMPLITUDE_PX:0}};
    const targetKey=`${domestic}:${context.centralLongitude}:${frame.x}:${frame.y}:${frame.width}:${frame.height}`;
    const previous=displayed.current;
    if(previous && !reducedMotion && (previous.domestic!==domestic || (morph.active() && targetKey!==previousTarget.current))){
      const blend=scopeMorphLandOpacity(morph.progress());
      const old=morph.active()?[
        ...morph.snapshot().map(point=>({...point,opacity:point.opacity*(1-blend)})),
        ...(blend>0?snapshotLandDots(previous).map(point=>({...point,opacity:point.opacity*blend})):[]),
      ].filter(point=>point.opacity>.001):snapshotLandDots(previous);
      const source=old.length>SCOPE_MORPH_PARTICLE_LIMIT?Array.from({length:SCOPE_MORPH_PARTICLE_LIMIT},(_,i)=>old[Math.floor(i*old.length/SCOPE_MORPH_PARTICLE_LIMIT)]!):old;
      const particles=morph.start(source,snapshotLandDots(next));
      const geometry=morphResources.geometry;
      particles.forEach((particle,index)=>{
        geometry.getAttribute('position').setXYZ(index,particle.from.x,particle.from.y,0);
        geometry.getAttribute('targetPosition').setXY(index,particle.to.x,particle.to.y);
        geometry.getAttribute('endpointOpacity').setXY(index,particle.from.opacity,particle.to.opacity);
        geometry.getAttribute('seed').setX(index,particle.seed);
      });
      Object.values(geometry.attributes).forEach(attribute=>{attribute.needsUpdate=true;});
      geometry.setDrawRange(0,particles.length);trail.clear();if(pointer)pointer.current.active=false;
    }
    if(reducedMotion)morph.advance(0,false,true);
    const progress=morph.progress(),blend=scopeMorphLandOpacity(progress);
    resources.landMaterial.uniforms['mapOpacity']!.value=blend;
    morphResources.material.uniforms['morphProgress']!.value=progress;
    morphResources.material.uniforms['morphOpacity']!.value=1-blend;
    displayed.current=next;previousTarget.current=targetKey;last.current=performance.now();invalidate();
  },[resources,morph,morphResources,context,domestic,frame.x,frame.y,frame.width,frame.height,reducedMotion,get,invalidate,trail,pointer]);
  useLayoutEffect(()=>{trail.clear();if(pointer)pointer.current.active=false;last.current=performance.now();invalidate();},[trail,context.centralLongitude,resetKey,reducedMotion,invalidate,pointer]);
  useLayoutEffect(()=>{
    last.current=performance.now();
    resources.landMaterial.uniforms['dotDriftAmplitude']!.value=active&&!reducedMotion?LIVING_DOT_AMPLITUDE_PX:0;
    resources.landMaterial.uniforms['time']!.value=elapsed.current;
    invalidate();
  },[active,reducedMotion,resources,invalidate]);
  useEffect(()=>{invalidate();return()=>{resources.borders.dispose();resources.land.dispose();resources.borderMaterial.dispose();resources.landMaterial.dispose();};},[resources,invalidate]);
  useEffect(()=>()=>{morphResources.geometry.dispose();morphResources.material.dispose();},[morphResources]);
  useFrame(()=>{
    updateMapEdgeFadeUniforms(edgeFade,get().size,featherGeography);
    const camera=get().camera as OrthographicCamera;
    const width=camera.isOrthographicCamera?(camera.right-camera.left)/camera.zoom:frame.width;
    const unit=width/Math.max(1,get().size.width);
    const values=resources.landMaterial.uniforms;
    const now=performance.now(),visibleSeconds=Math.max(0,(now-last.current)/1000),delta=Math.min(.05,visibleSeconds);last.current=now;
    const progress=morph.advance(delta*1000,active,reducedMotion),blend=scopeMorphLandOpacity(progress);
    values['mapOpacity']!.value=blend;
    morphResources.material.uniforms['morphProgress']!.value=progress;
    morphResources.material.uniforms['morphOpacity']!.value=1-blend;
    morphResources.material.uniforms['pointSize']!.value=6*get().gl.getPixelRatio();
    values['unitsPerPixel']!.value=unit;
    values['dotDriftAmplitude']!.value=active&&!reducedMotion?LIVING_DOT_AMPLITUDE_PX:0;
    (values['levelWeights']!.value as Vector4).set(...worldDotWeights(unit,baseSpacing,domestic?2:4));
    // The morph target snapshots this clock. Hold it until the particles arrive
    // so the stronger live float does not pull away from their landing points.
    if(active && !reducedMotion && !morph.active()){elapsed.current+=visibleSeconds;values['time']!.value=elapsed.current;}
    const radius=Math.min(POINTER_TRAIL_RADIUS_PX,get().size.width*.08,get().size.height*.1)*unit;
    trail.advance(delta*1000,pointer?.current,radius,{active,reducedMotion});
    displayed.current={positions:resources.land.getAttribute('position').array,context,domestic,frame:{x:camera.position.x,y:camera.position.y,width,height:camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:frame.height},width:get().size.width,motion:{seconds:elapsed.current,amplitudePx:active&&!reducedMotion?LIVING_DOT_AMPLITUDE_PX:0}};
  });
  return <group dispose={null}><mesh geometry={resources.land} material={resources.landMaterial} frustumCulled={false}/>{!domestic && <lineSegments geometry={resources.borders} material={resources.borderMaterial} frustumCulled={false}/>}<points name="scope-dot-morph" geometry={morphResources.geometry} material={morphResources.material} frustumCulled={false}/></group>;
}

export function StaticWorldGeography({countries,context,frame,domestic=false}:Omit<Props,'reducedMotion'>){
  const id=useId().replace(/:/g,'');
  const positions=useMemo(()=>worldBorderPositions(countries,context),[countries,context]);
  const land=useMemo(()=>worldLandPositions(countries,context),[countries,context]);
  const lines=[];for(let i=0;i<positions.length;i+=6)lines.push(`M${positions[i]},${-positions[i+1]!}L${positions[i+3]},${-positions[i+4]!}`);
  const polygons=[];for(let i=0;i<land.length;i+=9)polygons.push(`M${land[i]},${-land[i+1]!}L${land[i+3]},${-land[i+4]!}L${land[i+6]},${-land[i+7]!}Z`);
  const base=domestic?DOMESTIC_DOT_BASE_SPACING:INTERNATIONAL_DOT_BASE_SPACING;const ratio=domestic?2:4;const weights=worldDotWeights(frame.width/600,base,ratio);const spacings=[base,base/ratio,base/ratio**2,base/ratio**3];
  return <g data-world-geography={!domestic||undefined} data-map-geography aria-hidden="true"><defs><clipPath id={`land-${id}`}><path d={polygons.join(' ')}/></clipPath>{spacings.map((spacing,index)=><pattern key={index} id={`dots-${id}-${index}`} patternUnits="userSpaceOnUse" width={spacing} height={spacing} x={(domestic?44:-179)-context.centralLongitude-spacing/2} y={(domestic?-25:59)-spacing/2}><circle cx={spacing/2} cy={spacing/2} r={frame.width/450} fill="var(--scene-dot)" opacity=".65"/></pattern>)}</defs><g clipPath={`url(#land-${id})`}>{weights.map((weight,index)=>weight>0?<rect key={index} x={-180} y={-90} width={360} height={180} fill={`url(#dots-${id}-${index})`} opacity={weight}/>:null)}</g>{!domestic && <path d={lines.join(' ')} fill="none" stroke="var(--scene-dot)" strokeWidth=".7" vectorEffect="non-scaling-stroke" opacity=".32"/>}</g>;
}
