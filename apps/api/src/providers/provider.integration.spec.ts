import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkDatabaseReady, createPrisma, SearchRepository, SessionRepository, sessionInfo, type PrismaClient } from '@torob-ticket/data-access';
import { fixtureIdentity } from '@torob-ticket/fixtures';
import { MockProvider } from '@torob-ticket/provider-adapters';
import { FrozenDemoClock } from '../common/clocks';
import type { SessionContext } from '../sessions/session-context';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
import { ProviderService } from './provider.service';
import type { TransportSearchQuery } from '@torob-ticket/contracts';
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-10-25',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
describe('scoped provider evidence on PostgreSQL',()=>{
  let db:PrismaClient;let sessions:SessionRepository;let searches:SearchRepository;let service:ProviderService;
  const contexts:SessionContext[]=[];const now=new Date('2026-10-24T12:00:00Z');
  beforeAll(async()=>{
    db=createPrisma(requireTestDatabaseUrl(process.env.TEST_DATABASE_URL));sessions=new SessionRepository(db,fixtureIdentity);searches=new SearchRepository(db);service=new ProviderService(()=>searches,{now:()=>now});
    for(let i=0;i<2;i++) {const row=await sessions.create(randomUUID(),{seed:5,anchorInstant:'2026-10-24T00:00:00Z'},now);contexts.push({sessionId:row.id,scope:{sessionId:row.id},info:sessionInfo(row),demoClock:new FrozenDemoClock(row.anchorInstant.toISOString())});}
  });
  afterAll(async()=>{if(db){await db.demoSession.deleteMany({where:{id:{in:contexts.map(c=>c.sessionId)}}});await db.$disconnect();}});
  const run=(c:SessionContext)=>searches.create(c.scope,{query,clientGeneration:randomUUID(),snapshot:{}},now);
  it('requires normalization cascade migration before reporting storage ready',async()=>{
    await db.$executeRaw`UPDATE "_prisma_migrations" SET migration_name = 't06-hidden' WHERE migration_name = '0002_normalization_mapping_deferred'`;
    try {await expect(checkDatabaseReady(db,fixtureIdentity)).rejects.toThrow('Migrations are not ready');}
    finally {await db.$executeRaw`UPDATE "_prisma_migrations" SET migration_name = '0002_normalization_mapping_deferred' WHERE migration_name = 't06-hidden'`;}
    await expect(checkDatabaseReady(db,fixtureIdentity)).resolves.toBeUndefined();
  });
  it('retains source identity across runs and reviewers without record-key collisions',async()=>{
    const batches=[];
    for(const c of [contexts[0]!,contexts[0]!,contexts[1]!]) {
      const search=await run(c);const ctx=await service.createContext(c,search.id,new AbortController().signal,new Date(now.getTime()+5000));
      ctx.overrides={'demo-provider-01':{latencyMs:0}};
      const batch=await new MockProvider('demo-provider-01').search(query,ctx);batches.push(batch);
      expect(batch.status).toBe('success');expect(batch.records).toHaveLength(3);
      expect(await db.rawRecord.count({where:{sessionId:c.sessionId,providerRun:{searchId:search.id}}})).toBe(3);
      expect(await db.offerSnapshot.count({where:{sessionId:c.sessionId,searchId:search.id}})).toBe(3);
      const first=batch.records[0]!;
      const saved=await db.rawRecord.findUniqueOrThrow({where:{sessionId_id:{sessionId:c.sessionId,id:first.raw.rawRecordId}}});
      expect(saved.payload).toMatchObject({sourceRawRecordId:first.sourceRawRecordId,raw:first.raw});
      expect((await db.normalizationDecision.findUniqueOrThrow({where:{sessionId_id:{sessionId:c.sessionId,id:first.trace.traceId}}})).rawRecordId).toBe(first.raw.rawRecordId);
    }
    expect(new Set(batches.map(b=>b.records[0]!.raw.rawRecordId)).size).toBe(3);
    expect(new Set(batches.map(b=>b.records[0]!.sourceRawRecordId)).size).toBe(1);
  });
  it('persists repeated date batches once per date with scoped, unambiguous evidence links',async()=>{
    const transport={...query,tripType:'round-trip' as const,returnDate:'2026-10-29'};
    const allRawIds=new Set<string>();
    for(const c of contexts) {
      const search=await searches.create(c.scope,{query:transport,clientGeneration:randomUUID(),snapshot:{}},now);
      const ctx=await service.createContext(c,search.id,new AbortController().signal,new Date(now.getTime()+5000));
      ctx.overrides={'demo-provider-01':{latencyMs:0}};
      const batch=await new MockProvider('demo-provider-01').dateInventory({query:transport,leg:'outbound',dates:['2026-10-26','2026-10-25','2026-10-26','2026-10-27','2026-10-25'],clientGeneration:'duplicate-dates'},ctx);
      expect(batch.status).toBe('success');
      expect(batch.dates.map(d=>d.date)).toEqual(['2026-10-26','2026-10-25','2026-10-27']);
      const records=batch.dates.flatMap(d=>d.batch.records);expect(records).toHaveLength(9);
      expect(await db.rawRecord.count({where:{sessionId:c.sessionId,providerRun:{searchId:search.id}}})).toBe(9);
      expect(await db.normalizationDecision.count({where:{sessionId:c.sessionId,rawRecord:{providerRun:{searchId:search.id}}}})).toBe(9);
      expect(await db.offerSnapshot.count({where:{sessionId:c.sessionId,searchId:search.id}})).toBe(9);
      for(const record of records) {
        expect(allRawIds.has(record.raw.rawRecordId)).toBe(false);allRawIds.add(record.raw.rawRecordId);
        const decision=await db.normalizationDecision.findUniqueOrThrow({where:{sessionId_id:{sessionId:c.sessionId,id:record.trace.traceId}}});
        expect(decision.rawRecordId).toBe(record.raw.rawRecordId);expect(decision.payload).toMatchObject({rawRecordId:record.raw.rawRecordId,offerId:record.offer!.offerId});
        const saved=await db.offerSnapshot.findUniqueOrThrow({where:{sessionId_id:{sessionId:c.sessionId,id:record.offer!.offerId}}});
        expect(saved.searchId).toBe(search.id);
        expect(saved.payload).toMatchObject({offer:{offerId:record.offer!.offerId,provenance:[{rawRecordId:record.raw.rawRecordId}]}});
        expect(record.offer!.itinerary.return!.segments[0]!.departureAt.startsWith('2026-10-29')).toBe(true);
      }
    }
    expect(allRawIds.size).toBe(18);
  });
  it('rejects cross-session run lookup and freezes mapping snapshots at the run revision',async()=>{
    const a=contexts[0]!;const b=contexts[1]!;const search=await run(a);
    await expect(service.createContext(b,search.id,new AbortController().signal,new Date(now.getTime()+5000))).rejects.toMatchObject({code:'NOT_FOUND'});
    const mapping=await sessions.applyMapping(a.scope,'mapping-v1',{entityType:'city',sourceNamespace:'demo-provider-01/v1',sourceValue:'تهران',targetId:'mashhad',baseRevision:'mapping-v1'},now);
    await db.providerOverride.create({data:{sessionId:a.sessionId,providerId:'demo-provider-01',payload:{paused:true}}});
    const historic=await service.createContext(a,search.id,new AbortController().signal,new Date(now.getTime()+5000));
    expect(historic.mappingRevision).toBe('mapping-v1');expect(historic.aliases.some(m=>m.targetId==='mashhad')).toBe(false);expect(historic.overrides['demo-provider-01']?.paused).toBe(true);
    const newer=await run(a);const current=await service.createContext(a,newer.id,new AbortController().signal,new Date(now.getTime()+5000));
    expect(current.mappingRevision).toBe(mapping.id);expect(current.aliases.some(m=>m.targetId==='mashhad')).toBe(true);
    current.overrides={};const batch=await new MockProvider('demo-provider-01').search(query,{...current,overrides:{'demo-provider-01':{latencyMs:0}}});
    expect(batch.records.every(r=>r.trace.outcome==='ambiguous')).toBe(true);
    expect(await db.offerSnapshot.count({where:{sessionId:a.sessionId,searchId:newer.id}})).toBe(0);
  });
  it('persists malformed rejection and rolls back raw/decision/offer atomically on failure',async()=>{
    const c=contexts[1]!;const search=await run(c);const ctx=await service.createContext(c,search.id,new AbortController().signal,new Date(now.getTime()+5000));ctx.overrides={'demo-provider-01':{latencyMs:0}};
    const malformed=await new MockProvider('demo-provider-01',()=>[{rawRecordId:'bad-source',providerId:'demo-provider-01',sourceNamespace:'demo-provider-01/v1',fixtureVersion:ctx.fixtureVersion,observedAt:'2026-10-24T00:00:00Z',payload:{broken:true}}]).search(query,ctx);
    expect(malformed.records[0]?.trace.outcome).toBe('rejected');expect(await db.normalizationDecision.count({where:{sessionId:c.sessionId,rawRecord:{providerRun:{searchId:search.id}}}})).toBe(1);
    const next=await run(c);const nextCtx=await service.createContext(c,next.id,new AbortController().signal,new Date(now.getTime()+5000));nextCtx.overrides={'demo-provider-01':{latencyMs:0}};
    await db.$executeRawUnsafe(`ALTER TABLE "NormalizationDecision" ADD CONSTRAINT t06_reject_decision CHECK (payload->>'outcome' <> 'accepted') NOT VALID`);
    try {
      const failed=await new MockProvider('demo-provider-01').search(query,nextCtx);expect(failed.errorCode).toBe('TRACE_SINK_FAILED');
      expect(await db.rawRecord.count({where:{sessionId:c.sessionId,providerRun:{searchId:next.id}}})).toBe(0);
      expect(await db.offerSnapshot.count({where:{sessionId:c.sessionId,searchId:next.id}})).toBe(0);
    } finally {await db.$executeRawUnsafe('ALTER TABLE "NormalizationDecision" DROP CONSTRAINT t06_reject_decision');}
    const evidence=malformed.records[0]!;
    await expect(searches.appendNormalizationEvidence(contexts[0]!.scope,{...evidence,searchId:search.id})).rejects.toMatchObject({code:'NOT_FOUND'});
    await expect(searches.appendNormalizationEvidence(c.scope,{...evidence,raw:{...evidence.raw,rawRecordId:'bad-revision'},trace:{...evidence.trace,rawRecordId:'bad-revision',mappingRevision:'other'},searchId:search.id})).rejects.toMatchObject({code:'MAPPING_COLLISION'});
  });
  it('keeps orphan and other-session mapping references invalid at transaction commit',async()=>{
    const b=contexts[1]!;
    const raw=await db.rawRecord.findFirstOrThrow({where:{sessionId:b.sessionId}});
    const other=await db.mappingRevision.findFirstOrThrow({where:{sessionId:contexts[0]!.sessionId,parentId:{not:null}}});
    for(const mappingRevision of ['missing-mapping',other.id]) {
      let inserted=false;
      await expect(db.$transaction(async tx=>{
        await tx.normalizationDecision.create({data:{sessionId:b.sessionId,id:randomUUID(),rawRecordId:raw.id,mappingRevision,payload:{},createdAt:now}});
        inserted=true;
      })).rejects.toThrow();
      expect(inserted).toBe(true);
    }
  });
  it('resets a session with accepted/rejected traces and a mapping revision chain',async()=>{
    const a=contexts[0]!;const search=await run(a);const ctx=await service.createContext(a,search.id,new AbortController().signal,new Date(now.getTime()+5000));
    await new MockProvider('demo-provider-01',()=>[{rawRecordId:'reset-rejected',providerId:'demo-provider-01',sourceNamespace:'demo-provider-01/v1',fixtureVersion:ctx.fixtureVersion,observedAt:now.toISOString(),payload:{bad:true}}]).search(query,{...ctx,overrides:{'demo-provider-01':{latencyMs:0}}});
    expect(await db.normalizationDecision.count({where:{sessionId:a.sessionId}})).toBeGreaterThan(0);
    const replacement=await sessions.reset(a.scope,randomUUID(),{seed:5},new Date(now.getTime()+3600000));
    contexts[0]={sessionId:replacement.id,scope:{sessionId:replacement.id},info:sessionInfo(replacement),demoClock:new FrozenDemoClock(replacement.anchorInstant.toISOString())};
    expect(await db.rawRecord.count({where:{sessionId:a.sessionId}})).toBe(0);
    expect(await db.normalizationDecision.count({where:{sessionId:a.sessionId}})).toBe(0);
    expect(await db.offerSnapshot.count({where:{sessionId:a.sessionId}})).toBe(0);
    expect(await db.demoSession.count({where:{id:contexts[1]!.sessionId}})).toBe(1);
  });
  it('expires sessions with normalization evidence and mapping chains',async()=>{
    const b=contexts[1]!;
    await sessions.applyMapping(b.scope,'mapping-v1',{entityType:'city',sourceNamespace:'demo-provider-01/v1',sourceValue:'old-alias',targetId:'tehran',baseRevision:'mapping-v1'},now);
    const removed=await sessions.cleanup(new Date(now.getTime()+24*3600000+1));
    expect(removed).toContain(b.sessionId);
    expect(await db.normalizationDecision.count({where:{sessionId:b.sessionId}})).toBe(0);
    expect(await db.demoSession.count({where:{id:contexts[0]!.sessionId}})).toBe(1);
  });

});
