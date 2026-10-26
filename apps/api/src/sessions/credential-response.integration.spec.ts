import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Controller, Get, UseGuards, type INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionInfoSchema } from '@torob-ticket/contracts';
import { SessionModule } from './session.module';
import { SessionService } from './session.service';
import { SessionGuard } from './session.guard';
import { SystemRealClock } from '../common/clocks';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
let held = { entered: deferred(), release: deferred() };
@Controller('credential-race')
@UseGuards(SessionGuard)
class HeldGuardedResponse {
  @Get('success')
  async success() { held.entered.resolve(); await held.release.promise; return { accepted: true }; }
}
class ControlledClock extends SystemRealClock {
  instant = new Date('2026-10-24T12:00:00.000Z');
  override now() { return new Date(this.instant); }
  advance(milliseconds: number) { this.instant = new Date(this.instant.getTime() + milliseconds); }
}
describe('HTTP credential rotation survives stale ordinary responses', () => {
  let app: INestApplication, base: string, sessions: SessionService;
  const clock = new ControlledClock(), ids: string[] = [];
  const post = (path: string, cookie = '') => fetch(base + '/api/v1/demo/' + path, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
  const current = (cookie: string) => fetch(base + '/api/v1/demo/session', { headers: { cookie } });
  // Only explicit lifecycle responses are allowed to change the browser's cookie jar.
  const apply = (prior: string, response: Response) => response.headers.get('set-cookie')?.split(';')[0] ?? prior;
  async function remember(cookie: string) { const context = await sessions.authenticate({ headers: { cookie } }, { setHeader() { /* No browser response. */ } }); ids.push(context.sessionId); return context; }
  async function create() { const response = await post('session'); expect(response.status).toBe(201); const cookie = apply('', response); const context = await remember(cookie); return { response, cookie, context }; }
  beforeAll(async () => {
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    app = (await Test.createTestingModule({ imports: [SessionModule], controllers: [HeldGuardedResponse] }).overrideProvider(SystemRealClock).useValue(clock).compile()).createNestApplication();
    app.setGlobalPrefix('api'); await app.listen(0, '127.0.0.1'); base = await app.getUrl(); sessions = app.get(SessionService);
  });
  afterAll(async () => { if (app) { await sessions.database.demoSession.deleteMany({ where: { id: { in: ids } } }); await app.close(); } });
  it('does not overwrite a reset credential when an already-authenticated ordinary success arrives late', async () => {
    const original = await create(); held = { entered: deferred(), release: deferred() };
    const oldResponse = fetch(base + '/api/credential-race/success', { headers: { cookie: original.cookie } });
    await held.entered.promise;
    const reset = await post('reset', original.cookie); expect(reset.status).toBe(201); const replacement = apply(original.cookie, reset); await remember(replacement);
    held.release.resolve(); const late = await oldResponse;
    const jar = apply(replacement, late); const final = await current(jar);
    expect(late.status).toBe(200); expect(late.headers.has('set-cookie')).toBe(false); expect(final.status).toBe(200);
    expect(SessionInfoSchema.safeParse(await final.json()).success).toBe(true);
  });
  it('does not clear a reset credential when an older guard resumes after the old namespace was deleted', async () => {
    const original = await create(), repository = sessions.repository, entered = deferred(), release = deferred();
    const originalResolve = repository.resolveAndTouch.bind(repository); let first = true;
    const getter = vi.spyOn(sessions, 'repository', 'get').mockReturnValue(repository);
    const read = vi.spyOn(repository, 'resolveAndTouch').mockImplementation(async (hash, now) => { if (first) { first = false; entered.resolve(); await release.promise; } return originalResolve(hash, now); });
    try {
      const oldResponse = current(original.cookie); await entered.promise;
      const reset = await post('reset', original.cookie); expect(reset.status).toBe(201); const replacement = apply(original.cookie, reset); await remember(replacement);
      release.resolve(); const late = await oldResponse;
      const jar = apply(replacement, late); const final = await current(jar);
      expect(late.status).toBe(401); expect(late.headers.has('set-cookie')).toBe(false); expect(final.status).toBe(200);
    } finally { release.resolve(); read.mockRestore(); getter.mockRestore(); }
  });
  it('recovers malformed and ambiguous credentials only through explicit bootstrap',async()=>{
    for(const cookie of ['torob_demo=bad','torob_demo='+ 'a'.repeat(43)+'; torob_demo='+ 'b'.repeat(43)]){
      const rejected=await current(cookie);expect(rejected.status).toBe(401);expect(rejected.headers.has('set-cookie')).toBe(false);
      const response=await post('session',cookie);expect(response.status).toBe(201);const replacement=apply('',response);await remember(replacement);
      expect((await current(replacement)).status).toBe(200);
    }
  });
  it('issues browser-session cookies while the server alone enforces sliding24h inactivity and explicit expiry recovery', async () => {
    const original = await create(); const issuance = original.response.headers.get('set-cookie') ?? '';
    expect(issuance.includes('HttpOnly')).toBe(true); expect(issuance.includes('SameSite=Strict')).toBe(true); expect(issuance.includes('Max-Age=')).toBe(false); expect(issuance.includes('Expires=')).toBe(false);
    clock.advance(23 * 3600000); const active = await current(original.cookie); expect(active.status).toBe(200); expect(active.headers.has('set-cookie')).toBe(false);
    clock.advance(2 * 3600000); expect((await current(original.cookie)).status).toBe(200);
    const before = await sessions.database.demoSession.findUniqueOrThrow({ where: { id: original.context.sessionId } });
    clock.advance(24 * 3600000 + 1); const expired = await current(original.cookie); expect(expired.status).toBe(401); expect(expired.headers.has('set-cookie')).toBe(false);
    const after = await sessions.database.demoSession.findUniqueOrThrow({ where: { id: original.context.sessionId } }); expect(after.expiresAt).toEqual(before.expiresAt);
    const resumed = await post('session', original.cookie); expect(resumed.status).toBe(201); const replacement = apply(original.cookie, resumed); expect(replacement === original.cookie).toBe(false); const context = await remember(replacement); expect(context.sessionId === original.context.sessionId).toBe(false);
    expect((await current(replacement)).status).toBe(200);
  });
});
