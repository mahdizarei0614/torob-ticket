import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as data from '@torob-ticket/data-access';
import type { DataScope, PrismaClient } from '@torob-ticket/data-access';

describe('scoped persistence and atomic evidence', () => {
  let db: PrismaClient;
  let a: DataScope;
  let b: DataScope;
  let mapping: string;
  const now = new Date('2026-10-24T14:00:00.000Z');
  beforeAll(async () => {
    const url = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    db = data.createPrisma(url);
    const repo = new data.SessionRepository(db);
    const sa = await repo.create(createHash('sha256').update(randomUUID()).digest('hex'), {seed:5}, now);
    const sb = await repo.create(createHash('sha256').update(randomUUID()).digest('hex'), {seed:5}, now);
    a = {sessionId:sa.id}; b = {sessionId:sb.id}; mapping = sa.mappingRevision;
  });
  afterAll(async () => { if (db) { await db.demoSession.deleteMany({where:{id:{in:[a?.sessionId,b?.sessionId].filter(Boolean)}}}); await db.$disconnect(); } });
  it('scopes search lookup and retry references to the authenticated session', async () => {
    expect(data).toHaveProperty('SearchRepository');
    const repo = new data.SearchRepository(db);
    const run = await repo.create(a, {query:{}, clientGeneration:'g1', snapshot:{status:'collecting'}}, now);
    expect(await repo.get(a,run.id)).toMatchObject({id:run.id});
    await expect(repo.get(b,run.id)).rejects.toMatchObject({code:'NOT_FOUND'});
    await expect(repo.create(b,{query:{},clientGeneration:'g2',snapshot:{},predecessorId:run.id},now)).rejects.toMatchObject({code:'NOT_FOUND'});
    const retry = await repo.create(a,{query:{},clientGeneration:'g2',snapshot:{},predecessorId:run.id},now);
    expect(retry.predecessorId).toBe(run.id);
    expect(retry.mappingRevision).toBe(mapping);
  });
  it('applies mapping plus audit atomically without rewriting old evidence', async () => {
    const repo = new data.SessionRepository(db);
    const revision = await repo.applyMapping(a,mapping,{target:'city'},now);
    expect(await db.auditEvent.count({where:{sessionId:a.sessionId,kind:'mapping-applied'}})).toBe(1);
    await expect(repo.applyMapping(a,mapping,{target:'different'},now)).rejects.toMatchObject({code:'MAPPING_COLLISION'});
    expect(await db.mappingRevision.count({where:{sessionId:a.sessionId}})).toBe(2);
    expect((await db.demoSession.findUniqueOrThrow({where:{id:a.sessionId}})).mappingRevision).toBe(revision.id);
    await expect(db.mappingRevision.update({where:{sessionId_id:{sessionId:a.sessionId,id:mapping}},data:{patch:{tampered:true}}})).rejects.toThrow(/append-only/);
  });
  it('appends quote versions with ordered events atomically, rejects stale versions, and refuses incomplete quotes as referral authority', async () => {
    expect(data).toHaveProperty('SearchRepository'); expect(data).toHaveProperty('ReferralRepository');
    const searches = new data.SearchRepository(db);
    const referrals = new data.ReferralRepository(db);
    const run = await searches.create(a,{query:{},clientGeneration:'quote-test',snapshot:{}},now);
    await db.offerSnapshot.create({data:{sessionId:a.sessionId,id:'offer',searchId:run.id,payload:{},createdAt:now}});
    const quote = await searches.appendQuoteVersion(a,{searchId:run.id,quoteId:'quote',expectedVersion:0,offerId:'offer',payload:{price:100},event:{type:'snapshot'},expiresAt:new Date(now.getTime()+600000)},now);
    expect(quote.version).toBe(1);
    await searches.appendQuoteVersion(a,{searchId:run.id,quoteId:'quote',expectedVersion:1,offerId:'offer',payload:{price:110},event:{type:'snapshot'},expiresAt:new Date(now.getTime()+600000)},now);
    await expect(searches.appendQuoteVersion(a,{searchId:run.id,quoteId:'quote',expectedVersion:1,offerId:'offer',payload:{price:120},event:{},expiresAt:now},now)).rejects.toMatchObject({code:'QUOTE_CHANGED'});
    expect(await db.quote.count({where:{sessionId:a.sessionId,id:'quote'}})).toBe(2);
    expect((await db.searchEventRecord.findMany({where:{sessionId:a.sessionId,searchId:run.id},orderBy:{sequence:'asc'}})).map(row=>row.sequence)).toEqual([1,2]);
    expect((await db.quote.findUniqueOrThrow({where:{sessionId_id_version:{sessionId:a.sessionId,id:'quote',version:1}}})).payload).toEqual({price:100});
    await expect(db.quote.update({where:{sessionId_id_version:{sessionId:a.sessionId,id:'quote',version:1}},data:{payload:{price:1}}})).rejects.toThrow(/append-only/);
    await expect(referrals.admit(a,{kind:'transport',quoteId:'quote',quoteVersion:2},{now:()=>now})).rejects.toMatchObject({code:'INCOMPLETE_PRICE'});
    expect(await db.referralIntent.count({where:{sessionId:a.sessionId}})).toBe(0);
  });
  it('rolls back quote and mapping writes if their evidence append fails', async () => {
    const searches = new data.SearchRepository(db);
    const sessions = new data.SessionRepository(db);
    const run = await searches.create(a,{query:{},clientGeneration:'rollback',snapshot:{}},now);
    await db.offerSnapshot.create({data:{sessionId:a.sessionId,id:'rollback-offer',searchId:run.id,payload:{},createdAt:now}});
    await db.$executeRawUnsafe(`ALTER TABLE "SearchEventRecord" ADD CONSTRAINT t04_fail_event CHECK (NOT (payload ? 'forceFailure'))`);
    try {
      await expect(searches.appendQuoteVersion(a,{searchId:run.id,quoteId:'rollback-quote',expectedVersion:0,offerId:'rollback-offer',payload:{price:1},event:{forceFailure:true},expiresAt:now},now)).rejects.toThrow();
      expect(await db.quote.count({where:{sessionId:a.sessionId,id:'rollback-quote'}})).toBe(0);
    } finally { await db.$executeRawUnsafe('ALTER TABLE "SearchEventRecord" DROP CONSTRAINT t04_fail_event'); }
    const session = await db.demoSession.findUniqueOrThrow({where:{id:a.sessionId}});
    const before = await db.mappingRevision.count({where:{sessionId:a.sessionId}});
    await db.$executeRawUnsafe(`ALTER TABLE "AuditEvent" ADD CONSTRAINT t04_fail_audit CHECK (kind <> 'mapping-applied') NOT VALID`);
    try {
      await expect(sessions.applyMapping(a,session.mappingRevision,{target:'rollback'},now)).rejects.toThrow();
      expect(await db.mappingRevision.count({where:{sessionId:a.sessionId}})).toBe(before);
      expect((await db.demoSession.findUniqueOrThrow({where:{id:a.sessionId}})).mappingRevision).toBe(session.mappingRevision);
    } finally { await db.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT t04_fail_audit'); }
  });
  it('freezes terminal search evidence and its source revision', async () => {
    const repo = new data.SearchRepository(db);
    const run = await repo.create(a,{query:{route:'original'},clientGeneration:'frozen',snapshot:{status:'complete'}},now);
    await db.searchRun.update({where:{sessionId_id:{sessionId:a.sessionId,id:run.id}},data:{status:'complete'}});
    await expect(db.searchRun.update({where:{sessionId_id:{sessionId:a.sessionId,id:run.id}},data:{snapshot:{altered:true}}})).rejects.toThrow(/immutable search/);
  });
  it('rejects cross-session foreign keys and immutable fixture mutation', async () => {
    await expect(db.auditEvent.create({data:{sessionId:'missing-session',id:randomUUID(),kind:'bad',payload:{},createdAt:now}})).rejects.toThrow();
    await expect(db.fixtureVersion.update({where:{id:'foundation-v1'},data:{catalogRevision:'overwrite'}})).rejects.toThrow(/immutable fixture/);
    expect(await db.fixtureVersion.count({where:{id:'foundation-v1'}})).toBe(1);
  });
});
