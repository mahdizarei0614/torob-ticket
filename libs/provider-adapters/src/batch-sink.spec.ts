import {afterEach,expect,it,vi} from 'vitest';
import {catalog,fixtureIdentity,generateProviderRecords} from '@torob-ticket/fixtures';
import type {TransportSearchQuery} from '@torob-ticket/contracts';
import {MockProvider} from './mock-provider';
import type {ProviderContext,ProviderEvidence} from './provider-context';
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-01',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
function context():ProviderContext{return{operationId:'batch-operation',fixtureVersion:fixtureIdentity.fixtureVersion,seed:5151,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',demoClock:{now:()=>new Date('2026-10-29T00:00:00Z')},realClock:{now:()=>new Date()},signal:new AbortController().signal,deadline:new Date(Date.now()+5000),catalog,aliases:[],overrides:{'demo-provider-01':{latencyMs:0}},traceSink:vi.fn(async()=>{})};}
const start=()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));};
const finish=async<T>(promise:Promise<T>)=>{await vi.advanceTimersByTimeAsync(0);return promise;};
afterEach(()=>{vi.useRealTimers();});
it('awaits one provider/date sink containing accepted and malformed evidence while preserving the row-fallback result',async()=>{
 start();const base=context(),raw=generateProviderRecords({fixtureVersion:base.fixtureVersion,seed:base.seed,anchorInstant:base.demoClock.now().toISOString(),scenario:base.scenario,scenarioRevision:base.scenarioRevision,mappingRevision:base.mappingRevision,query},'demo-provider-01');
 raw[4]!.payload={broken:true};const provider=new MockProvider('demo-provider-01',()=>raw);
 const original=await finish(provider.search(query,base));expect(base.traceSink).toHaveBeenCalledTimes(12);
 const batchContext=context(),batches:ProviderEvidence[][]=[];batchContext.traceBatchSink=async records=>{batches.push([...records]);};
 const batched=await finish(provider.search(query,batchContext));expect(batchContext.traceSink).not.toHaveBeenCalled();expect(batches).toHaveLength(1);expect(batches[0]).toHaveLength(12);expect(batches[0]![4]!.trace.issues[0]!.code).toBe('MALFORMED_RAW');expect(batched).toEqual(original);expect(vi.getTimerCount()).toBe(0);
});
it('reports sink failure without returning an in-memory successful prefix',async()=>{
 start();const c=context();c.traceBatchSink=vi.fn(async()=>{throw new Error('atomic-write-failed');});
 const result=await finish(new MockProvider('demo-provider-01').search(query,c));expect(result).toMatchObject({status:'failed',errorCode:'TRACE_SINK_FAILED',records:[]});expect(c.traceSink).not.toHaveBeenCalled();expect(c.traceBatchSink).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});
it.each(['abort','deadline'] as const)('never returns late success when %s occurs inside an awaited atomic sink',async cause=>{
 start();const c=context(),controller=new AbortController();c.signal=controller.signal;
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let entered=false,guardRejected=false;
 c.traceBatchSink=async(_rows,assertActive)=>{entered=true;await gate;try{assertActive();}catch(error){guardRejected=true;throw error;}};
 const work=new MockProvider('demo-provider-01').search(query,c);await vi.advanceTimersByTimeAsync(0);expect(entered).toBe(true);
 if(cause==='abort')controller.abort();else await vi.advanceTimersByTimeAsync(3500);
 const result=await work;expect(result).toMatchObject({status:cause==='abort'?'cancelled':'timeout',records:[]});release();await vi.advanceTimersByTimeAsync(0);expect(guardRejected).toBe(true);expect(c.traceSink).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('coalesces unique dates while keeping each returned date and the opposite return leg unchanged',async()=>{
 start();const c=context(),groups:ProviderEvidence[][]=[];
 c.traceBatchSink=async rows=>{groups.push([...rows]);};
 const dates=['2026-11-01','2026-11-02','2026-11-01'];const round={...query,tripType:'round-trip' as const,returnDate:'2026-11-04'};
 const result=await finish(new MockProvider('demo-provider-01').dateInventory({query:round,leg:'outbound',dates,clientGeneration:'batch-date'},c));
 expect(result.status).toBe('success');expect(groups.map(rows=>rows.length)).toEqual([24]);expect(result.dates.map(row=>row.date)).toEqual(dates.slice(0,2));
 expect(new Set(result.dates.flatMap(row=>row.batch.records.map(record=>record.raw.rawRecordId))).size).toBe(24);
 expect(groups.flat().every(record=>record.offer!.itinerary.return!.segments[0]!.departureAt.startsWith('2026-11-04'))).toBe(true);expect(vi.getTimerCount()).toBe(0);
});
it('honors receiver-aware row fallback before preparing later records when the first row cancels',async()=>{
 start();const c=context(),controller=new AbortController();c.signal=controller.signal;
 const batch=Object.assign(vi.fn(async()=>{}),{isAvailable:()=>false});c.traceBatchSink=batch;c.traceSink=vi.fn(async()=>{controller.abort();});
 const result=await finish(new MockProvider('demo-provider-01').search(query,c));expect(result.status).toBe('cancelled');expect(c.traceSink).toHaveBeenCalledOnce();expect(batch).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
