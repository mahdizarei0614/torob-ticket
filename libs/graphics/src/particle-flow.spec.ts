import {afterEach,expect,it,vi} from 'vitest';
import {Color,Vector4,type WebGLRenderer,WebGLRenderTarget,type RawShaderMaterial} from 'three';
import {createMapParticleFlow} from './particle-flow';
const observed=vi.hoisted(()=>({targets:[] as WebGLRenderTarget[]}));
vi.mock('three',async original=>{const actual=await original<typeof import('three')>();return{...actual,WebGLRenderTarget:class extends actual.WebGLRenderTarget{constructor(...args:ConstructorParameters<typeof actual.WebGLRenderTarget>){super(...args);observed.targets.push(this);}}};});
afterEach(()=>{observed.targets.length=0;vi.restoreAllMocks();});
function harness(supported=true){
 const state={target:null as WebGLRenderTarget|null,viewport:new Vector4(8,9,120,130),scissor:new Vector4(1,2,30,40),scissorTest:true,color:new Color(.1,.2,.3),alpha:.4,lost:false};
 const originalShaderError=vi.fn();
 const renderer={domElement:document.createElement('canvas'),debug:{onShaderError:originalShaderError as (()=>void)|null,checkShaderErrors:false},xr:{enabled:true},autoClear:true,
  getContext:()=>({getExtension:()=>supported?{}:null,getParameter:(parameter:number)=>parameter===2?[3,4,50,60]:2048,MAX_TEXTURE_SIZE:1,SCISSOR_BOX:2,SCISSOR_TEST:3,isEnabled:()=>true,isContextLost:()=>state.lost}),
  getRenderTarget:()=>state.target,setRenderTarget:vi.fn((value:WebGLRenderTarget|null)=>{state.target=value;}),
  getCurrentViewport:(value:Vector4)=>value.copy(state.viewport),getViewport:(value:Vector4)=>value.copy(state.viewport),setViewport:vi.fn((value:Vector4|number,y?:number,z?:number,w?:number)=>{if(typeof value==='number')state.viewport.set(value,y!,z!,w!);else state.viewport.copy(value);}),
  getScissor:(value:Vector4)=>value.copy(state.scissor),setScissor:vi.fn((value:Vector4)=>state.scissor.copy(value)),
  getScissorTest:()=>state.scissorTest,setScissorTest:vi.fn((value:boolean)=>{state.scissorTest=value;}),
  getClearColor:(value:Color)=>value.copy(state.color),getClearAlpha:()=>state.alpha,setClearColor:vi.fn((value:Color|number,alpha:number)=>{state.color.set(value);state.alpha=alpha;}),
  clear:vi.fn(),render:vi.fn(),readRenderTargetPixels:vi.fn((_target:unknown,_x:number,_y:number,_w:number,_h:number,data:Float32Array)=>{data.fill(.125);}),
 };
 const before=()=>({target:state.target,viewport:state.viewport.toArray(),scissor:state.scissor.toArray(),scissorTest:state.scissorTest,color:state.color.toArray(),alpha:state.alpha,autoClear:renderer.autoClear,xr:renderer.xr.enabled,onShaderError:renderer.debug.onShaderError,checkShaderErrors:renderer.debug.checkShaderErrors});
 return{renderer:renderer as unknown as WebGLRenderer,mock:renderer,state,before};
}
const options={frame:{x:54,y:32,width:22,height:24},viewport:{width:580,height:634},pointer:{x:54,y:32,active:true},active:true,reducedMotion:false};
const stroke={...options,pointer:{x:55,y:32.5,active:true}};
const seed=(flow:ReturnType<typeof createMapParticleFlow>)=>{flow.step(16,options);flow.step(16,stroke);};
it('capability-gates before any floating target allocations and never starts a timer',()=>{
 const h=harness(false),flow=createMapParticleFlow(h.renderer);flow.step(16,options);expect(observed.targets).toEqual([]);expect(flow.uniforms.particleFlowState.value).toBeNull();expect(flow.inspect().supported).toBe(false);expect(h.mock.render).not.toHaveBeenCalled();expect(flow.snapshot()).toBeUndefined();flow.dispose();
});
it('uses bounded actual compute passes, preserves renderer state and never reads pixels on the animation path',()=>{
 const h=harness(),initial=h.before(),flow=createMapParticleFlow(h.renderer);seed(flow);flow.step(16,{...options,pointer:{x:55.2,y:32.5,active:true}});
 expect(h.before()).toEqual(initial);expect(flow.inspect()).toMatchObject({steps:2,draws:24,snapshots:0,targets:8,width:117,height:128});
 expect(flow.inspect().bytes).toBeLessThanOrEqual(128*128*64);expect(observed.targets).toHaveLength(8);expect(h.mock.readRenderTargetPixels).not.toHaveBeenCalled();
 expect(flow.uniforms.particleFlowFrame.value.toArray()).toEqual([54,32,22,24]);expect(flow.uniforms.particleFlowViewport.value.toArray()).toEqual([580,634]);flow.dispose();
});
it('pauses without writes, settles reduced motion without snapshots, and avoids a resumed pointer jump',()=>{
 const h=harness(),flow=createMapParticleFlow(h.renderer);seed(flow);const draws=h.mock.render.mock.calls.length,clears=h.mock.clear.mock.calls.length;
 flow.step(10000,{...options,active:false});expect(h.mock.render).toHaveBeenCalledTimes(draws);expect(h.mock.clear).toHaveBeenCalledTimes(clears);
 const strokes:number[][]=[];h.mock.render.mockImplementation(scene=>{const material=scene.children[0]!.material as RawShaderMaterial;if(material.uniforms['operation']!.value===0)strokes.push(material.uniforms['strokeVelocity']!.value.toArray());});
 flow.step(16,{...options,pointer:{x:60,y:38,active:true}});expect(strokes[0]).toEqual([0,0]);
 flow.step(16,{...options,active:false,reducedMotion:true});expect(flow.uniforms.particleFlowActive.value).toBe(0);expect(h.mock.clear.mock.calls.length).toBeGreaterThan(clears);expect(h.mock.readRenderTargetPixels).not.toHaveBeenCalled();flow.dispose();
});
it('makes one explicit Float32 snapshot and releases resized and final targets exactly once',()=>{
 const h=harness(),flow=createMapParticleFlow(h.renderer);seed(flow);const first=observed.targets.map(target=>vi.spyOn(target,'dispose'));
 const snapshot=flow.snapshot();expect(snapshot?.dims).toEqual({width:117,height:128});expect(snapshot?.data[0]).toBe(.125);expect(h.mock.readRenderTargetPixels).toHaveBeenCalledOnce();expect(flow.inspect().snapshots).toBe(1);
 flow.step(16,{...options,viewport:{width:1000,height:500}});first.forEach(dispose=>expect(dispose).toHaveBeenCalledOnce());
 const remaining=observed.targets.slice(8).map(target=>vi.spyOn(target,'dispose'));flow.dispose();flow.dispose();first.forEach(dispose=>expect(dispose).toHaveBeenCalledOnce());remaining.forEach(dispose=>expect(dispose).toHaveBeenCalledOnce());expect(flow.inspect().targets).toBe(0);
});
it('restores the shared renderer even when a compute draw fails and leaves a static fallback',()=>{
 const h=harness(),initial=h.before(),flow=createMapParticleFlow(h.renderer);flow.step(16,options);h.mock.render.mockImplementationOnce(()=>{throw Error('fixture draw failed');});flow.step(16,stroke);
 expect(h.before()).toEqual(initial);expect(flow.inspect().supported).toBe(false);expect(flow.uniforms.particleFlowActive.value).toBe(0);expect(flow.inspect().reason).toContain('fixture draw failed');flow.dispose();
});
it('does not issue GPU work while context is lost and clears invalid restored simulation data',()=>{
 const h=harness(),flow=createMapParticleFlow(h.renderer);seed(flow);const count=h.mock.render.mock.calls.length;h.state.lost=true;flow.step(16,options);expect(h.mock.render).toHaveBeenCalledTimes(count);expect(flow.snapshot()).toBeUndefined();h.state.lost=false;flow.step(16,options);expect(flow.inspect().resets).toBe(1);expect(flow.uniforms.particleFlowActive.value).toBe(0);flow.dispose();
});

it('converts an actual Three shader-error callback into local fallback and restores the shared error hook',()=>{
 const h=harness(),initial=h.before(),flow=createMapParticleFlow(h.renderer);flow.step(16,options);h.mock.render.mockImplementationOnce(()=>h.mock.debug.onShaderError?.());flow.step(16,stroke);
 expect(h.before()).toEqual(initial);expect(flow.inspect().supported).toBe(false);expect(flow.inspect().targets).toBe(0);expect(flow.inspect().reason).toContain('gpu-flow-shader-compile');flow.dispose();
});
it('releases both prior and newly allocated fields if a resized compute fails',()=>{
 const h=harness(),flow=createMapParticleFlow(h.renderer);seed(flow);
 const previous=observed.targets.map(target=>vi.spyOn(target,'dispose'));
 h.mock.render.mockImplementationOnce(()=>{throw Error('resized draw failure');});
 flow.step(16,{...options,viewport:{width:1000,height:500}});
 previous.forEach(dispose=>expect(dispose).toHaveBeenCalledOnce());expect(flow.inspect().targets).toBe(0);expect(flow.inspect().supported).toBe(false);flow.dispose();previous.forEach(dispose=>expect(dispose).toHaveBeenCalledOnce());
});

it('keeps the never-interacted field allocation-free and sleeps after its bounded quiet tail',()=>{
 const h=harness(),flow=createMapParticleFlow(h.renderer);
 for(let i=0;i<120;i++)flow.step(16,options);expect(observed.targets).toHaveLength(0);expect(h.mock.render).not.toHaveBeenCalled();expect(flow.uniforms.particleFlowActive.value).toBe(0);
 flow.step(16,stroke);expect(flow.inspect().energized).toBe(true);
 for(let i=0;i<1130;i++)flow.step(16,{...options,pointer:undefined});
 const draws=h.mock.render.mock.calls.length;expect(flow.inspect().energized).toBe(false);expect(flow.uniforms.particleFlowActive.value).toBe(0);flow.step(16,options);expect(h.mock.render).toHaveBeenCalledTimes(draws);expect(h.mock.readRenderTargetPixels).not.toHaveBeenCalled();flow.dispose();
});

it('preserves a bound target physical viewport/scissor without changing its configured rectangles',()=>{
 const h=harness(),sentinel=new WebGLRenderTarget(90,80);sentinel.viewport.set(0,0,90,80);sentinel.scissor.set(0,0,90,80);h.state.target=sentinel;
 const initial=h.before(),flow=createMapParticleFlow(h.renderer);seed(flow);expect(h.before()).toEqual(initial);expect(sentinel.viewport.toArray()).toEqual([0,0,90,80]);expect(sentinel.scissor.toArray()).toEqual([0,0,90,80]);expect(h.mock.setViewport).not.toHaveBeenCalled();expect(h.mock.setScissor).not.toHaveBeenCalled();expect(h.mock.setScissorTest).not.toHaveBeenCalled();flow.dispose();sentinel.dispose();
});

it('observes loss/restoration even when the shared scheduler never steps during the lost interval',()=>{
 const h=harness(),add=vi.spyOn(h.mock.domElement,'addEventListener'),remove=vi.spyOn(h.mock.domElement,'removeEventListener'),flow=createMapParticleFlow(h.renderer);
 expect(add).not.toHaveBeenCalled();seed(flow);expect(add).toHaveBeenCalledTimes(2);const draws=h.mock.render.mock.calls.length;
 h.mock.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));h.mock.domElement.dispatchEvent(new Event('webglcontextrestored'));
 expect(flow.snapshot()).toBeUndefined();expect(h.mock.readRenderTargetPixels).not.toHaveBeenCalled();flow.step(16,options);
 expect(flow.inspect().resets).toBe(1);expect(h.mock.render).toHaveBeenCalledTimes(draws);expect(flow.uniforms.particleFlowActive.value).toBe(0);flow.step(16,stroke);expect(h.mock.render.mock.calls.length).toBeGreaterThan(draws);
 flow.dispose();flow.dispose();expect(remove).toHaveBeenCalledTimes(2);expect(flow.inspect().contextListeners).toBe(false);
});
