import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const out=process.env.VEHICLE_FOREGROUND_EVIDENCE_DIR??'docs/evidence/adjustments/route-direction-halo/vehicle-foreground-native';
type Draw='route'|'bloom'|'vehicle';
interface DrawReceipt {frame:number;viewport:number[];draws:Draw[];vehicleModes:number[];depthTests:boolean[];opacities:number[]}
interface DrawProof {receipts:DrawReceipt[];pending?:DrawReceipt;offscreenVehicles:number;programs:string[];errors:string[]}
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {vehicleForegroundProof:DrawProof}).vehicleForegroundProof);
const save=(name:string,value:unknown)=>{mkdirSync(out,{recursive:true});writeFileSync(join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');};
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed())save('failed-'+info.title.replace(/[^a-zA-Z0-9]+/g,'-'),await read(page));});

/** Forward every GL call unchanged; observe the actual onscreen route/composite/vehicle order. */
async function observe(page:Page,unsupported:boolean){
 await page.addInitScript(({unsupported})=>{
  localStorage.setItem('torobticket.appearance','dark');
  const proof:DrawProof={receipts:[],offscreenVehicles:0,programs:[],errors:[]};Object.assign(window,{vehicleForegroundProof:proof});
  // Observe timestamps on callbacks already scheduled by the application, without scheduling another frame.
  let frame=-1;const raf=window.requestAnimationFrame;window.requestAnimationFrame=callback=>raf.call(window,time=>{frame=time;Reflect.apply(callback,window,[time]);});
  const proto=WebGL2RenderingContext.prototype,link=proto.linkProgram,location=proto.getUniformLocation,upload=proto.uniform1f,extension=proto.getExtension;
  const programs=new WeakMap<WebGLProgram,Draw>(),names=new WeakMap<WebGLUniformLocation,{program:WebGLProgram;name:string}>(),values=new WeakMap<WebGLProgram,Record<string,number>>();
  const states=new WeakMap<WebGL2RenderingContext,{program:WebGLProgram|null;framebuffer:WebGLFramebuffer|null;viewport:number[];depth:boolean}>();
  const state=(gl:WebGL2RenderingContext)=>{let value=states.get(gl);if(!value){value={program:null,framebuffer:null,viewport:[0,0,gl.drawingBufferWidth,gl.drawingBufferHeight],depth:false};states.set(gl,value);}return value;};
  // Shadow forwarded state changes instead of synchronously querying the GPU on every draw.
  const use=proto.useProgram,bind=proto.bindFramebuffer,viewport=proto.viewport,enable=proto.enable,disable=proto.disable;
  proto.useProgram=function(program){use.call(this,program);state(this).program=program;};
  proto.bindFramebuffer=function(target,framebuffer){bind.call(this,target,framebuffer);if(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER)state(this).framebuffer=framebuffer;};
  proto.viewport=function(x,y,width,height){viewport.call(this,x,y,width,height);state(this).viewport=[x,y,width,height];};
  proto.enable=function(capability){enable.call(this,capability);if(capability===this.DEPTH_TEST)state(this).depth=true;};
  proto.disable=function(capability){disable.call(this,capability);if(capability===this.DEPTH_TEST)state(this).depth=false;};
  proto.getExtension=function(this:WebGL2RenderingContext,name:string){return unsupported&&name==='EXT_color_buffer_float'?null:Reflect.apply(extension,this,[name]);} as typeof extension;
  proto.linkProgram=function(program){
   link.call(this,program);const source=(this.getAttachedShaders(program)??[]).map(shader=>this.getShaderSource(shader)??'').join('\n');
   const kind=source.includes('uniform float vehicleMode')&&source.includes('float capsule')?'vehicle':source.includes('directionPhase')&&source.includes('routeSide')?'route':source.includes('uniform sampler2D glow')&&source.includes('uniform float strength')?'bloom':undefined;
   if(kind){programs.set(program,kind);values.set(program,{});proof.programs.push(kind);if(!this.getProgramParameter(program,this.LINK_STATUS))proof.errors.push(this.getProgramInfoLog(program)??'link error');}
  };
  proto.getUniformLocation=function(program,name){const found=location.call(this,program,name);if(found&&programs.has(program))names.set(found,{program,name});return found;};
  proto.uniform1f=function(at,value){const uniform=at&&names.get(at);if(uniform)values.get(uniform.program)![uniform.name]=value;return upload.call(this,at,value);};
  const finish=()=>{if(proof.pending){proof.receipts.push(proof.pending);if(proof.receipts.length>180)proof.receipts.shift();delete proof.pending;}};
  for(const name of ['drawArrays','drawElements'] as const){
   const original=proto[name];Object.defineProperty(proto,name,{configurable:true,value:function(this:WebGL2RenderingContext,...args:number[]){
    const result=Reflect.apply(original,this,args),current=state(this),program=current.program,kind=program?programs.get(program):undefined;
    if(current.framebuffer!==null){if(kind==='vehicle')proof.offscreenVehicles++;return result;}
    if(proof.pending&&proof.pending.frame!==frame)finish();
    const viewport=current.viewport,same=proof.pending&&viewport.every((value,index)=>value===proof.pending!.viewport[index]);
    if(kind==='route'){finish();proof.pending={frame,viewport,draws:['route'],vehicleModes:[],depthTests:[],opacities:[]};}
    else if(same&&kind){proof.pending!.draws.push(kind);if(kind==='vehicle'){const uniforms=values.get(program!)!;proof.pending!.vehicleModes.push(uniforms['vehicleMode']!);proof.pending!.opacities.push(uniforms['vehicleOpacity']!);proof.pending!.depthTests.push(current.depth);}}
    return result;
   }});
  }
 },{unsupported});
}

for(const sample of [{mode:'flight',unsupported:false},{mode:'train',unsupported:false},{mode:'bus',unsupported:false},{mode:'train',unsupported:true}] as const){
 test(`@vehicle-foreground ${sample.mode} stays above routes ${sample.unsupported?'without bloom':'with the runtime bloom policy'}`,async({page,context,browser})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await observe(page,sample.unsupported);
  expect(await context.cookies()).toEqual([]);expect((await context.request.post('/api/v1/demo/session',{data:{seed:6161,scenario:'normal',anchorInstant:'2026-10-29T06:00:00Z'}})).status()).toBe(201);
  const query={mode:sample.mode,scope:'domestic',tripType:'round-trip',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-02',returnDate:'2026-11-06',party:{adults:1,children:0,infants:0},classCode:sample.mode==='flight'?'economy':sample.mode==='train'?'seat':'standard',filters:{},sort:'cheapest'};
  await page.setViewportSize({width:1366,height:768});await page.goto('/?q='+encodeURIComponent(JSON.stringify(query)));
  // Observe the real gate's decision; never override performance or force qualification.
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:20000});
  await expect(page.locator('canvas[data-bloom-status]')).toHaveAttribute('data-bloom-status',sample.unsupported?'unsupported':/^(enabled|disabled)$/,{timeout:20000});
  await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();
  await expect(page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true})).toHaveAttribute('data-status','complete',{timeout:30000});
  await expect(page.locator('canvas[data-bloom-status]')).toHaveAttribute('data-bloom-status',sample.unsupported?'unsupported':/^(enabled|disabled)$/,{timeout:20000});
  const expected=sample.mode==='train'?3:1;
  const complete=(proof:DrawProof)=>proof.receipts.filter(receipt=>receipt.vehicleModes.length===expected&&receipt.opacities.every(value=>value>.5));
  await expect.poll(async()=>complete(await read(page)).length,{timeout:15000}).toBeGreaterThan(15);
  const proof=await read(page),receipts=complete(proof);for(const receipt of receipts){expect(receipt.draws).toEqual(['route',...(receipt.draws.includes('bloom')?['bloom']:[]),...Array<Draw>(expected).fill('vehicle')]);expect(receipt.vehicleModes).toEqual(sample.mode==='train'?[3,3,1]:[sample.mode==='flight'?0:2]);expect(receipt.depthTests).toEqual(Array<boolean>(expected).fill(false));}
  const bloom={status:await page.locator('canvas[data-bloom-status]').getAttribute('data-bloom-status'),reason:await page.locator('canvas[data-bloom-status]').getAttribute('data-bloom-reason'),actualCompositeReceipts:receipts.filter(receipt=>receipt.draws.includes('bloom')).length};
  if(bloom.status==='enabled')expect(bloom.actualCompositeReceipts).toBeGreaterThan(0);if(sample.unsupported)expect(bloom.actualCompositeReceipts).toBe(0);
  expect(proof.offscreenVehicles).toBe(0);expect(proof.errors).toEqual([]);expect(errors).toEqual([]);await expect(page.locator('canvas')).toHaveCount(1);
  await page.evaluate(()=>document.fonts.ready);mkdirSync(out,{recursive:true});const name=sample.mode+(sample.unsupported?'-unsupported':'-runtime');await page.screenshot({path:join(out,name+'.png')});save(name,{browser:browser.version(),query,bloom,proof,errors,cleanup:'Fresh isolated owner; normal expiry without session reset/deletion.'});
 });
}
