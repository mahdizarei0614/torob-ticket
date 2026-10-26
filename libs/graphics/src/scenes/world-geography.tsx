import { useMemo, useEffect, useLayoutEffect, useState, useRef, useId, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShaderMaterial, Vector2, Vector4, type OrthographicCamera } from 'three';
import { useThemeUniforms } from '../theme-uniforms';
import type { ProjectionContext, RouteBounds } from '../geo/projection';
import { DOMESTIC_DOT_BASE_SPACING, INTERNATIONAL_DOT_BASE_SPACING, worldDotWeights, worldLandPositions, worldBorderPositions, type WorldCountry } from '../geo/world-context';
import type { ScenePointer } from './scene-surface';
import { createPointerTrail, POINTER_TRAIL_RADIUS_PX } from './pointer-trail';
import worldVertex from '../shaders/world-context.vert.glsl?raw';
import worldFragment from '../shaders/world-context.frag.glsl?raw';

interface Props { countries:readonly WorldCountry[];context:ProjectionContext;frame:RouteBounds;pointer?:RefObject<ScenePointer>;reducedMotion:boolean;domestic?:boolean;active?:boolean;resetKey?:string }
/** A bounded land mesh carries all dot levels; zooming changes uniforms, never geometry. */
export function WorldGeography({countries,context,frame,pointer,reducedMotion,domestic=false,active=true,resetKey='map'}:Props){
  const invalidate=useThree(state=>state.invalidate);const get=useThree(state=>state.get);const uniforms=useThemeUniforms(invalidate);
  const [trail]=useState(createPointerTrail);
  const baseSpacing=domestic?DOMESTIC_DOT_BASE_SPACING:INTERNATIONAL_DOT_BASE_SPACING;
  const resources=useMemo(()=>{
    const borders=new BufferGeometry();borders.setAttribute('position',new Float32BufferAttribute(worldBorderPositions(countries,context),3));
    const land=new BufferGeometry();land.setAttribute('position',new Float32BufferAttribute(worldLandPositions(countries,context),3));
    const shared={...uniforms,baseSpacing:{value:baseSpacing},latticeSpacings:{value:domestic?new Vector4(baseSpacing,baseSpacing/2,baseSpacing/4,baseSpacing/8):new Vector4(baseSpacing,baseSpacing/4,baseSpacing/16,baseSpacing/64)},gridOrigin:{value:new Vector2(domestic?44:-179,domestic?25:-59)},time:{value:0},unitsPerPixel:{value:1},levelWeights:{value:new Vector4(1,0,0,0)},centralLongitude:{value:context.centralLongitude},trailSamples:{value:trail.uniforms}};
    const options={transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:DoubleSide,vertexShader:worldVertex,fragmentShader:worldFragment};
    return {borders,land,borderMaterial:new ShaderMaterial({...options,uniforms:{...shared,layer:{value:0}}}),landMaterial:new ShaderMaterial({...options,uniforms:{...shared,layer:{value:1}}})};
  },[countries,context,uniforms,domestic,baseSpacing,trail]);
  const last=useRef(performance.now());const elapsed=useRef(0);
  useLayoutEffect(()=>{trail.clear();if(pointer)pointer.current.active=false;last.current=performance.now();invalidate();},[trail,context.centralLongitude,resetKey,reducedMotion,invalidate,pointer]);
  useEffect(()=>{invalidate();return()=>{resources.borders.dispose();resources.land.dispose();resources.borderMaterial.dispose();resources.landMaterial.dispose();};},[resources,invalidate]);
  useFrame(()=>{
    const camera=get().camera as OrthographicCamera;
    const width=camera.isOrthographicCamera?(camera.right-camera.left)/camera.zoom:frame.width;
    const unit=width/Math.max(1,get().size.width);
    const values=resources.landMaterial.uniforms;
    const now=performance.now(),delta=Math.min(.05,Math.max(0,(now-last.current)/1000));last.current=now;
    values['unitsPerPixel']!.value=unit;
    (values['levelWeights']!.value as Vector4).set(...worldDotWeights(unit,baseSpacing,domestic?2:4));
    if(active && !reducedMotion){elapsed.current+=delta;values['time']!.value=elapsed.current;}
    const radius=Math.min(POINTER_TRAIL_RADIUS_PX,get().size.width*.08,get().size.height*.1)*unit;
    trail.advance(delta*1000,pointer?.current,radius,{active,reducedMotion});
  });
  return <group dispose={null}><mesh geometry={resources.land} material={resources.landMaterial} frustumCulled={false}/>{!domestic && <lineSegments geometry={resources.borders} material={resources.borderMaterial} frustumCulled={false}/>}</group>;
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
