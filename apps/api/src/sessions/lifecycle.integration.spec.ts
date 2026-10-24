import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { Controller, Get, Inject, Param, Post, Req, UseGuards, type INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionInfoSchema } from '@torob-ticket/contracts';
import { createPrisma, SearchRepository, SessionRepository, type PrismaClient } from '@torob-ticket/data-access';
import { AppModule } from '../app.module';
import { SystemRealClock } from '../common/clocks';
import { SessionModule } from './session.module';
import { SessionGuard } from './session.guard';
import { SessionService, repositoryHttpError } from './session.service';
import type { SessionRequest } from './session-context';

class ControlledRealClock extends SystemRealClock {
  instant = new Date('2026-10-24T12:00:00.000Z');
  override now() { return new Date(this.instant); }
  advance(ms: number) { this.instant = new Date(this.instant.getTime() + ms); }
}
// Test-only HTTP boundary exercises the production guard and scoped repository.
@Controller('test-audit')
@UseGuards(SessionGuard)
class AuditHarness {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
  @Post(':id/work')
  async work(@Req() request: SessionRequest, @Param('id') abandonedId: string) {
    const searches = new SearchRepository(this.sessions.database);
    const scope = request.sessionContext!.scope;
    const abandoned = await searches.get(scope, abandonedId);
    const admitted = await searches.create(scope, { query: {}, clientGeneration: 'after-recovery', snapshot: { status: 'collecting' } }, this.sessions.realClock.now());
    return { id: admitted.id, abandonedStatusAtAdmission: abandoned.status };
  }
  @Get(':id')
  async read(@Req() request: SessionRequest, @Param('id') id: string) {
    try { return await this.sessions.repository.getAudit(request.sessionContext!.scope, id); }
    catch (error) { return repositoryHttpError(error); }
  }
}

describe('session isolation and lifecycle', () => {
  let app: INestApplication;
  let base: string;
  let db: PrismaClient;
  let sessions: SessionService;
  const clock = new ControlledRealClock();
  const ids: string[] = [];
  async function start() {
    const module = await Test.createTestingModule({ imports: [AppModule, SessionModule], controllers: [AuditHarness] }).overrideProvider(SystemRealClock).useValue(clock).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1'); base = await app.getUrl(); sessions = app.get(SessionService);
  }
  async function post(path: string, input: unknown = {}, cookie?: string) {
    return fetch(`${base}/api/v1/demo/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(input) });
  }
  async function create() {
    const response = await post('session', {seed: 101, anchorInstant: '2026-09-01T00:00:00.000Z'});
    expect(response.status).toBe(201);
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const info = SessionInfoSchema.parse(await response.json());
    const context = await sessions.authenticate({headers: {cookie}}, {setHeader: () => undefined});
    ids.push(context.sessionId);
    return {cookie, info, context};
  }
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Dedicated *_test PostgreSQL database required');
    process.env.DATABASE_URL = url; db = createPrisma(url); await start();
  });
  afterAll(async () => {
    await app?.close();
    if (db) { await db.demoSession.deleteMany({where: {id: {in: ids}}}); await db.$disconnect(); }
  });
  it('separates cookie credentials from IDs, isolates audit reads, and rejects ownership selectors', async () => {
    const a = await create(); const b = await create();
    const audit = await sessions.repository.appendAudit(a.context.scope, 'test-evidence', {proof: 'A'}, clock.now());
    const read = (cookie: string, suffix = '') => fetch(`${base}/api/test-audit/${audit.id}${suffix}`, {headers: {cookie}});
    expect((await read(a.cookie)).status).toBe(200);
    const denied = await read(b.cookie); expect(denied.status).toBe(404); expect(await denied.json()).toMatchObject({code: 'NOT_FOUND'});
    expect((await read(`torob_demo=${a.context.sessionId}`)).status).toBe(401);
    expect((await read(b.cookie, `?sessionId=${a.context.sessionId}`)).status).toBe(400);
    expect((await post('reset', {sessionId: a.context.sessionId}, b.cookie)).status).toBe(400);
    expect(await db.auditEvent.count({where: {sessionId: a.context.sessionId}})).toBe(1);
    expect((await post('reset')).status).toBe(401);
  });
  it('uses the same initial revisions for the same reproducible inputs', async () => {
    const a = await create(); const b = await create();
    expect(a.info.mappingRevision).toBe(b.info.mappingRevision);
    expect(a.info.scenarioRevision).toBe(b.info.scenarioRevision);
  });
  it('resumes matching overrides but requires explicit reset for conflicting overrides', async () => {
    const a = await create();
    expect((await post('session', {}, a.cookie)).status).toBe(201);
    expect((await post('session', {seed: 101}, a.cookie)).status).toBe(201);
    const conflict = await post('session', {seed: 102}, a.cookie);
    expect(conflict.status).toBe(409); expect(await conflict.json()).toMatchObject({code: 'INVALID_QUERY'});
    const fresh = await post('reset', {seed: 102, scenario: 'slow-provider'}, a.cookie);
    expect(fresh.status).toBe(201); expect(await fresh.json()).toMatchObject({seed: 102, scenario: 'slow-provider', anchorInstant: '2026-09-01T00:00:00.000Z'});
    const newCookie = fresh.headers.get('set-cookie')!.split(';')[0]!;
    expect(newCookie).not.toBe(a.cookie);
    expect((await post('session', {}, a.cookie)).status).toBe(401);
    const next = await sessions.authenticate({headers: {cookie: newCookie}}, {setHeader: () => undefined}); ids.push(next.sessionId);
    expect(next.sessionId).not.toBe(a.context.sessionId);
  });
  it('touches inactivity using real time while keeping demo time frozen, and expires at 24 hours', async () => {
    const a = await create();
    clock.advance(23 * 3600000);
    const resumed = SessionInfoSchema.parse(await (await post('session', {}, a.cookie)).json());
    expect(resumed.anchorInstant).toBe('2026-09-01T00:00:00.000Z');
    expect(resumed.expiresAt).toBe('2026-10-26T11:00:00.000Z');
    expect(a.context.demoClock.now().toISOString()).toBe('2026-09-01T00:00:00.000Z');
    a.context.demoClock.now().setUTCFullYear(2000);
    expect(a.context.demoClock.now().toISOString()).toBe('2026-09-01T00:00:00.000Z');
    clock.advance(24 * 3600000);
    const expired = await post('session', {}, a.cookie);
    expect(expired.status).toBe(401); expect(await expired.json()).toMatchObject({code: 'SESSION_EXPIRED'});
    expect(expired.headers.get('set-cookie')).toContain('Max-Age=0');
    await sessions.maintenance();
    expect(await db.demoSession.findUnique({where: {id: a.context.sessionId}})).toBeNull();
  });
  it('reset cancels only current controllers, removes only current evidence, and fences stale work', async () => {
    const a = await create(); const b = await create();
    const ca = new AbortController(); const cb = new AbortController();
    sessions.registerController(a.context, ca); const release = sessions.registerController(b.context, cb);
    await sessions.repository.appendAudit(a.context.scope, 'A', {}, clock.now());
    const bAudit = await sessions.repository.appendAudit(b.context.scope, 'B', {}, clock.now());
    const response = await post('reset', {}, a.cookie); expect(response.status).toBe(201);
    const context = await sessions.authenticate({headers: {cookie: response.headers.get('set-cookie')!.split(';')[0]!}}, {setHeader: () => undefined}); ids.push(context.sessionId);
    expect(ca.signal.aborted).toBe(true); expect(cb.signal.aborted).toBe(false); release();
    expect(await db.auditEvent.count({where: {sessionId: a.context.sessionId}})).toBe(0);
    expect(await sessions.repository.getAudit(b.context.scope, bAudit.id)).toMatchObject({kind:'B'});
    await expect(sessions.repository.appendAudit(a.context.scope, 'late', {}, clock.now())).rejects.toMatchObject({code: 'SESSION_EXPIRED'});
    expect(await db.fixtureVersion.count({where: {id:'foundation-v1'}})).toBe(1);
  });
  it.each(['resume', 'guard'] as const)('reconciles recovered storage before existing-cookie %s admission', async entry => {
    const a = await create();
    const searches = new SearchRepository(db);
    const abandoned = await searches.create(a.context.scope, { query: {}, clientGeneration: 'before-restart', snapshot: { status: 'collecting' } }, clock.now());
    await app.close();

    // Keep one administrative connection alive while real PostgreSQL rejects all
    // new connections, including the restarted API's initial readiness check.
    const adminUrl = new URL(process.env.TEST_DATABASE_URL!);
    const databaseName = decodeURIComponent(adminUrl.pathname.slice(1));
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    const databaseIdentifier = '"' + databaseName.replaceAll('"', '""') + '"';
    try {
      await admin.query(`ALTER DATABASE ${databaseIdentifier} ALLOW_CONNECTIONS false`);
      await start();
      expect((await fetch(`${base}/api/health/live`)).status).toBe(200);
    } finally {
      await admin.query(`ALTER DATABASE ${databaseIdentifier} ALLOW_CONNECTIONS true`);
      await admin.end();
    }

    // No readiness request or maintenance tick is allowed before admission.
    if (entry === 'resume') {
      expect((await post('session', {}, a.cookie)).status).toBe(201);
      expect((await searches.get(a.context.scope, abandoned.id)).status).toBe('interrupted');
    }
    const response = await fetch(`${base}/api/test-audit/${abandoned.id}/work`, { method: 'POST', headers: { cookie: a.cookie } });
    expect(response.status).toBe(201);
    const admitted = await response.json() as { id: string; abandonedStatusAtAdmission: string };
    expect(admitted.abandonedStatusAtAdmission).toBe('interrupted');
    await sessions.maintenance();
    expect((await searches.get(a.context.scope, admitted.id)).status).toBe('collecting');
    expect(await db.searchEventRecord.count({ where: { sessionId: a.context.sessionId, searchId: abandoned.id } })).toBe(1);
  });
  it('restart preserves completed evidence, interrupts abandoned work, and cleans inactive sessions', async () => {
    const a = await create(); const expired = await create();
    const repo = new SessionRepository(db);
    const audit = await repo.appendAudit(a.context.scope, 'persistent', {}, clock.now());
    for (const [id,status] of [['complete-run','complete'],['collecting-run','collecting']]) {
      await db.searchRun.create({data: {sessionId:a.context.sessionId,id:id!,clientGeneration:'generation',query:{},status:status!,snapshot:{status},mappingRevision:a.info.mappingRevision,fixtureVersion:'foundation-v1',createdAt:clock.now(),updatedAt:clock.now()}});
    }
    await db.demoSession.update({where:{id:expired.context.sessionId},data:{expiresAt:clock.now()}});
    await app.close(); await start();
    expect(await repo.getAudit(a.context.scope,audit.id)).toMatchObject({kind:'persistent'});
    const runs = await db.searchRun.findMany({where:{sessionId:a.context.sessionId},orderBy:{id:'asc'}});
    expect(runs.map(r=>r.status)).toEqual(['interrupted','complete']);
    expect(runs[0]?.snapshot).toEqual({status:'interrupted'});
    expect(await db.searchEventRecord.count({where:{sessionId:a.context.sessionId,searchId:'collecting-run'}})).toBe(1);
    expect(await db.demoSession.findUnique({where:{id:expired.context.sessionId}})).toBeNull();
    await app.close(); await start();
    expect(await db.searchEventRecord.count({where:{sessionId:a.context.sessionId,searchId:'collecting-run'}})).toBe(1);
  });
});
