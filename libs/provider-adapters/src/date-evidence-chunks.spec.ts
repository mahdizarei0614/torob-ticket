import {afterEach,expect,it,vi} from 'vitest';
import {catalog,fixtureIdentity,generateProviderRecords} from '@torob-ticket/fixtures';
import type {TransportSearchQuery} from '@torob-ticket/contracts';
import {MockProvider} from './mock-provider';
import type {ProviderContext,ProviderEvidence} from './provider-context';
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-01',party:{adults:2,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const dates=['2026-11-01','2026-11-02','2026-11-03'];
function context():ProviderContext{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));return{operationId:'chunk-op',...fixtureIdentity,seed:5151,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',demoClock:{now:()=>new Date('2026-10-29T00:00:00Z')},realClock:{now:()=>new Date()},deadline:new Date(Date.now()+5000),signal:new AbortController().signal,catalog,aliases:[],overrides:{'demo-provider-01':{latencyMs:0}},traceSink:vi.fn(async()=>{})};}
const finish=async<T>(promise:Promise<T>)=>{await vi.advanceTimersByTimeAsync(0);return promise;};
const request=(days=dates)=>({query,leg:'outbound' as const,dates:days,clientGeneration:'date-chunks'});
afterEach(()=>{vi.useRealTimers();});
it('commits24+12 rows with original receiver, date order, raw IDs, normalization and per-date duplicate scope unchanged',async()=>{
 const baseline=context(),provider=new MockProvider('demo-provider-01'),original=await finish(provider.dateInventory(request(),baseline));
 const c=context(),chunks:ProviderEvidence[][]=[];c.traceBatchSink=async function(rows,check){expect(this).toBe(c);check();chunks.push([...rows]);};
 const result=await finish(provider.dateInventory(request([dates[1]!,dates[0]!,dates[1]!,dates[2]!]),c));
 expect(chunks.map(rows=>rows.length)).toEqual([24,12]);expect(result.dates.map(row=>row.date)).toEqual([dates[1],dates[0],dates[2]]);expect(result.dates.every(row=>row.batch.records.length===12)).toBe(true);
 for(const row of result.dates)expect(row.batch.records).toEqual(original.dates.find(original=>original.date===row.date)!.batch.records);
 expect(chunks.flat()).toEqual(result.dates.flatMap(row=>row.batch.records));expect(c.traceSink).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('keeps13-row duplicate dates together under32 while preserving each local duplicate trace',async()=>{
 const c=context();c.caseId='duplicate';const chunks:ProviderEvidence[][]=[];c.traceBatchSink=async rows=>{chunks.push([...rows]);};const result=await finish(new MockProvider('demo-provider-01').dateInventory(request(),c));
 expect(chunks.map(rows=>rows.length)).toEqual([26,13]);expect(result.dates.every(row=>row.batch.records.filter(record=>record.trace.decisions.some(decision=>decision.ruleCode==='duplicate-source-payload')).length===1)).toBe(true);expect(vi.getTimerCount()).toBe(0);
});
it('flushes below4MiB including envelope headroom when bytes bind before record count',async()=>{
 const c=context(),chunks:ProviderEvidence[][]=[];c.traceBatchSink=async rows=>{chunks.push([...rows]);};
 const provider=new MockProvider('demo-provider-01',input=>generateProviderRecords(input,'demo-provider-01').slice(0,2).map(raw=>({...raw,payload:{...raw.payload as object,largeSourceField:'x'.repeat(280000)}})));
 const result=await finish(provider.dateInventory(request([...dates,'2026-11-04']),c));expect(result.status).toBe('success');expect(chunks.map(rows=>rows.length)).toEqual([6,2]);
 for(const chunk of chunks){expect(chunk.length).toBeLessThanOrEqual(32);expect(chunk.reduce((sum,row)=>sum+Buffer.byteLength(JSON.stringify(row),'utf8')+2048,0)).toBeLessThanOrEqual(4*1024*1024);}expect(vi.getTimerCount()).toBe(0);
});
it('fails explicitly on an oversized single date without silently dropping its records',async()=>{
 const c=context();c.traceBatchSink=vi.fn(async()=>{});const provider=new MockProvider('demo-provider-01',input=>generateProviderRecords(input,'demo-provider-01').slice(0,1).map(raw=>({...raw,payload:{...raw.payload as object,largeSourceField:'x'.repeat(2200000)}})));
 const result=await finish(provider.dateInventory(request(),c));expect(result).toMatchObject({status:'failed',errorCode:'TRACE_SINK_FAILED',dates:[]});expect(c.traceBatchSink).not.toHaveBeenCalled();expect(c.traceSink).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('returns no success after a later chunk fails while retaining only earlier committed receipts',async()=>{
 const c=context(),committed:ProviderEvidence[][]=[];let calls=0;c.traceBatchSink=async rows=>{if(++calls===2)throw new Error('later-write-failure');committed.push([...rows]);};
 const result=await finish(new MockProvider('demo-provider-01').dateInventory(request([...dates,'2026-11-04']),c));expect(result).toMatchObject({status:'failed',dates:[],errorCode:'TRACE_SINK_FAILED'});expect(committed.map(rows=>rows.length)).toEqual([24]);expect(vi.getTimerCount()).toBe(0);
});
it.each(['abort','deadline'] as const)('fences an awaited chunk on %s without flushing a tail or returning staged dates',async cause=>{
 const c=context(),controller=new AbortController();c.signal=controller.signal;let release!:()=>void;const gate=new Promise<void>(done=>{release=done;});let calls=0,guardRejected=false;
 c.traceBatchSink=async(_rows,check)=>{calls++;await gate;try{check();}catch(error){guardRejected=true;throw error;}};
 const work=new MockProvider('demo-provider-01').dateInventory(request(),c);await vi.advanceTimersByTimeAsync(0);expect(calls).toBe(1);if(cause==='abort')controller.abort();else await vi.advanceTimersByTimeAsync(3500);
 expect(await work).toMatchObject({status:cause==='abort'?'cancelled':'timeout',dates:[]});release();await vi.advanceTimersByTimeAsync(0);expect(guardRejected).toBe(true);expect(calls).toBe(1);expect(vi.getTimerCount()).toBe(0);
});
it('keeps a copied custom row-sink context on the original sequential path',async()=>{
 const c=context(),controller=new AbortController();c.signal=controller.signal;const batch=Object.assign(vi.fn(async()=>{}),{isAvailable:(receiver:ProviderContext)=>receiver.traceSink===c.traceSink});c.traceBatchSink=batch;
 const copied={...c,traceSink:vi.fn(async()=>{controller.abort();})};const result=await finish(new MockProvider('demo-provider-01').dateInventory(request(),copied));expect(result.status).toBe('cancelled');expect(copied.traceSink).toHaveBeenCalledOnce();expect(batch).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
