import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {createPrisma,SearchRepository,SessionRepository,sessionInfo,type DataScope,type PrismaClient} from '@torob-ticket/data-access';
import {catalogForIdentity,fixtureIdentity,generateProviderRecords} from '@torob-ticket/fixtures';
import {normalizeRecord} from '@torob-ticket/domain';
import {decodeRawRecord,MockProvider} from '@torob-ticket/provider-adapters';
import type {TransportSearchQuery} from '@torob-ticket/contracts';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';
import {ProviderService} from './provider.service';
import {FrozenDemoClock} from '../common/clocks';
import type {SessionContext} from '../sessions/session-context';
const now=new Date('2026-10-29T12:00:00Z'),anchor='2026-10-29T00:00:00Z';
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-01',party:{adults:2,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
let db:PrismaClient,repository:SearchRepository;const owners:SessionContext[]=[];
beforeAll(async()=>{db=createPrisma(requireTestDatabaseUrl(process.env.TEST_DATABASE_URL));repository=new SearchRepository(db);for(const fixtureVersion of ['showcase-v1','showcase-v2',fixtureIdentity.fixtureVersion,fixtureIdentity.fixtureVersion]){
 const catalog=catalogForIdentity(fixtureVersion,fixtureVersion==='showcase-v1'?'catalog-v1':fixtureVersion==='showcase-v2'?'catalog-v2':fixtureIdentity.catalogRevision);
 const row=await new SessionRepository(db,{fixtureVersion,catalogRevision:catalog.catalogRevision}).create(randomUUID(),{seed:5151,anchorInstant:anchor},now);
 owners.push({sessionId:row.id,scope:{sessionId:row.id},info:sessionInfo(row),demoClock:new FrozenDemoClock(anchor)});
}});
afterAll(async()=>{if(db){try{if(owners.length)await db.demoSession.deleteMany({where:{id:{in:owners.map(owner=>owner.sessionId)}}});}finally{await db.$disconnect();}}});
async function rows(owner=owners[2]!){
 const run=await repository.create(owner.scope,{query,clientGeneration:randomUUID(),snapshot:{}},now);
 const catalog=catalogForIdentity(owner.info.fixtureVersion,owner.info.catalogRevision);
 const evidence=generateProviderRecords({fixtureVersion:owner.info.fixtureVersion,seed:5151,anchorInstant:anchor,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',query},'demo-provider-01').map(original=>{
  const raw={...original,rawRecordId:randomUUID()},decoded=decodeRawRecord(raw);decoded.sourceRawRecordId=original.rawRecordId;
  return{searchId:run.id,raw,sourceRawRecordId:original.rawRecordId,...normalizeRecord(decoded,{query,catalog,mappingRevision:'mapping-v1',aliases:[],realClock:{now:()=>now}})};
 });return{owner,run,evidence};
}
async function wideRows(count:number){
 const owner=owners[2]!;
 const run=await repository.create(owner.scope,{query,clientGeneration:randomUUID(),snapshot:{}},now);
 const catalog=catalogForIdentity(owner.info.fixtureVersion,owner.info.catalogRevision);
 const evidence=Array.from({length:Math.ceil(count/12)},(_,offset)=>{
  const datedQuery={...query,departureDate:new Date(Date.UTC(2026,10,1+offset)).toISOString().slice(0,10)};
  return generateProviderRecords({fixtureVersion:owner.info.fixtureVersion,seed:5151,anchorInstant:anchor,scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',query:datedQuery},'demo-provider-01').map(original=>{
   const raw={...original,rawRecordId:randomUUID()},decoded=decodeRawRecord(raw);decoded.sourceRawRecordId=original.rawRecordId;
   return{searchId:run.id,raw,sourceRawRecordId:original.rawRecordId,...normalizeRecord(decoded,{query:datedQuery,catalog,mappingRevision:'mapping-v1',aliases:[],realClock:{now:()=>now}})};
  });
 }).flat().slice(0,count);
 return{owner,run,evidence};
}
async function counts(scope:DataScope,searchId:string){return{raw:await db.rawRecord.count({where:{sessionId:scope.sessionId,providerRun:{searchId}}}),decisions:await db.normalizationDecision.count({where:{sessionId:scope.sessionId,rawRecord:{providerRun:{searchId}}}}),offers:await db.offerSnapshot.count({where:{sessionId:scope.sessionId,searchId}}),providers:await db.providerRun.count({where:{sessionId:scope.sessionId,searchId}})};}
it('persists exact v1/v2/v3 successful payloads through the wired batch service and keeps row instrumentation effective',async()=>{
 for(const owner of owners.slice(0,3)){
  const run=await repository.create(owner.scope,{query,clientGeneration:randomUUID(),snapshot:{}},now),service=new ProviderService(()=>repository,{now:()=>now});
  const context=await service.createContext(owner,run.id,new AbortController().signal,new Date(now.getTime()+5000));context.overrides={'demo-provider-01':{latencyMs:0}};
  expect(context.traceBatchSink).toBeTypeOf('function');expect(context.traceBatchSink?.maxRows).toBe(96);const result=await new MockProvider('demo-provider-01').search(query,context),expected=owner.info.fixtureVersion==='showcase-v3'?12:3;
  expect(result.status).toBe('success');expect(result.records).toHaveLength(expected);expect(await counts(owner.scope,run.id)).toEqual({raw:expected,decisions:expected,offers:expected,providers:1});
  for(const record of result.records){expect((await db.rawRecord.findUniqueOrThrow({where:{sessionId_id:{sessionId:owner.sessionId,id:record.raw.rawRecordId}}})).payload).toEqual({sourceRawRecordId:record.sourceRawRecordId,raw:record.raw});expect((await db.offerSnapshot.findUniqueOrThrow({where:{sessionId_id:{sessionId:owner.sessionId,id:record.offer!.offerId}}})).payload).toEqual({offer:record.offer,source:record.source});}
 }
 const {owner,run}=await rows(),service=new ProviderService(()=>repository,{now:()=>now}),context=await service.createContext(owner,run.id,new AbortController().signal,new Date(now.getTime()+5000));
 const sink=context.traceSink;let calls=0;context.traceSink=async record=>{calls++;await sink(record);};expect(context.traceBatchSink).toBeUndefined();context.overrides={'demo-provider-01':{latencyMs:0}};
 expect((await new MockProvider('demo-provider-01').search(query,context)).status).toBe('success');expect(calls).toBe(12);
});
it('keeps repository row-only instrumentation on its original sequential path',async()=>{
 const {owner,run}=await rows();let calls=0;class RowOnly extends SearchRepository{override appendNormalizationEvidence(...args:Parameters<SearchRepository['appendNormalizationEvidence']>){calls++;return super.appendNormalizationEvidence(...args);}}
 const context=await new ProviderService(()=>new RowOnly(db),{now:()=>now}).createContext(owner,run.id,new AbortController().signal,new Date(now.getTime()+5000));expect(context.traceBatchSink).toBeUndefined();context.overrides={'demo-provider-01':{latencyMs:0}};expect((await new MockProvider('demo-provider-01').search(query,context)).status).toBe('success');expect(calls).toBe(12);
});
it('retains a malformed raw rejection in the same atomic batch as eleven accepted offers',async()=>{
 const {owner,run,evidence}=await rows(),record=evidence[4]!;record.raw.payload={broken:true};const decoded={raw:record.raw,sourceRawRecordId:record.sourceRawRecordId,trace:{traceId:record.trace.traceId,rawRecordId:record.raw.rawRecordId,mappingRevision:'mapping-v1',outcome:'rejected' as const,decisions:[],issues:[{code:'MALFORMED_RAW',fieldPath:['payload'],severity:'rejected' as const,rawRecordId:record.raw.rawRecordId}],observedAt:now.toISOString()}};evidence[4]={searchId:run.id,...decoded};
 await repository.appendNormalizationEvidenceBatch(owner.scope,evidence);expect(await counts(owner.scope,run.id)).toEqual({raw:12,decisions:12,offers:11,providers:1});
});
it.each(['provider','search','mapping','fixture','source-revision','source-binding','trace-binding','provenance','duplicate-raw','duplicate-trace','duplicate-offer'] as const)('rejects a bad later row before any prefix persists: %s',async cause=>{
 const {owner,run,evidence}=await rows(),last=evidence.at(-1)!;
 if(cause==='provider')last.raw.providerId='demo-provider-02';if(cause==='search')last.searchId=randomUUID();if(cause==='mapping')last.trace.mappingRevision='mapping-other';if(cause==='fixture')last.raw.fixtureVersion='showcase-v1';
 if(cause==='source-revision'){last.source!.sourceRevision='source-other';last.offer!.provenance.forEach(item=>{item.sourceRevision='source-other';});}
 if(cause==='source-binding')last.source!.sourceRawRecordId='other-source';if(cause==='trace-binding')last.trace.rawRecordId='other-raw';if(cause==='provenance')last.offer!.provenance[0]!.sourceNamespace='other';
 if(cause==='duplicate-raw')last.raw.rawRecordId=evidence[0]!.raw.rawRecordId;if(cause==='duplicate-trace')last.trace.traceId=evidence[0]!.trace.traceId;if(cause==='duplicate-offer')last.offer!.offerId=evidence[0]!.offer!.offerId;
 await expect(repository.appendNormalizationEvidenceBatch(owner.scope,evidence)).rejects.toThrow();expect(await counts(owner.scope,run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});
});
it('rejects cross-session scope, completed provider and cancelled run while preserving other reviewer evidence',async()=>{
 const a=await rows(),b=await rows(owners[3]!);await repository.appendNormalizationEvidenceBatch(b.owner.scope,b.evidence);
 await expect(repository.appendNormalizationEvidenceBatch(b.owner.scope,a.evidence)).rejects.toMatchObject({code:'NOT_FOUND'});
 await db.providerRun.create({data:{sessionId:a.owner.sessionId,searchId:a.run.id,id:randomUUID(),providerId:'demo-provider-01',status:'complete',payload:{}}});
 await expect(repository.appendNormalizationEvidenceBatch(a.owner.scope,a.evidence)).rejects.toMatchObject({code:'NOT_FOUND'});expect(await counts(b.owner.scope,b.run.id)).toEqual({raw:12,decisions:12,offers:12,providers:1});
 const cancelled=await rows();await repository.cancel(cancelled.owner.scope,cancelled.run.id,now);await expect(repository.appendNormalizationEvidenceBatch(cancelled.owner.scope,cancelled.evidence)).rejects.toMatchObject({code:'NOT_FOUND'});
});
it('rolls back raw and decision bulk inserts when the final offer bulk insert conflicts',async()=>{
 const {owner,run,evidence}=await rows(),conflict=evidence.at(-1)!.offer!.offerId;
 await db.offerSnapshot.create({data:{sessionId:owner.sessionId,id:conflict,searchId:run.id,payload:{existing:true},createdAt:now}});
 await expect(repository.appendNormalizationEvidenceBatch(owner.scope,evidence)).rejects.toThrow();expect(await counts(owner.scope,run.id)).toEqual({raw:0,decisions:0,offers:1,providers:0});
 expect((await db.offerSnapshot.findUniqueOrThrow({where:{sessionId_id:{sessionId:owner.sessionId,id:conflict}}})).payload).toEqual({existing:true});
});
it('accepts96 distinct normalized source rows atomically and rejects97 otherwise valid rows without committing a prefix',async()=>{
 const accepted=await wideRows(96);
 expect(accepted.evidence).toHaveLength(96);
 expect(new Set(accepted.evidence.map(row=>row.raw.rawRecordId)).size).toBe(96);
 expect(new Set(accepted.evidence.map(row=>row.trace.traceId)).size).toBe(96);
 expect(new Set(accepted.evidence.map(row=>row.offer!.offerId)).size).toBe(96);
 await repository.appendNormalizationEvidenceBatch(accepted.owner.scope,accepted.evidence);
 expect(await counts(accepted.owner.scope,accepted.run.id)).toEqual({raw:96,decisions:96,offers:96,providers:1});
 for(const row of [accepted.evidence[0]!,accepted.evidence.at(-1)!]){
  const raw=await db.rawRecord.findUniqueOrThrow({where:{sessionId_id:{sessionId:accepted.owner.sessionId,id:row.raw.rawRecordId}}});
  const trace=await db.normalizationDecision.findUniqueOrThrow({where:{sessionId_id:{sessionId:accepted.owner.sessionId,id:row.trace.traceId}}});
  const offer=await db.offerSnapshot.findUniqueOrThrow({where:{sessionId_id:{sessionId:accepted.owner.sessionId,id:row.offer!.offerId}}});
  expect(raw.payload).toEqual({sourceRawRecordId:row.sourceRawRecordId,raw:row.raw});expect(raw.observedAt).toEqual(new Date(row.raw.observedAt));
  expect(trace.payload).toEqual(row.trace);expect(trace.createdAt).toEqual(new Date(row.trace.observedAt));
  expect(offer.payload).toEqual({offer:row.offer,source:row.source});expect(offer.createdAt).toEqual(new Date(row.trace.observedAt));
 }
 const refused=await wideRows(97);
 expect(refused.evidence).toHaveLength(97);
 expect(refused.evidence.every(row=>row.offer&&row.source&&row.trace.outcome==='accepted')).toBe(true);
 expect(new Set(refused.evidence.map(row=>row.raw.rawRecordId)).size).toBe(97);
 expect(new Set(refused.evidence.map(row=>row.trace.traceId)).size).toBe(97);
 expect(new Set(refused.evidence.map(row=>row.offer!.offerId)).size).toBe(97);
 await expect(repository.appendNormalizationEvidenceBatch(refused.owner.scope,refused.evidence)).rejects.toMatchObject({code:'INVALID_QUERY'});
 expect(await counts(refused.owner.scope,refused.run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});
});
it('validates the96th source binding before committing any part of a maximum-size batch',async()=>{
 const {owner,run,evidence}=await wideRows(96);
 evidence.at(-1)!.source!.sourceRawRecordId='not-the-recorded-source';
 await expect(repository.appendNormalizationEvidenceBatch(owner.scope,evidence)).rejects.toMatchObject({code:'INVALID_QUERY'});
 expect(await counts(owner.scope,run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});
});
it('checks owned run authority before exposing a malformed row from another session',async()=>{
 const a=await wideRows(96),b=await rows(owners[3]!);
 a.evidence[0]!.trace.traceId='';
 await expect(repository.appendNormalizationEvidenceBatch(b.owner.scope,a.evidence)).rejects.toMatchObject({code:'NOT_FOUND'});
 expect(await counts(a.owner.scope,a.run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});
 expect(await counts(b.owner.scope,b.run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});
});
it('retains session expiry precedence over a malformed batch search identifier',async()=>{
 const {owner,run,evidence}=await wideRows(96);evidence[0]!.searchId='';
 await expect(repository.appendNormalizationEvidenceBatch({sessionId:randomUUID()},evidence)).rejects.toMatchObject({code:'SESSION_EXPIRED'});
 expect(await counts(owner.scope,run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});
});
it('retains an earlier locked revision failure before a later row schema failure',async()=>{
 const {owner,run,evidence}=await wideRows(96),first=evidence[0]!;
 first.trace.mappingRevision='mapping-other';first.offer!.provenance.forEach(item=>{item.mappingRevision='mapping-other';});
 evidence.at(-1)!.raw.fixtureVersion='';
 await expect(repository.appendNormalizationEvidenceBatch(owner.scope,evidence)).rejects.toMatchObject({code:'MAPPING_COLLISION'});
 expect(await counts(owner.scope,run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});
});
it('retains an earlier binding failure before a later locked revision mismatch',async()=>{
 const {owner,run,evidence}=await wideRows(96),last=evidence.at(-1)!;
 evidence[0]!.source!.sourceRawRecordId='not-the-recorded-source';
 last.trace.mappingRevision='mapping-other';last.offer!.provenance.forEach(item=>{item.mappingRevision='mapping-other';});
 await expect(repository.appendNormalizationEvidenceBatch(owner.scope,evidence)).rejects.toMatchObject({code:'INVALID_QUERY'});
 expect(await counts(owner.scope,run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});
});
it('rejects repeated persisted IDs atomically without skipDuplicates and enforces the encoded byte bound',async()=>{
 const {owner,run,evidence}=await rows();await repository.appendNormalizationEvidenceBatch(owner.scope,evidence);
 await expect(repository.appendNormalizationEvidenceBatch(owner.scope,evidence)).rejects.toThrow();expect(await counts(owner.scope,run.id)).toEqual({raw:12,decisions:12,offers:12,providers:1});
 const large=structuredClone(evidence);large[0]!.raw.payload='x'.repeat(4*1024*1024);await expect(repository.appendNormalizationEvidenceBatch(owner.scope,large)).rejects.toMatchObject({code:'INVALID_QUERY'});
});
it.each(['raw','offer'] as const)('rolls back an already-entered atomic batch cancelled after the %s bulk write',async stage=>{
 const {owner,run,evidence}=await wideRows(96),controller=new AbortController();let observed=false;
 const extended=db.$extends({query:{rawRecord:{async createMany({args,query}){const result=await query(args);if(stage==='raw'){observed=true;controller.abort();}return result;}},offerSnapshot:{async createMany({args,query}){const result=await query(args);if(stage==='offer'){observed=true;controller.abort();}return result;}}}});
 const assertActive=()=>{if(controller.signal.aborted)throw new Error('operation-cancelled');};
 await expect(new SearchRepository(extended as unknown as PrismaClient).appendNormalizationEvidenceBatch(owner.scope,evidence,assertActive)).rejects.toThrow('operation-cancelled');expect(observed).toBe(true);expect(await counts(owner.scope,run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});
});
it('fences cancelled lock wait and snapshots caller-owned input before a queued append',async()=>{
 for(const cancel of [true,false]){
  const {owner,run,evidence}=await wideRows(96),captured=structuredClone(evidence);let entered!:()=>void,release!:()=>void;
  const locked=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
  const holder=db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "DemoSession" WHERE id=${owner.sessionId} FOR UPDATE`;entered();await gate;});await locked;
  const controller=new AbortController(),work=repository.appendNormalizationEvidenceBatch(owner.scope,evidence,()=>{if(controller.signal.aborted)throw new Error('queued-cancelled');});
  const observed=work.then(()=>null,error=>error as Error);evidence[0]!.raw.payload='mutated after call';evidence.push(...Array.from({length:40},()=>evidence[0]!));if(cancel)controller.abort();release();await holder;
  const failure=await observed;
  if(cancel){expect(failure?.message).toBe('queued-cancelled');expect(await counts(owner.scope,run.id)).toEqual({raw:0,decisions:0,offers:0,providers:0});}
  else{expect(failure).toBeNull();expect(await counts(owner.scope,run.id)).toEqual({raw:96,decisions:96,offers:96,providers:1});expect((await db.rawRecord.findUniqueOrThrow({where:{sessionId_id:{sessionId:owner.sessionId,id:captured[0]!.raw.rawRecordId}}})).payload).toEqual({raw:captured[0]!.raw,sourceRawRecordId:captured[0]!.sourceRawRecordId});}
 }
});
