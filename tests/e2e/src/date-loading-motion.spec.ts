import {test,expect,currentDatePrices} from '../fixtures';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {TransportSearchQuery} from '@torob-ticket/contracts';

const evidence=process.env.DATE_LOADING_EVIDENCE_DIR??'docs/evidence/adjustments/date-loading-motion/browser';
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-08',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const save=(name:string,data:unknown)=>{mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,name+'.json'),JSON.stringify(data,null,2)+'\n');};
const wave=(values:number[])=>values.some((low,index)=>low<.65&&values.slice(index+1).some((high,offset)=>high>.8&&values.slice(index+offset+2).some(next=>next<.65)));

for(const reduced of [false,true])test(`@date-loading ${reduced?'reduced':'normal'} motion shows pending prices and settles actual data`,async({newReviewer,browser})=>{
 test.setTimeout(60000);
 const reviewer=await newReviewer({seed:8484,scenario:'normal',anchorInstant:'2026-11-02T06:00:00Z',viewport:{width:1440,height:1000},reducedMotion:reduced?'reduce':'no-preference'});
 const {page}=reviewer,prefix=reduced?'reduced':'normal';
 let release!:()=>void,held=false,actualStatus:number|undefined,reloadHeld=false,releaseReload=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;});
 let activeGate=gate;
 await page.route('**/api/v1/date-prices',async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  const ownGate=activeGate,actual=await route.fetch();actualStatus=actual.status();
  if(ownGate===gate)held=true;else reloadHeld=true;
  await ownGate;await route.fulfill({response:actual});
 });
 try{
  await page.goto('/?q='+encodeURIComponent(JSON.stringify(query)));
  const chart=page.locator('[data-chart-selected]'),loader=chart.locator('[data-chart-loading-visual]'),content=chart.locator('[data-chart-content]');
  const amount=page.getByRole('listbox',{name:'روزهای نزدیک',exact:true}).locator('[aria-selected="true"] [data-date-amount-state]');
  await expect(chart).toHaveAttribute('data-chart-loading','true');
  await expect(loader).toBeVisible();await expect(amount).toHaveAttribute('data-date-amount-state','loading');
  const waveLine=loader.locator('[data-loading-wave-path]');
  await expect(waveLine).toHaveCount(1);
  await expect(loader.locator('[data-loading-wave]')).toHaveAttribute('aria-hidden','true');
  await expect.poll(()=>held).toBe(true);expect(actualStatus).toBe(201);
  const before=await chart.boundingBox();
  const observations:{chart:number;wheel:number;chartAnimations:number;wheelAnimations:number;waveX:number;waveAnimations:number}[]=[];
  const read=async()=>{
   const chartPulse=chart.locator('[data-loading-pulse]'),wheelPulse=amount.locator('[data-loading-pulse]');
   const [a,b,w]=await Promise.all([chartPulse.evaluate(node=>({opacity:Number(getComputedStyle(node).opacity),animations:node.getAnimations().filter(animation=>animation.playState==='running').length})),wheelPulse.evaluate(node=>({opacity:Number(getComputedStyle(node).opacity),animations:node.getAnimations().filter(animation=>animation.playState==='running').length})),loader.locator('[data-loading-wave]').evaluate(node=>({x:(node as SVGSVGElement).getScreenCTM()?.e??0,animations:node.getAnimations().filter(animation=>animation.playState==='running').length}))]);
   const value={chart:a.opacity,wheel:b.opacity,chartAnimations:a.animations,wheelAnimations:b.animations,waveX:w.x,waveAnimations:w.animations};observations.push(value);return value;
  };
  if(reduced){const state=await read();expect(state.chartAnimations).toBe(0);expect(state.wheelAnimations).toBe(0);expect(state.waveAnimations).toBe(0);expect(state.chart).toBeGreaterThan(0);expect(state.wheel).toBeGreaterThan(0);}
  else await expect.poll(async()=>{await read();return wave(observations.map(value=>value.chart))&&wave(observations.map(value=>value.wheel));},{intervals:[80],timeout:7000}).toBe(true);
  if(!reduced){expect(observations.some(value=>value.waveAnimations>0)).toBe(true);expect(Math.max(...observations.map(value=>value.waveX))-Math.min(...observations.map(value=>value.waveX))).toBeGreaterThan(3);}
  mkdirSync(evidence,{recursive:true});await page.screenshot({path:join(evidence,prefix+'-pending.png')});
  expect(Number(await chart.getAttribute('data-chart-opacity'))).toBe(0);
  const entryFrames:{opacity:number;phase:string|null;loading:string|null;loaderOpacity:number|null;loaderStage:string|null}[]=[];
  release();
  // The shared canvas cannot inherit an ancestor's DOM opacity. Observe the
  // existing lifecycle opacity consumed by both actual GPU and SVG series.
  await expect.poll(async()=>{const frame=await chart.evaluate(node=>{const loader=node.querySelector('[data-chart-loading-visual]')?.closest('[data-date-loading-stage]');return {opacity:Number(node.getAttribute('data-chart-opacity')),phase:node.getAttribute('data-chart-phase'),loading:node.getAttribute('data-chart-loading'),loaderOpacity:loader?Number(getComputedStyle(loader).opacity):null,loaderStage:loader?.getAttribute('data-date-loading-stage')??null};});entryFrames.push(frame);return frame.loading==='false'&&frame.opacity===1;},{intervals:[16,32],timeout:10000}).toBe(true);
  if(!reduced){expect(entryFrames.some(frame=>frame.opacity>0&&frame.opacity<1)).toBe(true);expect(entryFrames.some(frame=>frame.loaderStage==='exiting'&&frame.loaderOpacity!==null&&frame.loaderOpacity>0&&frame.loaderOpacity<1)).toBe(true);}
  await expect(loader).toHaveCount(0);
  await expect(amount).toHaveAttribute('data-date-amount-state','ready');
  await expect(amount.locator('[data-date-loading-stage]')).toHaveCount(0);
  await expect.poll(async()=>Number(await content.evaluate(node=>getComputedStyle(node).opacity))).toBe(1);
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:30000});
  const prices=await currentDatePrices(reviewer),selected=prices.cells.find(cell=>cell.date===query.departureDate);
  expect(selected?.status).toBe('priced');if(selected?.status!=='priced')throw Error('Expected actual selected date price');
  const label=new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1}).format(selected.minimum.amountRial/10)+' تومان';
  await expect(amount.locator('[data-date-value-stage="ready"]')).toHaveText(label);
  await expect(page.getByRole('listbox',{name:'روزهای نزدیک',exact:true}).locator('[aria-selected="true"]')).toHaveAttribute('aria-label',new RegExp(label));
  const after=await chart.boundingBox();expect(after!.height).toBeCloseTo(before!.height,1);expect(after!.width).toBeCloseTo(before!.width,1);
  await page.screenshot({path:join(evidence,prefix+'-ready.png')});
  save(prefix,{browser:browser.version(),method:'Actual date-prices POST response held until pending opacity observation, then original status/headers/body released. No fabricated price response or normal latency claim. Entry frames are published shared lifecycle values, not an independent native pixel/GPU-uniform capture.',actualStatus,reduced,observations,entryFrames,before,after,selectedDate:query.departureDate,actualAmountRial:selected.minimum.amountRial,visibleAmount:label,terminalStatus:prices.status});
  if(!reduced){
   activeGate=new Promise<void>(resolve=>{releaseReload=resolve;});
   // Read-only bounded capture starts before input. Waiting for the click's
   // completion can miss a short entry while the longer data exit still runs.
   const capture=chart.evaluate(node=>new Promise<{opacity:number;phase:string|null;loading:string|null;skeletonOpacity:number;policy:string|null;stage:string|null;inert:boolean;elapsed:number}[]>(resolve=>{
    const frames:{opacity:number;phase:string|null;loading:string|null;skeletonOpacity:number;policy:string|null;stage:string|null;inert:boolean;elapsed:number}[]=[],start=performance.now();
    const sample=()=>{const loading=node.querySelector('[data-chart-loading-visual]')?.closest('[data-date-loading-stage]');frames.push({opacity:Number(node.getAttribute('data-chart-opacity')),phase:node.getAttribute('data-chart-phase'),loading:node.getAttribute('data-chart-loading'),skeletonOpacity:loading?Number(getComputedStyle(loading).opacity):0,policy:node.getAttribute('data-motion-policy'),stage:loading?.getAttribute('data-date-loading-stage')??null,inert:loading?.hasAttribute('inert')??false,elapsed:performance.now()-start});if(performance.now()-start<1300)requestAnimationFrame(sample);else resolve(frames);};requestAnimationFrame(sample);
   }));
   // React Aria's visible label owns the pointer surface; its radio input is
   // deliberately overlaid. Use the actual label rather than forcing the input.
   await page.locator('label[data-segment-option="train"]').click();
   await expect(page.getByRole('radio',{name:'قطار',exact:true})).toBeChecked();
   const exitFrames=await capture;
   save('normal-replacement-frames',{method:'Bounded1300ms read-only DOM rAF capture begun before visible input; test instrumentation only, no application animation clock or state writes.',exitFrames});
   await expect.poll(async()=>reloadHeld&&await chart.getAttribute('data-chart-loading')==='true'&&Number(await chart.getAttribute('data-chart-opacity'))===0).toBe(true);
   expect(exitFrames.some(frame=>frame.phase==='exiting'&&frame.opacity>0&&frame.opacity<1)).toBe(true);
   expect(exitFrames.some(frame=>frame.skeletonOpacity>0&&frame.skeletonOpacity<1)).toBe(true);
   await page.screenshot({path:join(evidence,'normal-reloading.png')});
   releaseReload();
   await expect(chart).toHaveAttribute('data-chart-loading','false');await expect(loader).toHaveCount(0);
   await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete');
   const next=await currentDatePrices(reviewer);expect(next.query.query.mode).toBe('train');
   await expect.poll(async()=>Number(await chart.getAttribute('data-chart-opacity'))).toBe(1);
   save('normal-replacement',{method:'Visible flight-to-train control change; actual next response held/released without payload replacement. Published actual-series exit and computed skeleton entry opacity sampled during the replacement.',exitFrames,newMode:next.query.query.mode,terminalStatus:next.status});
  }
 }finally{release();releaseReload();}
});
