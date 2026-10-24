import { createHash } from 'node:crypto';
import { DatePriceQuerySchema, TransportSearchQuerySchema, type DatePriceQuery, type RawProviderRecord, type TransportSearchQuery } from '@torob-ticket/contracts';
import { normalizeRecord } from '@torob-ticket/domain';
import { generateProviderRecords, scenarios, type FixtureQuery } from '@torob-ticket/fixtures';
import type { ProviderAdapter, ProviderBatch, ProviderBatchStatus, ProviderDateBatch, ProviderQuoteSelection, ProviderRecheck } from './provider-adapter';
import type { ProviderContext, ProviderEvidence } from './provider-context';
import { decodeRawRecord, RawDecodeError } from './raw-codecs';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,40);
class OperationFailure extends Error {
  constructor(readonly status:ProviderBatchStatus,readonly code:string) { super(code); }
}
export class MockProvider implements ProviderAdapter {
  constructor(readonly providerId:string,private readonly source:(input:FixtureQuery)=>RawProviderRecord[]=generateProviderRecords) {}
  private supports(query:TransportSearchQuery,c:ProviderContext) {
    return c.catalog.providerCapabilities.some(p=>p.providerId===this.providerId&&p.modes.includes(query.mode)&&p.scopes.includes(query.scope));
  }
  /** One timer schedule per operation, including a whole date batch. */
  private async run<T>(c:ProviderContext,work:(check:()=>void)=>Promise<T>):Promise<T> {
    const override=c.overrides[this.providerId];const settings=c.settings??scenarios[c.scenario];
    if(c.signal.aborted) throw new OperationFailure('cancelled','CANCELLED');
    if(override?.paused) throw new OperationFailure('paused','PROVIDER_PAUSED');
    const duration=Math.min(settings.timeoutMs,c.deadline.getTime()-c.realClock.now().getTime());
    if(duration<=0) throw new OperationFailure('timeout','PROVIDER_TIMEOUT');
    const delay=override?.failureProfile==='timeout'?duration+1:override?.latencyMs??settings.delaysMs[Number(this.providerId.slice(-2))-1]!;
    let delayTimer:ReturnType<typeof setTimeout>|undefined;
    let deadlineTimer:ReturnType<typeof setTimeout>|undefined;
    let stopped:OperationFailure|undefined;
    let onAbort:()=>void=()=>{};
    const check=()=>{if(stopped) throw stopped;if(c.signal.aborted) throw new OperationFailure('cancelled','CANCELLED');if(c.realClock.now().getTime()>=c.deadline.getTime()) throw new OperationFailure('timeout','PROVIDER_TIMEOUT');};
    try {
      const boundary=new Promise<never>((_,reject)=>{
        const stop=(failure:OperationFailure)=>{stopped=failure;reject(failure);};
        onAbort=()=>stop(new OperationFailure('cancelled','CANCELLED'));
        c.signal.addEventListener('abort',onAbort,{once:true});
        deadlineTimer=setTimeout(()=>stop(new OperationFailure('timeout','PROVIDER_TIMEOUT')),duration);
      });
      const delivery=new Promise<void>(resolve=>{delayTimer=setTimeout(resolve,delay);}).then(async()=>{
        check();if(override?.failureProfile==='error') throw new OperationFailure('failed','PROVIDER_ERROR');
        return work(check);
      });
      return await Promise.race([delivery,boundary]);
    } finally {
      clearTimeout(delayTimer);clearTimeout(deadlineTimer);c.signal.removeEventListener('abort',onAbort);
    }
  }
  private async collect(query:TransportSearchQuery,c:ProviderContext,phase:'search'|'recheck',check:()=>void):Promise<ProviderBatch> {
    check();
    if(!this.supports(query,c)) return {providerId:this.providerId,status:'unsupported',records:[]};
    const input:FixtureQuery={fixtureVersion:c.fixtureVersion,seed:c.seed,anchorInstant:c.demoClock.now().toISOString(),scenario:c.scenario,scenarioRevision:c.scenarioRevision,mappingRevision:c.mappingRevision,query,phase,...c.caseId?{caseId:c.caseId}:{}};
    const records:ProviderEvidence[]=[];const seen=new Map<string,string>();
    for(const original of this.source(input).filter(r=>r.providerId===this.providerId)) {
      check();
      const raw={...original,rawRecordId:`raw-${digest([c.operationId,phase,original.rawRecordId,records.length])}`};
      let evidence:ProviderEvidence;
      try {
        const decoded=decodeRawRecord(raw);decoded.sourceRawRecordId=original.rawRecordId;
        evidence={raw,sourceRawRecordId:original.rawRecordId,...normalizeRecord(decoded,{query,catalog:c.catalog,mappingRevision:c.mappingRevision,aliases:c.aliases,realClock:c.realClock})};
      } catch(error) {
        if(!(error instanceof RawDecodeError)) throw error;
        evidence={raw,sourceRawRecordId:original.rawRecordId,trace:{traceId:`trace-${raw.rawRecordId}`,rawRecordId:raw.rawRecordId,mappingRevision:c.mappingRevision,outcome:'rejected',decisions:[{fieldPath:['payload'],ruleCode:'malformed-source-payload',sourceValue:raw.payload}],issues:error.fieldPaths.map(fieldPath=>({code:'MALFORMED_RAW',fieldPath,severity:'rejected',rawRecordId:raw.rawRecordId})),observedAt:c.realClock.now().toISOString()}};
      }
      const fingerprint=digest(original.payload);const duplicateOf=seen.get(fingerprint);
      if(duplicateOf) evidence.trace.decisions.push({fieldPath:['payload'],ruleCode:'duplicate-source-payload',sourceValue:original.rawRecordId,normalizedValue:{duplicateOf}});
      else seen.set(fingerprint,raw.rawRecordId);
      // An already-entered atomic sink may finish on cancellation; no later records
      // start after the boundary, and no partial batch is returned as success.
      try { await c.traceSink(evidence); } catch { throw new OperationFailure('failed','TRACE_SINK_FAILED'); }
      check();records.push(evidence);
    }
    return {providerId:this.providerId,status:'success',records};
  }
  private failure(error:unknown):{status:ProviderBatchStatus;errorCode:string} {
    return error instanceof OperationFailure?{status:error.status,errorCode:error.code}:{status:'failed',errorCode:'INVALID_SOURCE_OR_QUERY'};
  }
  async search(query:TransportSearchQuery,c:ProviderContext):Promise<ProviderBatch> {
    try { const parsed=TransportSearchQuerySchema.parse(query);return await this.run(c,check=>this.collect(parsed,c,'search',check)); }
    catch(error) { return {providerId:this.providerId,records:[],...this.failure(error)}; }
  }
  async dateInventory(query:DatePriceQuery,c:ProviderContext):Promise<ProviderDateBatch> {
    try {
      const parsed=DatePriceQuerySchema.parse(query);
      return await this.run(c,async check=>{
        const dates:ProviderDateBatch['dates']=[];
        for(const date of new Set(parsed.dates)) {
          check();const transport={...parsed.query,...parsed.leg==='outbound'?{departureDate:date}:{returnDate:date}};
          try { dates.push({date,batch:await this.collect(TransportSearchQuerySchema.parse(transport),c,'search',check)}); }
          catch(error) { if(error instanceof OperationFailure) throw error;dates.push({date,batch:{providerId:this.providerId,records:[],...this.failure(error)}}); }
        }
        return {providerId:this.providerId,status:'success',dates};
      });
    } catch(error) { return {providerId:this.providerId,dates:[],...this.failure(error)}; }
  }
  async recheck(selection:ProviderQuoteSelection,c:ProviderContext):Promise<ProviderRecheck> {
    try {
      return await this.run(c,async check=>{
        const batch=await this.collect(TransportSearchQuerySchema.parse(selection.query),c,'recheck',check);
        const record=batch.records.find(r=>r.offer?.itinerary.itineraryId===selection.serviceKey);
        const offer=record?.offer;
        if(!offer||batch.status!=='success') return {providerId:this.providerId,status:batch.status,outcome:'unavailable'};
        if(offer.availability.status==='known'&&!offer.availability.value) return {providerId:this.providerId,status:'success',outcome:'sold-out',record};
        const material=(value:typeof offer)=>({total:value.total,conditions:value.conditions,completeness:value.completeness,itinerary:value.itinerary});
        return {providerId:this.providerId,status:'success',outcome:JSON.stringify(material(offer))===JSON.stringify(material(selection.previous))?'unchanged':'changed',record};
      });
    } catch(error) { return {providerId:this.providerId,outcome:'unavailable',...this.failure(error)}; }
  }
}
