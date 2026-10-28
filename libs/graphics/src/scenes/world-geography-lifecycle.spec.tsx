import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OrthographicCamera, type ShaderMaterial, type BufferGeometry } from 'three';
import type { WorldCountry } from '../geo/world-context';
import { WorldGeography } from './world-geography';
import { sampleVisibleMorphParticle, type MorphParticle, type LiveMorphDot } from './scope-morph';

const observed = vi.hoisted(() => ({ materials: [] as ShaderMaterial[], geometries: [] as BufferGeometry[], invalidate: vi.fn(), get: vi.fn(), frames: [] as (()=>void)[], uniforms: { dot: { value: null }, highlight: { value: null } } }));
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>();
  return { ...actual,
    ShaderMaterial: class extends actual.ShaderMaterial { constructor(...args: ConstructorParameters<typeof actual.ShaderMaterial>) { super(...args); observed.materials.push(this); } },
    BufferGeometry: class extends actual.BufferGeometry { constructor() { super(); observed.geometries.push(this); } },
  };
});
vi.mock('@react-three/fiber', () => ({ useThree: (selector: (state: { invalidate: typeof observed.invalidate; get: typeof observed.get }) => unknown) => selector({ invalidate: observed.invalidate, get: observed.get }), useFrame: (callback:()=>void)=>{observed.frames.push(callback);} }));
vi.mock('../theme-uniforms', () => ({ useThemeUniforms: () => observed.uniforms }));
const first: readonly WorldCountry[] = [{ geometry: { type: 'Polygon', coordinates: [[[44, 25], [63, 25], [63, 40], [44, 40], [44, 25]]] } }];
const second: readonly WorldCountry[] = [{ geometry: { type: 'Polygon', coordinates: [[[-20, -20], [40, -20], [40, 50], [-20, 50], [-20, -20]]] } }];
beforeEach(() => { observed.materials.length = 0; observed.geometries.length = 0; observed.frames.length=0; observed.get.mockReturnValue({ size: { width: 600, height: 400 } }); });
afterEach(() => vi.restoreAllMocks());

it('retains compiled material owners through scope/projection changes while releasing replaced geography and updating uniforms', () => {
  // DOM does not render R3F nodes; this checks real Three resource lifetimes only.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const frame = { x: 54, y: 33, width: 22, height: 17 };
  const view = render(<WorldGeography countries={first} context={{ centralLongitude: 0 }} frame={frame} domestic reducedMotion={false} />);
  expect(observed.materials).toHaveLength(3);
  const [morph, border, land] = observed.materials;
  const disposed = observed.materials.map(material => vi.spyOn(material, 'dispose'));
  const oldGeography = observed.geometries.slice(1).map(geometry => vi.spyOn(geometry, 'dispose'));
  view.rerender(<WorldGeography countries={second} context={{ centralLongitude: 20 }} frame={{ x: 0, y: 15, width: 360, height: 160 }} reducedMotion={false} />);
  expect(observed.materials).toEqual([morph, border, land]);
  disposed.forEach(dispose => expect(dispose).not.toHaveBeenCalled()); oldGeography.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
  expect(land!.uniforms['baseSpacing']!.value).toBe(4); expect(land!.uniforms['latticeSpacings']!.value.toArray()).toEqual([4, 1, .25, .0625]);
  expect(land!.uniforms['gridOrigin']!.value.toArray()).toEqual([-179, -59]); expect(land!.uniforms['centralLongitude']!.value).toBe(20);
  view.rerender(<WorldGeography countries={first} context={{ centralLongitude: 54 }} frame={frame} domestic reducedMotion={false} />);
  expect(observed.materials).toEqual([morph, border, land]); disposed.forEach(dispose => expect(dispose).not.toHaveBeenCalled());
  expect(land!.uniforms['baseSpacing']!.value).toBe(.44); expect(land!.uniforms['gridOrigin']!.value.toArray()).toEqual([44, 25]); expect(land!.uniforms['centralLongitude']!.value).toBe(54);
  view.unmount(); disposed.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
});


it('interrupts from the actually displayed live frame before a changed projection rebases shared uniforms',()=>{
  vi.spyOn(console,'error').mockImplementation(()=>undefined);
  let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
  const camera=new OrthographicCamera(-15,15,10,-10,.1,1000);camera.position.set(55,32,200);
  observed.get.mockReturnValue({size:{width:600,height:400},camera,gl:{getPixelRatio:()=>1}});
  const pointer={current:{x:55,y:32,active:false}};
  const view=render(<WorldGeography countries={first} context={{centralLongitude:0}} frame={{x:55,y:32,width:30,height:20}} domestic pointer={pointer} reducedMotion={false}/>);
  const tick=()=>{clock+=16;observed.frames.at(-1)!();};
  for(let i=0;i<100;i++)tick();
  view.rerender(<WorldGeography countries={second} context={{centralLongitude:0}} frame={{x:0,y:15,width:360,height:240}} pointer={pointer} reducedMotion={false}/>);
  pointer.current.active=true;pointer.current.x=55;pointer.current.y=32;
  for(let i=0;i<110;i++)tick();
  const morphMaterial=observed.materials[0]!,geometry=observed.geometries[0]!;
  const uniforms=morphMaterial.uniforms;
  const motion={seconds:uniforms['time']!.value as number,width:600,height:400,unit:uniforms['unitsPerPixel']!.value as number,centralLongitude:0,frame:{x:55,y:32,width:30,height:20},pointer:Float32Array.from(uniforms['pointerField']!.value as Float32Array)};
  const progress=uniforms['morphProgress']!.value as number;
  expect(motion.pointer[3]).toBeGreaterThan(.9);expect(progress).toBeGreaterThan(.3);expect(progress).toBeLessThan(.5);
  const particles:MorphParticle[]=[];
  const fromAttr=geometry.getAttribute('position'),toAttr=geometry.getAttribute('targetPosition'),opacity=geometry.getAttribute('endpointOpacity');
  const live=(name:string,index:number,baseX:number,baseY:number,alpha:number):LiveMorphDot|undefined=>{
    const attr=geometry.getAttribute(name),amplitudePx=attr.getZ(index);if(amplitudePx<0)return;
    const spacing=attr.getW(index);
    return {anchorX:attr.getX(index),anchorY:attr.getY(index),amplitudePx,spacingPx:name==='sourceAnchor'?spacing:spacing/motion.unit,spacingWorld:name==='sourceAnchor'?spacing*motion.unit:spacing,baseX,baseY,opacity:alpha};
  };
  for(let i=0;i<geometry.drawRange.count;i++)particles.push({from:{x:fromAttr.getX(i),y:fromAttr.getY(i),opacity:opacity.getX(i),live:live('sourceAnchor',i,fromAttr.getX(i),fromAttr.getY(i),opacity.getX(i))},to:{x:toAttr.getX(i),y:toAttr.getY(i),opacity:opacity.getY(i),live:live('targetAnchor',i,toAttr.getX(i),toAttr.getY(i),opacity.getY(i))},seed:geometry.getAttribute('seed').getX(i)});
  const visible=particles.map(p=>sampleVisibleMorphParticle(p,progress,motion)).filter(p=>p.opacity>.001);
  expect(visible.length).toBeGreaterThan(50);
  view.rerender(<WorldGeography countries={second} context={{centralLongitude:80}} frame={{x:-80,y:15,width:360,height:240}} pointer={pointer} reducedMotion={false}/>);
  // The first preserved source belongs to the old visible morph, not its new
  // projection. Compare actual uploaded GPU attributes, not a duplicate helper.
  const newSource=geometry.getAttribute('position');
  expect(newSource.getX(0)).toBeCloseTo(visible[0]!.x,5);expect(newSource.getY(0)).toBeCloseTo(visible[0]!.y,5);
  expect(geometry.getAttribute('endpointOpacity').getX(0)).toBeCloseTo(visible[0]!.opacity,5);
  expect(geometry.getAttribute('sourceAnchor').getZ(0)).toBeLessThan(-1.5);
  expect(geometry.getAttribute('sourceAnchor').getW(0)).toBeCloseTo(motion.seconds,5);
  expect(uniforms['centralLongitude']!.value).toBe(80);
  view.unmount();
});


it('freezes a covered live field in place and resumes its same bounded clock without resetting amplitude',()=>{
  vi.spyOn(console,'error').mockImplementation(()=>undefined);
  let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
  const camera=new OrthographicCamera(-15,15,10,-10,.1,1000);camera.position.set(55,32,200);
  observed.get.mockReturnValue({size:{width:600,height:400},camera,gl:{getPixelRatio:()=>1}});
  const pointer={current:{x:55,y:32,active:false}},context={centralLongitude:0},frame={x:55,y:32,width:30,height:20};
  const view=render(<WorldGeography countries={first} context={context} frame={frame} domestic pointer={pointer} reducedMotion={false}/>);
  pointer.current.active=true;
  const tick=()=>{clock+=16;observed.frames.at(-1)!();};for(let i=0;i<100;i++)tick();
  const land=observed.materials[2]!,seconds=land.uniforms['time']!.value,field=Float32Array.from(land.uniforms['pointerField']!.value);
  view.rerender(<WorldGeography countries={first} context={context} frame={frame} domestic pointer={pointer} active={false} reducedMotion={false}/>);
  for(let i=0;i<20;i++)tick();
  expect(land.uniforms['dotDriftAmplitude']!.value).toBe(9);expect(land.uniforms['time']!.value).toBe(seconds);expect(land.uniforms['pointerField']!.value).toEqual(field);
  view.rerender(<WorldGeography countries={first} context={context} frame={frame} domestic pointer={pointer} active reducedMotion={false}/>);tick();
  expect(land.uniforms['time']!.value).toBeCloseTo(seconds+.016,8);
  view.rerender(<WorldGeography countries={first} context={context} frame={frame} domestic pointer={pointer} reducedMotion/>);
  expect(land.uniforms['dotDriftAmplitude']!.value).toBe(0);expect([...land.uniforms['pointerField']!.value]).toEqual([0,0,0,0]);view.unmount();
});
