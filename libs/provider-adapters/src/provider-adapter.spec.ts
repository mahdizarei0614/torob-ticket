import { describe, expect, it } from 'vitest';
import { generateProviderRecords, catalogForIdentity, type FixtureQuery } from '@torob-ticket/fixtures';
import { decodeRawRecord } from './raw-codecs';
const base: FixtureQuery = {fixtureVersion:'showcase-v1',seed:5,anchorInstant:'2026-10-24T00:00:00.000Z',scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',query:{mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-10-25',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'}};
const catalog=catalogForIdentity('showcase-v1','catalog-v1');
export function providerInput(n:number):FixtureQuery { return {...base,query:{...base.query,...(n>4?{mode:'train',classCode:'seat'}:{})}}; }
export function providerRaw(n:number) { return generateProviderRecords(providerInput(n)).find(r=>r.providerId===`demo-provider-0${n}`)!; }
export { base, catalog };
describe('each raw dialect decodes independently',()=>{
  for(let n=1;n<=6;n++) {
    it(`P0${n} extracts gross money, source terms, party and immutable schedule`,()=>{
      const raw=providerRaw(n); const decoded=decodeRawRecord(raw);
      expect(decoded.raw).toEqual(raw);
      expect(decoded.serviceKey).toBe(`${n>4?'train':'flight'}:tehran:mashhad:2026-10-25:one-way:0`);
      expect(decoded.outbound.segments[0]?.originPlaceId).toBe(n>4?'tehran-station':'thr');
      expect(decoded.amount).toBeDefined(); expect(decoded.mandatoryCharge).toBe(n===2||n===4||n===6?12000:120000);
      expect(decoded.baggageKg).toBe(n===2?null:n===4?30:20);
      expect(decoded.refundable).toBe(n===3?null:n===4);
      expect(decoded.party).toEqual({adults:1,children:0,infants:0});
      expect(decoded.seats).toBe(9); expect(decoded.sourceRevision).toBe('source-v1');
    });
    it(`P0${n} rejects malformed shape instead of coercing fields`,()=>{
      expect(()=>decodeRawRecord({...providerRaw(n),payload:{}})).toThrow(/MALFORMED_RAW/);
    });
  }
});

import { afterEach, beforeEach, vi } from 'vitest';
import { mockRegistry } from './mock-registry';
import { MockProvider } from './mock-provider';
import type { ProviderContext, ProviderEvidence } from './provider-context';
function context(overrides:Partial<ProviderContext>={}):ProviderContext {
  return {operationId:'operation-1',fixtureVersion:'showcase-v1',seed:5,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',demoClock:{now:()=>new Date(base.anchorInstant)},realClock:{now:()=>new Date()},signal:new AbortController().signal,deadline:new Date(Date.now()+5000),catalog,aliases:[{entityType:'city',sourceNamespace:'demo-provider-03/v1',sourceValue:'Istanbul / استانبول',targetId:'istanbul'}],overrides:{},traceSink:async()=>{},...overrides};
}
async function finish<T>(promise:Promise<T>,ms=1500):Promise<T> { await vi.advanceTimersByTimeAsync(ms); return promise; }
describe('six provider operation behavior',()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));});
  afterEach(()=>{expect(vi.getTimerCount()).toBe(0);vi.useRealTimers();});
  for(let n=1;n<=6;n++) {
    const id=`demo-provider-0${n}`;
    it(`P0${n} awaits raw/decision sink, preserves duplicates and incomplete charges`,async()=>{
      const evidence:ProviderEvidence[]=[];
      const ctx=context({traceSink:async e=>{evidence.push(e);}});
      const result=await finish(mockRegistry[n-1]!.search(providerInput(n).query,ctx));
      expect(result.status).toBe('success');expect(result.records).toHaveLength(3);expect(evidence).toHaveLength(3);
      expect(result.records.every(r=>r.trace.outcome==='accepted')).toBe(true);
      expect(result.records[0]?.offer?.total?.amountRial).toBeGreaterThan(0);
      expect(evidence[0]?.sourceRawRecordId).toBe(generateProviderRecords({...providerInput(n),phase:'search'}).find(r=>r.providerId===id)?.rawRecordId);
      expect(evidence[0]?.raw.rawRecordId).not.toBe(evidence[0]?.sourceRawRecordId);
      const duplicateRaw=providerRaw(n);
      const duplicateProvider=new MockProvider(id,()=>[duplicateRaw,{...duplicateRaw,rawRecordId:'copy'}]);
      const dup=await finish(duplicateProvider.search(providerInput(n).query,context()));
      expect(dup.records).toHaveLength(2);expect(dup.records[1]?.trace.decisions.some(d=>d.ruleCode==='duplicate-source-payload')).toBe(true);
      const raw=structuredClone(providerRaw(n));
      const chargePaths=['fare.mandatory','ticket.tax','cost.fees','pricing.0.mandatoryFees','payment.mandatory_charge','amounts.charges'];
      setRaw(raw.payload,chargePaths[n-1]!,null);
      const missing=await finish(new MockProvider(id,()=>[raw]).search(providerInput(n).query,context()));
      expect(missing.records[0]?.offer?.completeness.status).toBe('incomplete');
    });
    it(`P0${n} records malformed and ambiguous source evidence`,async()=>{
      const raw=providerRaw(n); const seen:ProviderEvidence[]=[];
      const malformed=await finish(new MockProvider(id,()=>[{...raw,payload:{}}]).search(providerInput(n).query,context({traceSink:async e=>{seen.push(e);}})));
      expect(malformed.records[0]?.trace.outcome).toBe('rejected'); expect(seen[0]?.raw.payload).toEqual({});
      const ambiguous=await finish(mockRegistry[n-1]!.search(providerInput(n).query,context({aliases:[{entityType:'city',sourceNamespace:`${id}/v1`,sourceValue:'تهران',targetId:'mashhad'}]})));
      expect(ambiguous.records.every(r=>r.trace.outcome==='ambiguous'&&!r.offer)).toBe(true);
    });
    it(`P0${n} pause, timeout and cancellation never become empty success`,async()=>{
      const provider=mockRegistry[n-1]!;
      const paused=await provider.search(providerInput(n).query,context({overrides:{[id]:{paused:true}}}));
      expect(paused.status).toBe('paused');
      const failed=await finish(provider.search(providerInput(n).query,context({overrides:{[id]:{failureProfile:'error'}}})));
      expect(failed.status).toBe('failed');
      const timed=await finish(provider.search(providerInput(n).query,context({overrides:{[id]:{failureProfile:'timeout'}}})),3500);
      expect(timed.status).toBe('timeout');
      const controller=new AbortController(); const add=vi.spyOn(controller.signal,'addEventListener');const remove=vi.spyOn(controller.signal,'removeEventListener');
      const cancelled=provider.search(providerInput(n).query,context({signal:controller.signal}));controller.abort();
      expect((await cancelled).status).toBe('cancelled');expect(add.mock.calls.length).toBe(remove.mock.calls.length);
    });
    it(`P0${n} recheck detects price/condition changes and sold-out evidence`,async()=>{
      const provider=mockRegistry[n-1]!; const query=providerInput(n).query;
      const first=await finish(provider.search(query,context())); const previous=first.records[0]!.offer!;
      const selection={query,serviceKey:previous.itinerary.itineraryId,previous};
      expect((await finish(provider.recheck(selection,context()))).outcome).toBe('unchanged');
      const raw=structuredClone(providerRaw(n));const prices=['fare.amount','ticket.price','cost.payable','pricing.0.value','payment.total','amounts.gross'];setRaw(raw.payload,prices[n-1]!,100000000);
      expect((await finish(new MockProvider(id,()=>[raw]).recheck(selection,context()))).outcome).toBe('changed');
      const stocks=['inventory.available','stock','sale.open','availability.enabled','capacity.saleable','remaining'];setRaw(raw.payload,stocks[n-1]!,n===2||n===6?0:false);
      expect((await finish(new MockProvider(id,()=>[raw]).recheck(selection,context()))).outcome).toBe('sold-out');
    });
  }
  it('uses one delay for date batch while preserving the fixed opposite leg',async()=>{
    const ctx=context();const query={...base.query,tripType:'round-trip' as const,returnDate:'2026-10-29'};
    const result=await finish(mockRegistry[0]!.dateInventory({query,leg:'outbound',dates:['2026-10-25','2026-10-26','2026-10-27'],clientGeneration:'g'},ctx),150);
    expect(result.status).toBe('success');expect(result.dates).toHaveLength(3);expect(result.dates.every(d=>d.batch.records.length>0)).toBe(true);
    expect(result.dates.every(d=>d.batch.records.every(r=>r.offer?.itinerary.return?.segments[0]?.departureAt.startsWith('2026-10-29')))).toBe(true);
  });
  it('deduplicates repeated dates in first-seen order within one timed evidence batch',async()=>{
    const rawIds=new Set<string>();const traceIds=new Set<string>();const offerIds=new Set<string>();
    const evidence:ProviderEvidence[]=[];
    const ctx=context({traceSink:async record=>{
      const offer=record.offer!;
      if(rawIds.has(record.raw.rawRecordId)||traceIds.has(record.trace.traceId)||offerIds.has(offer.offerId)) throw new Error('duplicate evidence primary key');
      expect(record.trace.rawRecordId).toBe(record.raw.rawRecordId);
      expect(record.trace.offerId).toBe(offer.offerId);
      expect(offer.provenance.every(p=>p.rawRecordId===record.raw.rawRecordId)).toBe(true);
      rawIds.add(record.raw.rawRecordId);traceIds.add(record.trace.traceId);offerIds.add(offer.offerId);evidence.push(record);
    }});
    let completed=false;
    const query={...base.query,tripType:'round-trip' as const,returnDate:'2026-10-29'};
    const pending=mockRegistry[0]!.dateInventory({query,leg:'outbound',dates:['2026-10-26','2026-10-25','2026-10-26','2026-10-27','2026-10-25'],clientGeneration:'repeated-dates'},ctx).then(batch=>{completed=true;return batch;});
    await vi.advanceTimersByTimeAsync(149);expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);expect(completed).toBe(true);
    const result=await pending;
    expect(result.status).toBe('success');
    expect(result.dates.map(d=>d.date)).toEqual(['2026-10-26','2026-10-25','2026-10-27']);
    expect(result.dates.every(d=>d.batch.status==='success'&&d.batch.records.length===3)).toBe(true);
    expect(evidence).toHaveLength(9);expect(rawIds.size).toBe(9);expect(traceIds.size).toBe(9);expect(offerIds.size).toBe(9);
    expect(evidence.every(r=>r.offer?.itinerary.return?.segments[0]?.departureAt.startsWith('2026-10-29'))).toBe(true);
  });
  it('honors exact delay/deadline boundaries and slow-provider configuration',async()=>{
    let settled=false;
    const promise=mockRegistry[3]!.search(base.query,context({scenario:'slow-provider'})).then(r=>{settled=true;return r;});
    await vi.advanceTimersByTimeAsync(2399);expect(settled).toBe(false);await vi.advanceTimersByTimeAsync(1);expect((await promise).status).toBe('success');
    expect((await finish(mockRegistry[3]!.search(base.query,context({scenario:'provider-timeout'})),3500)).status).toBe('timeout');
    expect((await finish(mockRegistry[0]!.search(base.query,context({deadline:new Date(Date.now()+100)})),100)).status).toBe('timeout');
  });
  it('awaits sink completion and clears timers/listeners if persistence rejects',async()=>{
    const controller=new AbortController();const add=vi.spyOn(controller.signal,'addEventListener');const remove=vi.spyOn(controller.signal,'removeEventListener');
    let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});let completed=false;
    const promise=mockRegistry[0]!.search(base.query,context({signal:controller.signal,traceSink:async()=>blocked})).then(r=>{completed=true;return r;});
    await vi.advanceTimersByTimeAsync(150);expect(completed).toBe(false);release();await promise;
    const failure=mockRegistry[0]!.search(base.query,context({signal:controller.signal,traceSink:async()=>{throw new Error('storage failed');}}));
    expect((await finish(failure)).errorCode).toBe('TRACE_SINK_FAILED');expect(add.mock.calls.length).toBe(remove.mock.calls.length);
  });
});
function setRaw(value:unknown,path:string,next:unknown) {
  const keys=path.split('.');let item=value as Record<string,unknown>;
  for(const key of keys.slice(0,-1)) item=item[key] as Record<string,unknown>;
  item[keys.at(-1)!]=next;
}

describe('timing and source validation boundaries',()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));});
  afterEach(()=>{expect(vi.getTimerCount()).toBe(0);vi.useRealTimers();});
  it('deadline cancels a blocked sink without starting another record',async()=>{
    let release!:()=>void;let writes=0;
    const pending=new Promise<void>(resolve=>{release=resolve;});
    const result=mockRegistry[0]!.search(base.query,context({deadline:new Date(Date.now()+200),traceSink:async()=>{writes++;await pending;}}));
    await vi.advanceTimersByTimeAsync(200);expect((await result).status).toBe('timeout');release();await Promise.resolve();await Promise.resolve();expect(writes).toBe(1);
  });
  it('decodes every seeded mode/scope with complete round trips through the same path',async()=>{
    const routes=[['flight','domestic','mashhad','economy'],['flight','international','istanbul','economy'],['train','domestic','mashhad','seat'],['train','international','van','seat'],['bus','domestic','isfahan','standard'],['bus','international','yerevan','standard']] as const;
    for(const [mode,scope,destinationCityId,classCode] of routes) {
      const query={...base.query,mode,scope,destinationCityId,classCode,tripType:'round-trip' as const,returnDate:'2026-10-29'};
      for(const provider of mockRegistry.filter(p=>catalog.providerCapabilities.find(c=>c.providerId===p.providerId)?.modes.includes(mode))) {
        const batch=await finish(provider.search(query,context()));expect(batch.status).toBe('success');expect(batch.records.length).toBeGreaterThan(0);expect(batch.records.every(r=>r.trace.outcome==='accepted'&&r.offer?.itinerary.return)).toBe(true);
      }
    }
  });
  it('keeps supplied airport-change ground segments and recheck scenario behavior',async()=>{
    const query={...base.query,scope:'international' as const,destinationCityId:'istanbul'};
    const batch=await finish(mockRegistry[3]!.search(query,context({caseId:'airport-change'})));
    expect(batch.records[0]?.offer?.itinerary.outbound.segments.at(-1)).toMatchObject({mode:'bus',originPlaceId:'ist',destinationPlaceId:'saw'});
    const previous=(await finish(mockRegistry[3]!.search(base.query,context()))).records[0]!.offer!;
    const selection={query:base.query,serviceKey:previous.itinerary.itineraryId,previous};
    expect((await finish(mockRegistry[3]!.recheck(selection,context({scenario:'price-change'})))).outcome).toBe('changed');
    expect((await finish(mockRegistry[3]!.recheck(selection,context({scenario:'sold-out'})))).outcome).toBe('sold-out');
  });
  it('rejects extra legs that would otherwise silently lose supplied travel',()=>{
    const raw=providerRaw(2);const payload=raw.payload as {trips:unknown[]};payload.trips.push(payload.trips[0],payload.trips[0]);
    expect(()=>decodeRawRecord(raw)).toThrow(/MALFORMED_RAW/);
  });
});
