import { BufferGeometry, Color, Float32BufferAttribute, FloatType, GLSL3, HalfFloatType, LinearFilter, Mesh, NearestFilter, NoBlending, NoColorSpace, OrthographicCamera, RawShaderMaterial, RGBAFormat, Scene, Vector2, Vector4, WebGLRenderTarget, type Texture, type WebGLRenderer } from 'three';
import vertexShader from './shaders/particle-flow-compute.vert.glsl?raw';
import fragmentShader from './shaders/particle-flow-compute.frag.glsl?raw';

export const PARTICLE_FLOW_MAX_EDGE=128;
export const PARTICLE_FLOW_PRESSURE_STEPS=6;
export interface FlowFrame {x:number;y:number;width:number;height:number}
export interface FlowViewport {width:number;height:number}
export interface FlowStep {frame:FlowFrame;viewport:FlowViewport;pointer?:{x:number;y:number;active:boolean};active:boolean;reducedMotion:boolean}
export interface FlowSnapshot {data:Float32Array;dims:{width:number;height:number};frame:FlowFrame;viewport:FlowViewport}
type Field='state'|'velocity'|'curl'|'divergence'|'pressure';
type Pair={read:WebGLRenderTarget;write:WebGLRenderTarget};
interface Fields {width:number;height:number;velocity:Pair;state:Pair;pressure:Pair;curl:WebGLRenderTarget;divergence:WebGLRenderTarget}
const swap=(pair:Pair)=>{const target=pair.read;pair.read=pair.write;pair.write=target;};
const targets=(fields:Fields)=>[fields.velocity.read,fields.velocity.write,fields.state.read,fields.state.write,fields.pressure.read,fields.pressure.write,fields.curl,fields.divergence];
const valid=(frame:FlowFrame,viewport:FlowViewport)=>[frame.x,frame.y,frame.width,frame.height,viewport.width,viewport.height].every(Number.isFinite)&&frame.width>0&&frame.height>0&&viewport.width>0&&viewport.height>0;
/** Tiny real fluid/particle compute passes on the app renderer; no scheduler/readback loop. */
export function createMapParticleFlow(renderer:WebGLRenderer){
 const uniforms={particleFlowState:{value:null as Texture|null},particleFlowFrame:{value:new Vector4(0,0,1,1)},particleFlowViewport:{value:new Vector2(1,1)},particleFlowActive:{value:0}};
 const context=renderer.getContext();
 let supported=Boolean(context.getExtension('EXT_color_buffer_float'))&&Number(context.getParameter(context.MAX_TEXTURE_SIZE))>=PARTICLE_FLOW_MAX_EDGE;
 let reason=supported?'ready':'float-targets-unavailable',disposed=false,lost=false,listening=false;
 let fields:Fields|undefined,snapshotTarget:WebGLRenderTarget|undefined;
 const retiredFields=new Set<Fields>();
 let frame:FlowFrame={x:0,y:0,width:1,height:1},viewport:FlowViewport={width:1,height:1};
 let lastPointer:{x:number;y:number}|undefined,draws=0,steps=0,snapshots=0,resets=0,quietSeconds=0,energized=false;
 let geometry:BufferGeometry|undefined,material:RawShaderMaterial|undefined,scene:Scene|undefined;
 const camera=new OrthographicCamera(-1,1,1,-1,0,1);
 const contextLost=(event?:Event)=>{event?.preventDefault();lost=true;uniforms.particleFlowActive.value=0;lastPointer=undefined;};
 const attachContext=()=>{if(listening||!renderer.domElement)return;renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextLost);listening=true;};
 const detachContext=()=>{if(!listening)return;renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextLost);listening=false;};
 const makeTarget=(width:number,height:number,float=false)=>{
  const target=new WebGLRenderTarget(width,height,{type:float?FloatType:HalfFloatType,format:RGBAFormat,minFilter:float?NearestFilter:LinearFilter,magFilter:float?NearestFilter:LinearFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
  target.texture.colorSpace=NoColorSpace;return target;
 };
 const makeFields=(width:number,height:number):Fields=>({width,height,velocity:{read:makeTarget(width,height),write:makeTarget(width,height)},state:{read:makeTarget(width,height),write:makeTarget(width,height)},pressure:{read:makeTarget(width,height),write:makeTarget(width,height)},curl:makeTarget(width,height),divergence:makeTarget(width,height)});
 function preserve<T>(work:()=>T):T{
  const target=renderer.getRenderTarget();
  const defaultViewport=target?undefined:renderer.getViewport(new Vector4()),defaultScissor=target?undefined:renderer.getScissor(new Vector4()),defaultScissorTest=target?false:renderer.getScissorTest();
  // Compute never mutates the renderer's logical viewport/scissor. Target
  // binding uses physical target rectangles, independently of device DPR.
  const physicalViewport=target?renderer.getCurrentViewport(new Vector4()):undefined;
  const physicalScissor=target?new Vector4().fromArray(context.getParameter(context.SCISSOR_BOX) as Int32Array):undefined;
  const physicalScissorTest=target?context.isEnabled(context.SCISSOR_TEST):false;
  const autoClear=renderer.autoClear,clearColor=renderer.getClearColor(new Color()),clearAlpha=renderer.getClearAlpha(),xr=renderer.xr.enabled;
  const cubeFace=renderer.getActiveCubeFace?.()??0,mipmap=renderer.getActiveMipmapLevel?.()??0;
  const debug=renderer.debug,shaderError=debug?.onShaderError,checkShaderErrors=debug?.checkShaderErrors;
  try{if(debug){debug.checkShaderErrors=true;debug.onShaderError=()=>{throw Error('gpu-flow-shader-compile');};}renderer.xr.enabled=false;renderer.autoClear=false;return work();}
  finally{
   if(debug){debug.onShaderError=shaderError!;debug.checkShaderErrors=checkShaderErrors!;}
   if(target){
    const configuredViewport=target.viewport.clone(),configuredScissor=target.scissor.clone(),configuredTest=target.scissorTest;
    try{target.viewport.copy(physicalViewport!);target.scissor.copy(physicalScissor!);target.scissorTest=physicalScissorTest;renderer.setRenderTarget(target,cubeFace,mipmap);}
    finally{target.viewport.copy(configuredViewport);target.scissor.copy(configuredScissor);target.scissorTest=configuredTest;}
   }else{renderer.setRenderTarget(null,cubeFace,mipmap);renderer.setViewport(defaultViewport!);renderer.setScissor(defaultScissor!);renderer.setScissorTest(defaultScissorTest);}
   renderer.autoClear=autoClear;renderer.setClearColor(clearColor,clearAlpha);renderer.xr.enabled=xr;
  }
 }
 function clearTarget(target:WebGLRenderTarget){renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear(true,false,false);}
 function initialize(){
  if(material)return;
  geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  material=new RawShaderMaterial({glslVersion:GLSL3,vertexShader,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false,blending:NoBlending,uniforms:{operation:{value:0},inputA:{value:null},inputB:{value:null},inputC:{value:null},texel:{value:new Vector2()},viewport:{value:new Vector2()},previousViewport:{value:new Vector2()},frame:{value:new Vector4()},previousFrame:{value:new Vector4()},stroke:{value:new Vector4()},strokeVelocity:{value:new Vector2()},strokeRadius:{value:110},dt:{value:0}}});
  const quad=new Mesh(geometry,material);quad.frustumCulled=false;scene=new Scene();scene.add(quad);
 }
 function draw(operation:number,target:WebGLRenderTarget,a?:Texture,b?:Texture){
  const values=material!.uniforms;values['operation']!.value=operation;values['inputA']!.value=a??null;values['inputB']!.value=b??null;
  renderer.setRenderTarget(target);renderer.render(scene!,camera);draws++;
 }
 function fail(error:unknown){detachContext();if(fields){targets(fields).forEach(target=>target.dispose());fields=undefined;}snapshotTarget?.dispose();snapshotTarget=undefined;geometry?.dispose();geometry=undefined;material?.dispose();material=undefined;scene?.clear();scene=undefined;supported=false;reason=error instanceof Error?`gpu-flow-failed:${error.message}`:'gpu-flow-failed';uniforms.particleFlowActive.value=0;uniforms.particleFlowState.value=null;lastPointer=undefined;energized=false;quietSeconds=0;}
 function clear(){if(fields)targets(fields).forEach(clearTarget);lastPointer=undefined;uniforms.particleFlowActive.value=0;quietSeconds=0;energized=false;resets++;}
 return {
  uniforms,
  step(deltaMs:number,options:FlowStep){
   if(disposed||!supported)return;
   attachContext();
   if(context.isContextLost()){contextLost();return;}
   if(options.reducedMotion){try{if(energized||(lost&&fields))preserve(clear);else{lastPointer=undefined;uniforms.particleFlowActive.value=0;}lost=false;}catch(error){fail(error);}return;}
   if(!options.active){lastPointer=undefined;return;}
   if(!valid(options.frame,options.viewport))return;
   try{preserve(()=>{
    if(lost){clear();lost=false;}
    const dt=Math.max(0,Math.min(.0333333333,deltaMs/1000));if(dt<=0)return;
    const pointer=options.pointer?.active&&Number.isFinite(options.pointer.x)&&Number.isFinite(options.pointer.y)?options.pointer:undefined;
    const to=pointer??lastPointer??{x:options.frame.x,y:options.frame.y},from=lastPointer??to;
    const unit=options.frame.width/options.viewport.width;
    const dx=(to.x-from.x)/unit,dy=(to.y-from.y)/unit,length=Math.hypot(dx,dy),factor=pointer&&length>.25?Math.min(1,1800*dt/length):0;
    lastPointer=pointer?{x:pointer.x,y:pointer.y}:undefined;
    if(factor>0){energized=true;quietSeconds=0;}else quietSeconds+=dt;
    // No fluid work before a real stroke, or once its verified subpixel tail ends.
    if(!energized||quietSeconds>=18){if(energized)clear();uniforms.particleFlowActive.value=0;frame={...options.frame};viewport={...options.viewport};return;}
    initialize();
    const ratio=Math.min(1,PARTICLE_FLOW_MAX_EDGE/Math.max(options.viewport.width,options.viewport.height));
    const width=Math.max(16,Math.round(options.viewport.width*ratio)),height=Math.max(16,Math.round(options.viewport.height*ratio));
    const previous=fields;
    if(!fields||fields.width!==width||fields.height!==height){fields=makeFields(width,height);if(previous)retiredFields.add(previous);targets(fields).forEach(clearTarget);}
    const current=fields,source=previous??current,values=material!.uniforms;
    values['texel']!.value.set(1/width,1/height);values['viewport']!.value.set(options.viewport.width,options.viewport.height);
    values['previousViewport']!.value.set(viewport.width,viewport.height);
    values['frame']!.value.set(options.frame.x,options.frame.y,options.frame.width,options.frame.height);
    values['previousFrame']!.value.set(frame.x,frame.y,frame.width,frame.height);
    values['dt']!.value=dt;
    values['stroke']!.value.set(.5+(from.x-options.frame.x)/options.frame.width,.5+(from.y-options.frame.y)/options.frame.height,.5+(to.x-options.frame.x)/options.frame.width,.5+(to.y-options.frame.y)/options.frame.height);
    values['strokeVelocity']!.value.set(dx/dt*factor,dy/dt*factor);
    values['strokeRadius']!.value=Math.min(110,options.viewport.width*.2,options.viewport.height*.22);
    draw(0,current.velocity.write,source.velocity.read.texture);swap(current.velocity);
    draw(1,current.curl,current.velocity.read.texture);
    draw(2,current.velocity.write,current.velocity.read.texture,current.curl.texture);swap(current.velocity);
    draw(3,current.divergence,current.velocity.read.texture);
    clearTarget(current.pressure.read);
    for(let i=0;i<PARTICLE_FLOW_PRESSURE_STEPS;i++){draw(4,current.pressure.write,current.pressure.read.texture,current.divergence.texture);swap(current.pressure);}
    draw(5,current.velocity.write,current.velocity.read.texture,current.pressure.read.texture);swap(current.velocity);
    draw(6,current.state.write,source.state.read.texture,current.velocity.read.texture);swap(current.state);
    frame={...options.frame};viewport={...options.viewport};
    uniforms.particleFlowState.value=current.state.read.texture;uniforms.particleFlowFrame.value.set(frame.x,frame.y,frame.width,frame.height);uniforms.particleFlowViewport.value.set(viewport.width,viewport.height);uniforms.particleFlowActive.value=1;steps++;
   });}catch(error){fail(error);}finally{retiredFields.forEach(old=>targets(old).forEach(target=>target.dispose()));retiredFields.clear();}
  },
  /** Explicit interruption/debug checkpoint only. The animation path never reads pixels. */
  snapshot(field:Field='state'):FlowSnapshot|undefined{
   if(disposed||!supported||!fields||lost||context.isContextLost())return;
   try{return preserve(()=>{
    if(!snapshotTarget||snapshotTarget.width!==fields!.width||snapshotTarget.height!==fields!.height){snapshotTarget?.dispose();snapshotTarget=makeTarget(fields!.width,fields!.height,true);}
    const selected=fields![field],source='read' in selected?selected.read:selected;
    draw(7,snapshotTarget,source.texture);
    const data=new Float32Array(fields!.width*fields!.height*4);renderer.readRenderTargetPixels(snapshotTarget,0,0,fields!.width,fields!.height,data);snapshots++;
    return{data,dims:{width:fields!.width,height:fields!.height},frame:{...frame},viewport:{...viewport}};
   });}catch(error){fail(error);return;}
  },
  inspect(){return{supported,reason,disposed,contextListeners:listening,width:fields?.width??0,height:fields?.height??0,steps,draws,snapshots,resets,quietSeconds,energized,targets:fields?8+(snapshotTarget?1:0):0,bytes:fields?fields.width*fields.height*(8*8+(snapshotTarget?16:0)):0};},
  dispose(){if(disposed)return;disposed=true;detachContext();if(fields)targets(fields).forEach(target=>target.dispose());snapshotTarget?.dispose();geometry?.dispose();material?.dispose();scene?.clear();fields=undefined;snapshotTarget=undefined;uniforms.particleFlowState.value=null;uniforms.particleFlowActive.value=0;lastPointer=undefined;},
 };
}
export type MapParticleFlow=ReturnType<typeof createMapParticleFlow>;
